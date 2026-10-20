from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import provider


client = TestClient(app)
MILESTONE = {'title': 'Practice form', 'goal': 'Build a mock login interface',
             'concepts': ['Form labels'], 'expected_behaviors': ['The form is visible'],
             'steps': ['Plan the form'], 'acceptance_criteria': ['Fields have labels']}
SYNTHETIC_SECRETS = [
    'AIza' + 'A' * 35,
    'ghp_' + 'A' * 36,
    'Authorization: Bearer ' + 'A' * 24,
    '-----BEGIN PRIVATE KEY-----',
    'GEMINI_API_KEY=' + 'A' * 24,
]


@pytest.mark.parametrize('secret', SYNTHETIC_SECRETS)
@pytest.mark.parametrize('custom', [False, True])
def test_both_hint_routes_block_synthetic_secrets_before_provider(monkeypatch, secret, custom):
    mock = AsyncMock(side_effect=AssertionError('Provider must not receive a secret'))
    monkeypatch.setattr(provider, 'generate', mock)
    body = {'kind': 'custom', 'milestone': MILESTONE} if custom else {'milestone_id': 'add-task'}
    body.update(level=1, code_context='const credential = "' + secret + '";', context_consent=True)
    response = client.post('/mentor/hint', json=body)
    assert response.status_code == 422
    assert secret not in response.text
    mock.assert_not_awaited()


@pytest.mark.parametrize('custom', [False, True])
def test_both_hint_routes_require_consent_before_provider(monkeypatch, custom):
    mock = AsyncMock(side_effect=AssertionError('Provider must not be called'))
    monkeypatch.setattr(provider, 'generate', mock)
    body = {'kind': 'custom', 'milestone': MILESTONE} if custom else {'milestone_id': 'add-task'}
    response = client.post('/mentor/hint', json={**body, 'level': 1, 'code_context': 'safe selection'})
    assert response.status_code == 422
    mock.assert_not_awaited()


@pytest.mark.parametrize('field,body', [
    ('previous_hints', {'milestone_id': 'add-task', 'level': 1,
                        'previous_hints': ['AIza' + 'A' * 35]}),
    ('test_results', {'milestone_id': 'add-task', 'level': 1,
                      'test_results': [{'id': 'sk-' + 'A' * 20, 'passed': False}]}),
    ('idea', {'idea': 'Build a login page with GEMINI_API_KEY=' + 'A' * 20}),
    ('explanation', {'milestone_id': 'add-task',
                     'explanation': 'My explanation contains Authorization: Bearer ' + 'A' * 24}),
])
def test_other_provider_inputs_reject_synthetic_secrets(monkeypatch, field, body):
    mock = AsyncMock(side_effect=AssertionError('Provider must not be called'))
    monkeypatch.setattr(provider, 'generate', mock)
    route = {'idea': '/roadmap/generate', 'explanation': '/learning/evaluate'}.get(field, '/mentor/hint')
    response = client.post(route, json=body)
    assert response.status_code == 422
    assert 'A' * 20 not in response.text
    mock.assert_not_awaited()
