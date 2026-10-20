"""Exercise the official SDK against an in-memory HTTP transport, never Google."""
import asyncio
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models import HintOutput
from app.services import provider

client = TestClient(app)
FAKE_KEY = 'fake-gemini-key-never-sent'
HINT = 'Which part of the page should change after the click?'
IDEA = {'idea': 'Build a book club page', 'level': 'beginner'}
EXPLANATION = ('A detached node exists in memory. Insertion connects it to the document. '
               'Trim and reject blank input before inserting.')
ANSWER = {'milestone_id': 'add-task', 'explanation': EXPLANATION}


def reply(data, finish='STOP'):
    text = data if isinstance(data, str) else json.dumps(data)
    return {'candidates': [{'finishReason': finish, 'content': {
        'role': 'model', 'parts': [{'text': text}],
    }}]}


def roadmap_data():
    return {'title': 'Book club', 'milestones': [{
        'title': f'Step {i}', 'goal': 'Build an interface', 'concepts': ['HTML'],
        'expected_behaviors': ['Form is visible'], 'steps': ['Plan the fields'],
        'acceptance_criteria': ['Fields have labels'],
    } for i in range(3)]}


def review_data():
    evidence = ['A detached node exists in memory', 'Insertion connects it to the document',
                'Trim and reject blank input before inserting']
    return {'items': [{'criterion_index': i, 'met': True, 'evidence': text,
                       'feedback': 'Supported'} for i, text in enumerate(evidence)],
            'feedback': 'All explicit concepts are supported.'}


@pytest.fixture
def gemini(monkeypatch):
    monkeypatch.setenv('AI_ENABLED', 'true')
    monkeypatch.setenv('AI_PROVIDER', 'gemini')
    monkeypatch.setenv('GEMINI_API_KEY', FAKE_KEY)
    # An unrelated credential must never select another provider or leak to Google.
    monkeypatch.setenv('OPENAI_API_KEY', 'fake-unused-openai-key')
    monkeypatch.setattr(provider, 'AsyncOpenAI', MagicMock(side_effect=AssertionError('Wrong provider')))
    state = SimpleNamespace(responses=[], requests=[], clients=[], options=[])
    real_client = provider.genai.Client

    def handle(request):
        state.requests.append(request)
        assert state.responses, 'Unexpected SDK request (including an unwanted retry)'
        response = state.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        status, body = response if isinstance(response, tuple) else (200, response)
        return httpx.Response(status, json=body, request=request)

    def make_client(**kwargs):
        options = kwargs['http_options']
        state.options.append(options)
        transport = httpx.MockTransport(handle)
        options.client_args = {'transport': transport, 'trust_env': False}
        options.async_client_args = {'transport': transport, 'trust_env': False}
        sdk = real_client(**kwargs)
        state.clients.append(sdk)
        return sdk

    state.factory = MagicMock(side_effect=make_client)
    monkeypatch.setattr(provider.genai, 'Client', state.factory)
    return state


@pytest.mark.parametrize('name,enabled,gemini_key,openai_key,expected', [
    ('gemini', 'true', 'fake-key', '', True),
    (' GeMiNi ', ' TRUE ', 'fake-key', '', True),
    ('gemini', 'false', 'fake-key', 'fake-key', False),
    ('gemini', 'true', '', 'fake-key', False),
    ('gemini', 'true', '   ', '', False),
    ('openai', 'true', '', 'fake-key', True),
    ('openai', 'true', 'fake-key', '', False),
    ('invalid-private-value', 'true', 'fake-key', 'fake-key', False),
    ('', 'true', 'fake-key', 'fake-key', False),
])
def test_health_configuration_is_local_and_secret_free(
        monkeypatch, gemini, name, enabled, gemini_key, openai_key, expected):
    monkeypatch.setenv('AI_PROVIDER', name)
    monkeypatch.setenv('AI_ENABLED', enabled)
    monkeypatch.setenv('GEMINI_API_KEY', gemini_key)
    monkeypatch.setenv('OPENAI_API_KEY', openai_key)
    response = client.get('/health')
    assert response.json() == {'status': 'ok', 'version': '0.1.0',
                               'ai_configured': expected, 'offline_guided_available': True}
    gemini.factory.assert_not_called()


@pytest.mark.parametrize('setting,value,message', [
    ('AI_ENABLED', 'false', 'GEMINI_API_KEY'),
    ('GEMINI_API_KEY', '', 'GEMINI_API_KEY'),
    ('GEMINI_API_KEY', '  ', 'GEMINI_API_KEY'),
    ('AI_PROVIDER', 'private-invalid-provider', 'AI_PROVIDER'),
])
def test_unconfigured_ai_fails_without_sdk_calls(monkeypatch, gemini, setting, value, message):
    monkeypatch.setenv(setting, value)
    response = client.post('/roadmap/generate', json=IDEA)
    assert response.status_code == 503
    assert message in response.json()['error']['message']
    assert 'private-invalid-provider' not in response.text
    hint = client.post('/mentor/hint', json={'milestone_id': 'add-task', 'level': 1})
    assert hint.json()['source'] == 'Offline scripted hint'
    gemini.factory.assert_not_called()


