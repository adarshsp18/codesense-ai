from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models import CustomReviewResponse, HintOutput
from app.services import provider


client = TestClient(app)
MILESTONE = {'title': 'Login form', 'goal': 'Build a beginner login form',
             'concepts': ['Form semantics'], 'expected_behaviors': ['Fields are labeled'],
             'steps': ['Add labeled inputs'], 'acceptance_criteria': ['Labels are visible']}
REQUEST = {'kind': 'custom', 'project_id': '11111111-1111-1111-1111-111111111111',
           'milestone_index': 0, 'milestone': MILESTONE,
           'code_context': '<form><input></form>', 'context_consent': True}


def advisory(**changes):
    return CustomReviewResponse.model_validate({
        'review_summary': 'The snippet shows a form; labeling and runtime behavior need further review.',
        'satisfied': [], 'potential_issues': ['The input may need an associated label.'],
        'observations': [{'observation': 'A form and one input are present.',
                          'evidence': 'Only the provided snippet was inspected.'}],
        'cannot_verify': ['Behavior outside this snippet is unknown.'],
        'next_actions': ['Inspect the input label.', 'Check the form behavior manually.'],
        'verification_status': 'unverified', **changes})


@pytest.fixture
def generate(monkeypatch):
    mock = AsyncMock(return_value=advisory())
    monkeypatch.setattr(provider, 'generate', mock)
    return mock


def test_review_is_grounded_advisory_and_uses_only_approved_snippet(generate):
    response = client.post('/mentor/review', json=REQUEST)
    assert response.status_code == 200
    data = response.json()
    assert data['verification_status'] == 'unverified'
    assert len(data['next_actions']) == 2
    assert any('cannot be verified' in item for item in data['cannot_verify'])
    schema, instructions, payload = generate.call_args.args
    assert schema is CustomReviewResponse
    assert 'untrusted data' in instructions
    assert payload['code_context'] == REQUEST['code_context']
    assert payload['milestone'] == MILESTONE
    assert 'context_consent' not in payload and 'project_id' not in payload


@pytest.mark.parametrize('change', [
    {'context_consent': False}, {'code_context': ''}, {'code_context': 'x' * 4001},
    {'code_context': 'AIza' + 'x' * 35}, {'code_context': 'const api_key = "synthetic";'},
    {'code_context': '-----BEGIN PRIVATE KEY-----\nsynthetic'},
    {'milestone_index': 5}, {'project_id': '../outside'},
])
def test_review_rejects_unconsented_invalid_or_sensitive_context_before_provider(generate, change):
    response = client.post('/mentor/review', json={**REQUEST, **change})
    assert response.status_code == 422
    assert 'synthetic' not in response.text
    generate.assert_not_awaited()


@pytest.mark.parametrize('failure,code', [
    (provider.AIServiceError('Gemini rate limit or quota reached.'), 502),
    (TimeoutError(), 504), (ValueError('private provider output'), 502),
])
def test_review_provider_errors_are_sanitized(generate, failure, code):
    generate.side_effect = failure
    response = client.post('/mentor/review', json=REQUEST)
    assert response.status_code == code
    assert 'verification_status' not in response.text
    assert 'private provider output' not in response.text


def test_review_rejects_false_verification_and_echoed_secrets(generate):
    generate.return_value = advisory(satisfied=['The implementation is verified.'])
    assert client.post('/mentor/review', json=REQUEST).status_code == 502
    generate.return_value = advisory(next_actions=['Send AIza' + 'x' * 35, 'Check the form manually.'])
    assert client.post('/mentor/review', json=REQUEST).status_code == 502


def test_review_rejects_malformed_provider_response_without_leaking_details(generate):
    generate.return_value = {'satisfied': ['private malformed output']}
    response = client.post('/mentor/review', json=REQUEST)
    assert response.status_code == 502
    assert 'private malformed output' not in response.text


def test_review_issue_can_focus_question_and_hint_without_changing_rubric(generate, monkeypatch):
    issue = 'The visible input may need an associated label.'
    question = client.post('/learning/question', json={'kind': 'custom', 'milestone': MILESTONE,
                                                     'review_focus': issue})
    baseline = client.post('/learning/question', json={'kind': 'custom', 'milestone': MILESTONE})
    assert question.status_code == 200 and issue in question.json()['question']
    assert question.json()['rubric'] == baseline.json()['rubric']
    monkeypatch.setattr(provider, 'configured', lambda: True)
    generate.return_value = HintOutput(text='What helps a reader understand the purpose of this input?')
    hint = client.post('/mentor/hint', json={'kind': 'custom', 'milestone': MILESTONE,
                                            'level': 1, 'review_focus': issue,
                                            'code_context': REQUEST['code_context'], 'context_consent': True})
    assert hint.status_code == 200 and hint.json()['level'] == 1
    assert generate.call_args.args[2]['review_focus'] == issue


def test_review_respects_local_only_post_policy(generate):
    assert client.post('/mentor/review', json=REQUEST, headers={'Origin': 'https://example.com'}).status_code == 403
    generate.assert_not_awaited()
