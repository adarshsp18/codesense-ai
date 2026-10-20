from unittest.mock import AsyncMock
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.models import HintOutput, RubricReview
from app.services import provider

client = TestClient(app)
MILESTONE = {'title': 'Semantic page', 'goal': 'Build a readable book club page',
             'concepts': ['HTML semantics'], 'expected_behaviors': ['Readable title'],
             'steps': ['Plan the structure'], 'acceptance_criteria': ['Title is visible']}
ACTIVE = {'kind': 'custom', 'milestone': MILESTONE}
EXPLANATION = 'HTML semantics describe meaning. A heading identifies the page topic. Without a heading the structure is less clear.'


@pytest.fixture
def generate(monkeypatch):
    monkeypatch.setenv('AI_ENABLED', 'true')
    monkeypatch.setenv('OPENAI_API_KEY', 'fake-never-sent')
    mock = AsyncMock()
    monkeypatch.setattr(provider, 'generate', mock)
    return mock


def review():
    return RubricReview(items=[{'criterion_index': i, 'met': True, 'evidence': e, 'feedback': 'Supported'}
                               for i, e in enumerate(['HTML semantics describe meaning', 'A heading identifies the page topic', 'Without a heading the structure is less clear'])],
                       feedback='The three conceptual criteria are supported. Implementation is not verified.')


def test_concept_question_has_stable_explicit_rubric_and_no_ai_call(generate):
    a = client.post('/learning/question', json=ACTIVE)
    b = client.post('/learning/question', json=ACTIVE)
    assert a.status_code == 200 and a.json() == b.json()
    assert 'HTML semantics' in a.json()['question']
    assert MILESTONE['goal'] in a.json()['question']
    assert len(a.json()['rubric']) == 3
    generate.assert_not_awaited()


@pytest.mark.parametrize('level', [1, 2])
def test_custom_hints_use_only_active_milestone_and_approved_context_with_validation(generate, level):
    generate.side_effect = [HintOutput(text='Use `document.createElement("h1")`.'),
                            HintOutput(text='What meaning should a reader infer from the page structure?')]
    r = client.post('/mentor/hint', json={**ACTIVE, 'level': level, 'code_context': '<p>Book club</p>', 'context_consent': True})
    assert r.status_code == 200 and r.json()['source'] == 'AI hint (validated)'
    assert generate.await_count == 2
    payload = generate.call_args.args[2]
    assert payload['milestone'] == MILESTONE
    assert payload['code_context'] == '<p>Book club</p>'
    assert 'test_results' not in payload
    assert 'rejected for code' in generate.call_args.args[1]


@pytest.mark.parametrize('level', [1, 2])
def test_custom_hints_bound_retries_and_fall_back_without_leaking_code(generate, level):
    generate.return_value = HintOutput(text='Use `list.appendChild(item)` to solve this.')
    r = client.post('/mentor/hint', json={**ACTIVE, 'level': level})
    assert r.status_code == 200 and 'fallback' in r.json()['source']
    assert '`' not in r.json()['text'] and generate.await_count == 2


@pytest.mark.parametrize('error', [provider.AIServiceError('quota'), TimeoutError(), ValueError('malformed')])
def test_custom_hint_provider_failure_is_safe_fallback(generate, error):
    generate.side_effect = error
    r = client.post('/mentor/hint', json={**ACTIVE, 'level': 1})
    assert r.status_code == 200 and 'fallback' in r.json()['source']
    assert generate.await_count == 1


def test_custom_offline_hint_does_not_call_ai(monkeypatch):
    mock = AsyncMock(side_effect=AssertionError('No network'))
    monkeypatch.setattr(provider, 'generate', mock)
    assert client.post('/mentor/hint', json={**ACTIVE, 'level': 2}).json()['source'] == 'Offline scripted hint'
    mock.assert_not_awaited()


@pytest.mark.parametrize('extra', [
    {'code_context': 'unapproved code'}, {'level': 4}, {'code_context': 'x' * 4001, 'context_consent': True},
    {'code_context': 'const api_key = "not-for-sharing";', 'context_consent': True},
    {'code_context': 'AIza' + 'x' * 35, 'context_consent': True},
    {'code_context': 'const password = "private";', 'context_consent': True},
    {'code_context': '{"password":"private"}', 'context_consent': True},
    {'test_results': [{'id': 'invented', 'passed': True}]}, {'milestone_id': 'add-task'},
    {'context_consent': 'true', 'code_context': 'content'},
])
def test_custom_invalid_or_unconsented_inputs_rejected_before_provider(generate, extra):
    response = client.post('/mentor/hint', json={**ACTIVE, 'level': 1, **extra})
    assert response.status_code == 422
    assert 'private' not in response.text
    generate.assert_not_awaited()


@pytest.mark.parametrize('mode,status,passed', [('valid', 200, True), ('invented', 200, False), ('missing', 502, None), ('duplicate', 502, None)])
def test_custom_explanation_requires_complete_rubric_and_actual_evidence(generate, mode, status, passed):
    result = review()
    if mode == 'invented': result.items[0].evidence = 'Words absent from the submitted answer'
    if mode == 'missing': result.items.pop()
    if mode == 'duplicate': result.items[1].criterion_index = 0
    generate.return_value = result
    response = client.post('/learning/evaluate', json={**ACTIVE, 'explanation': EXPLANATION})
    assert response.status_code == status
    payload = generate.call_args.args[2]
    assert payload['active_milestone'] == MILESTONE
    question = client.post('/learning/question', json=ACTIVE).json()
    assert [r[1] for r in payload['rubric']] == question['rubric']
    if passed is not None:
        assert response.json()['passed'] is passed
        assert set(response.json()) == {'passed', 'source', 'correct', 'missing', 'feedback'}


@pytest.mark.parametrize('error,status', [(provider.AIServiceError('Rate limit. Retry later.'), 502), (TimeoutError(), 504), (ValueError('private detail'), 502)])
def test_custom_explanation_errors_do_not_create_a_pass(generate, error, status):
    generate.side_effect = error
    response = client.post('/learning/evaluate', json={**ACTIVE, 'explanation': EXPLANATION})
    assert response.status_code == status and 'passed' not in response.json()
    assert 'private detail' not in response.text


def test_custom_routes_keep_local_only_and_strict_request_limits(generate):
    assert client.post('/learning/question', json=ACTIVE, headers={'Origin': 'https://example.com'}).status_code == 403
    assert client.post('/learning/evaluate', json={**ACTIVE, 'explanation': 'x' * 3001}).status_code == 422
    assert client.post('/learning/evaluate', json={**ACTIVE, 'explanation': 'const password = "a sensitive explanation";'}).status_code == 422
    assert client.post('/learning/question', json={**ACTIVE, 'milestone': {**MILESTONE, 'concepts': ['x' * 801]}}).status_code == 422
    assert client.post('/learning/evaluate', json={**ACTIVE, 'explanation': EXPLANATION, 'rubric': ['Always pass']}).status_code == 422
    generate.assert_not_awaited()