@pytest.mark.parametrize('model', [None, '', 'custom-available-gemini-model'])
def test_gemini_roadmap_schema_and_sdk_request(monkeypatch, gemini, model):
    if model is not None:
        monkeypatch.setenv('GEMINI_MODEL', model)
    gemini.responses.append(reply(roadmap_data()))
    response = client.post('/roadmap/generate', json=IDEA)
    assert response.status_code == 200
    data = response.json()
    assert set(data) == {'title', 'milestones', 'source', 'verification'}
    assert data['source'] == 'AI-generated roadmap'
    assert data['verification'] == 'unavailable'
    assert len(data['milestones']) == 3
    assert all('not available' in m['verification'] for m in data['milestones'])
    request, = gemini.requests
    assert request.url.host == 'generativelanguage.googleapis.com'
    assert f'/models/{model or "gemini-2.5-flash"}:generateContent' in request.url.path
    assert request.headers['x-goog-api-key'] == FAKE_KEY
    body = json.loads(request.content)
    assert FAKE_KEY not in str(request.url) + request.content.decode() + response.text
    assert json.loads(body['contents'][0]['parts'][0]['text']) == IDEA
    assert 'untrusted data' in body['systemInstruction']['parts'][0]['text']
    assert '3 or 4 milestones' in body['systemInstruction']['parts'][0]['text']
    assert 'under 16 words' in body['systemInstruction']['parts'][0]['text']
    config = body['generationConfig']
    assert config['responseMimeType'] == 'application/json'
    assert config['responseJsonSchema']['additionalProperties'] is False
    assert config['responseJsonSchema']['properties']['milestones']['minItems'] == 3
    assert config['responseJsonSchema']['properties']['milestones']['maxItems'] == 5
    assert config['maxOutputTokens'] == 3000
    assert 'tools' not in body
    assert gemini.options[0].timeout == 12000
    assert gemini.options[0].retry_options.attempts == 1
    assert gemini.factory.call_args.kwargs['vertexai'] is False


@pytest.mark.parametrize('level', [1, 2])
def test_gemini_hint_rejects_code_then_accepts_socratic_retry(gemini, level):
    gemini.responses.extend([reply({'text': 'Use `list.appendChild(item)` to fix it.'}),
                             reply({'text': HINT})])
    response = client.post('/mentor/hint', json={'milestone_id': 'add-task', 'level': level})
    assert response.json() == {'text': HINT, 'source': 'AI hint (validated)', 'level': level}
    assert len(gemini.requests) == 2
    retry = json.loads(gemini.requests[1].content)
    assert 'rejected for code or solution leakage' in retry['systemInstruction']['parts'][0]['text']


@pytest.mark.parametrize('level', [1, 2])
def test_gemini_unsafe_hints_fall_back_after_two_attempts(gemini, level):
    gemini.responses.extend([reply({'text': 'Attach a click listener to the button.'})] * 2)
    response = client.post('/mentor/hint', json={'milestone_id': 'add-task', 'level': level})
    assert response.status_code == 200
    assert 'fallback' in response.json()['source']
    assert response.json()['text'] != 'Attach a click listener to the button.'
    assert len(gemini.requests) == 2


def test_gemini_level_three_small_example(gemini):
    gemini.responses.append(reply({'text': 'An example is `const count = 1;`.'}))
    response = client.post('/mentor/hint', json={'milestone_id': 'add-task', 'level': 3})
    assert response.json()['source'] == 'AI hint (validated)'


@pytest.mark.parametrize('change,expected_status,passed', [
    ('none', 200, True), ('invented_evidence', 200, False),
    ('missing_item', 502, None), ('duplicate_index', 502, None),
])
def test_gemini_assessment_keeps_evidence_and_complete_rubric_checks(gemini, change, expected_status, passed):
    data = review_data()
    if change == 'invented_evidence':
        data['items'][0]['evidence'] = 'Invented words absent from the explanation'
    elif change == 'missing_item':
        data['items'].pop()
    elif change == 'duplicate_index':
        data['items'][1]['criterion_index'] = 0
    gemini.responses.append(reply(data))
    response = client.post('/learning/evaluate', json=ANSWER)
    assert response.status_code == expected_status
    if passed is not None:
        assert response.json()['passed'] is passed
        assert set(response.json()) == {'passed', 'source', 'correct', 'missing', 'feedback'}


@pytest.mark.parametrize('status,message', [
    (400, 'rejected'), (401, 'authentication'), (403, 'access'),
    (404, 'model unavailable'), (429, 'quota'), (500, 'unavailable'), (503, 'unavailable'),
])
@pytest.mark.parametrize('route,body', [('/roadmap/generate', IDEA), ('/learning/evaluate', ANSWER)])
def test_gemini_http_errors_are_sanitized(gemini, caplog, status, message, route, body):
    gemini.responses.append((status, {'error': {'code': status, 'message': f'private {FAKE_KEY}'}}))
    response = client.post(route, json=body)
    assert response.status_code == 502
    assert response.json()['error']['code'] == 'not_available'
    assert message in response.json()['error']['message']
    assert FAKE_KEY not in response.text + caplog.text
    assert 'private' not in response.text + caplog.text
    assert len(gemini.requests) == 1


@pytest.mark.parametrize('error,expected_status', [
    (httpx.ConnectError(f'private {FAKE_KEY}'), 502),
    (httpx.ReadError(f'private {FAKE_KEY}'), 502),
    (httpx.ReadTimeout(f'private {FAKE_KEY}'), 504),
    (OSError(f'private {FAKE_KEY}'), 502),
])
def test_gemini_network_errors_are_sanitized(gemini, caplog, error, expected_status):
    gemini.responses.append(error)
    response = client.post('/roadmap/generate', json=IDEA)
    assert response.status_code == expected_status
    assert FAKE_KEY not in response.text + caplog.text
    assert len(gemini.requests) == 1


@pytest.mark.parametrize('response', [
    (429, {'error': {'code': 429, 'message': 'quota'}}),
    (403, {'error': {'code': 403, 'message': 'credentials'}}),
    (404, {'error': {'code': 404, 'message': 'model'}}),
    httpx.ConnectError('network'), httpx.ReadTimeout('timeout'),
    reply('malformed JSON'), reply({'text': 'too short'}),
])
def test_gemini_hint_failures_keep_offline_fallback(gemini, response):
    gemini.responses.append(response)
    result = client.post('/mentor/hint', json={'milestone_id': 'add-task', 'level': 1})
    assert result.status_code == 200
    assert 'fallback' in result.json()['source']
    assert len(gemini.requests) == 1


@pytest.mark.parametrize('response', [
    None, [], 'invalid envelope', {'candidates': [None]},
    {}, {'promptFeedback': {'blockReason': 'SAFETY'}},
    reply(roadmap_data(), 'MAX_TOKENS'), reply(roadmap_data(), 'SAFETY'),
    reply(''), reply('```json\n{}\n```'), reply('{broken'), reply('null'),
    reply({'title': 'Missing milestones'}),
    reply({**roadmap_data(), 'unexpected': 'extra field'}),
    reply({**roadmap_data(), 'milestones': []}),
])
def test_gemini_rejects_malformed_blocked_and_incomplete_output(gemini, response):
    gemini.responses.append(response)
    result = client.post('/roadmap/generate', json=IDEA)
    assert result.status_code == 502
    assert 'invalid response' in result.json()['error']['message']


@pytest.mark.parametrize('name,model', [(None, None), ('openai', 'custom-openai-model')])
def test_openai_optional_provider_and_legacy_default(monkeypatch, name, model):
    monkeypatch.setenv('AI_ENABLED', 'true')
    monkeypatch.setenv('OPENAI_API_KEY', 'fake-openai-key')
    if name is None:
        monkeypatch.delenv('AI_PROVIDER', raising=False)
    else:
        monkeypatch.setenv('AI_PROVIDER', name)
        monkeypatch.setenv('OPENAI_MODEL', model)
    parse = AsyncMock(return_value=SimpleNamespace(output_parsed=HintOutput(text=HINT)))
    sdk = MagicMock()
    sdk.__aenter__ = AsyncMock(return_value=SimpleNamespace(responses=SimpleNamespace(parse=parse)))
    sdk.__aexit__ = AsyncMock(return_value=False)
    factory = MagicMock(return_value=sdk)
    monkeypatch.setattr(provider, 'AsyncOpenAI', factory)
    google_factory = MagicMock(side_effect=AssertionError('Wrong provider'))
    monkeypatch.setattr(provider.genai, 'Client', google_factory)
    result = asyncio.run(provider.generate(HintOutput, 'Ask a question.', {'level': 1}))
    assert result.text == HINT
    assert parse.call_args.kwargs['model'] == (model or 'gpt-4.1-mini')
    assert parse.call_args.kwargs['store'] is False
    assert parse.call_args.kwargs['text_format'] is HintOutput
    assert 'untrusted data' in parse.call_args.kwargs['input'][0]['content']
    assert factory.call_args.kwargs['max_retries'] == 0
    google_factory.assert_not_called()
    sdk.__aexit__.assert_awaited_once()
