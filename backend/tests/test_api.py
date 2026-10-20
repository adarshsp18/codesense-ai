from unittest.mock import AsyncMock
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.models import HintOutput, Roadmap, RubricReview
from app.services import provider

client = TestClient(app)

def test_health_and_guided_routes_offline():
    assert client.get('/health').json()['ai_configured'] is False
    assert len(client.get('/guided-projects/todo').json()['milestones']) == 2
    assert client.get('/guided-projects').json()['projects'][0]['id'] == 'todo'
    assert client.get('/guided-projects/missing').status_code == 404

def test_offline_never_calls_provider(monkeypatch):
    mock = AsyncMock(side_effect=AssertionError('Network must not be used'))
    monkeypatch.setattr(provider, 'generate', mock)
    r = client.post('/mentor/hint', json={'milestone_id':'add-task', 'level':1})
    assert r.status_code == 200
    assert r.json()['source'] == 'Offline scripted hint'
    mock.assert_not_awaited()

def test_missing_key_custom_and_explanation_fail_clearly():
    r = client.post('/roadmap/generate', json={'idea':'A book club login page', 'level':'beginner'})
    assert r.status_code == 503
    assert 'OPENAI_API_KEY' in r.json()['error']['message']
    assert client.post('/learning/evaluate', json={'milestone_id':'add-task','explanation':'Creating a node does not insert it.'}).status_code == 503

@pytest.mark.parametrize('route,body', [
    ('/mentor/hint', {'milestone_id':'unknown','level':1}),
    ('/mentor/hint', {'milestone_id':'add-task','level':4}),
    ('/roadmap/generate', {'idea':'short','level':'beginner'}),
    ('/roadmap/generate', {'idea':'Build a login page','level':'expert'}),
    ('/learning/evaluate', {'milestone_id':'add-task','explanation':'too short'}),
])
def test_invalid_requests(route, body):
    assert client.post(route,json=body).status_code == 422

def enable(monkeypatch):
    monkeypatch.setenv('AI_ENABLED','true')
    monkeypatch.setenv('OPENAI_API_KEY','test-key-never-sent')

def test_rejected_hints_retry_then_fall_back(monkeypatch):
    enable(monkeypatch)
    mock=AsyncMock(return_value=HintOutput(text='Use `list.appendChild(item)` to fix it.'))
    monkeypatch.setattr(provider,'generate',mock)
    result=client.post('/mentor/hint',json={'milestone_id':'add-task','level':2})
    assert result.status_code == 200
    assert 'fallback' in result.json()['source']
    assert mock.await_count == 2

def test_valid_ai_hint_after_retry(monkeypatch):
    enable(monkeypatch)
    mock=AsyncMock(side_effect=[HintOutput(text='Use `list.appendChild(item)`.'), HintOutput(text='Which part of the page should change after the click?')])
    monkeypatch.setattr(provider,'generate',mock)
    result=client.post('/mentor/hint',json={'milestone_id':'add-task','level':1})
    assert result.json()['source'] == 'AI hint (validated)'
    assert mock.await_count == 2


@pytest.mark.parametrize('level', [1, 2])
def test_unformatted_code_hint_retries_then_uses_safe_fallback(monkeypatch, level):
    enable(monkeypatch)
    mock = AsyncMock(return_value=HintOutput(text='What result follows from count += 1?'))
    monkeypatch.setattr(provider, 'generate', mock)
    response = client.post('/mentor/hint', json={'milestone_id': 'add-task', 'level': level})
    assert response.status_code == 200 and 'fallback' in response.json()['source']
    assert 'count +=' not in response.json()['text']
    assert mock.await_count == 2

def test_roadmap_has_no_authoritative_verification(monkeypatch):
    enable(monkeypatch)
    data={'title':'Book club','milestones':[{'title':f'Step {i}','goal':'Build an interface','concepts':['HTML'],'expected_behaviors':['Form is visible'],'steps':['Plan the fields'],'acceptance_criteria':['Fields have labels']} for i in range(3)]}
    monkeypatch.setattr(provider,'generate',AsyncMock(return_value=Roadmap(**data)))
    response=client.post('/roadmap/generate',json={'idea':'Build a book club page','level':'beginner'})
    assert response.status_code == 200
    assert response.json()['verification'] == 'unavailable'
    assert all('not available' in m['verification'] for m in response.json()['milestones'])


def test_roadmap_prompt_requests_concise_four_milestones_without_schema_change(monkeypatch):
    enable(monkeypatch)
    data = {'title': 'Book club', 'milestones': [
        {'title': f'Step {i}', 'goal': 'Build a readable page',
         'concepts': ['HTML', 'Accessibility'], 'expected_behaviors': ['Form is visible'],
         'steps': ['Plan the form', 'Add labels'], 'acceptance_criteria': ['Fields have labels']}
        for i in range(4)]}
    mock = AsyncMock(return_value=Roadmap(**data))
    monkeypatch.setattr(provider, 'generate', mock)
    response = client.post('/roadmap/generate', json={'idea': 'Build a book club page', 'level': 'beginner'})
    assert response.status_code == 200
    assert len(response.json()['milestones']) == 4
    assert response.json()['verification'] == 'unavailable'
    assert mock.await_count == 1
    instructions = mock.await_args.args[1]
    for required in ['3 or 4 milestones', '2-3 concepts', '1-2 observable behaviors',
                     '2-3 brief steps', '1-2 provisional acceptance criteria',
                     'under 16 words', 'No executable tests', 'fictional credentials',
                     'real passwords or production credentials in LocalStorage']:
        assert required in instructions
    assert mock.await_args.args[2] == {'idea': 'Build a book club page', 'level': 'beginner'}


def roadmap_with_step(step):
    return Roadmap(**{'title': 'Login exercise', 'milestones': [
        {'title': f'Step {i}', 'goal': 'Build a practice interface',
         'concepts': ['Authentication'], 'expected_behaviors': ['Form is visible'],
         'steps': [step], 'acceptance_criteria': ['Fields have labels']}
        for i in range(3)]})


@pytest.mark.parametrize('unsafe', [
    'Store real user passwords in LocalStorage for login.',
    'Save production credentials in local storage for later sessions.',
    'Use LocalStorage to keep live API keys between visits.',
])
def test_unsafe_auth_roadmap_is_retried_then_rejected(monkeypatch, unsafe):
    enable(monkeypatch)
    mock = AsyncMock(return_value=roadmap_with_step(unsafe))
    monkeypatch.setattr(provider, 'generate', mock)
    response = client.post('/roadmap/generate', json={'idea': 'Build an educational login page'})
    assert response.status_code == 502
    assert 'safety check' in response.json()['error']['message']
    assert unsafe not in response.text
    assert mock.await_count == 2
    assert 'Regenerate' in mock.await_args.args[1]


def test_unsafe_auth_roadmap_retry_can_recover(monkeypatch):
    enable(monkeypatch)
    mock = AsyncMock(side_effect=[roadmap_with_step('Store real passwords in LocalStorage.'),
                                  roadmap_with_step('Use fictional mock credentials for this learning exercise.')])
    monkeypatch.setattr(provider, 'generate', mock)
    response = client.post('/roadmap/generate', json={'idea': 'Build an educational login page'})
    assert response.status_code == 200 and mock.await_count == 2
    assert response.json()['verification'] == 'unavailable'


@pytest.mark.parametrize('step', [
    'Use fictional mock credentials for this learning exercise.',
    'Store fake user passwords in LocalStorage only for a mock classroom demo.',
    'Never store real passwords in LocalStorage; simulate login instead.',
])
def test_fictional_or_warning_auth_roadmap_is_allowed(monkeypatch, step):
    enable(monkeypatch)
    mock = AsyncMock(return_value=roadmap_with_step(step))
    monkeypatch.setattr(provider, 'generate', mock)
    response = client.post('/roadmap/generate', json={'idea': 'Build an educational login page'})
    assert response.status_code == 200 and mock.await_count == 1

def test_ai_assessment_requires_complete_rubric_and_evidence(monkeypatch):
    enable(monkeypatch)
    explanation='A detached node exists in memory. Insertion connects it to the document. Trim and reject blank input before inserting.'
    review=RubricReview(items=[{'criterion_index':i,'met':True,'evidence':e,'feedback':'Supported'} for i,e in enumerate(['A detached node exists in memory','Insertion connects it to the document','Trim and reject blank input before inserting'])],feedback='All explicit concepts are supported.')
    monkeypatch.setattr(provider,'generate',AsyncMock(return_value=review))
    body={'milestone_id':'add-task','explanation':explanation}
    assert client.post('/learning/evaluate',json=body).json()['passed'] is True
    review.items[0].evidence='Invented evidence absent from answer'
    assert client.post('/learning/evaluate',json=body).json()['passed'] is False
    review.items.pop()
    assert client.post('/learning/evaluate',json=body).status_code == 502

def test_browser_origin_is_rejected():
    assert client.post('/mentor/hint',json={'milestone_id':'add-task','level':1},headers={'Origin':'https://untrusted.example'}).status_code == 403

def test_provider_errors_are_sanitized(monkeypatch):
    monkeypatch.setattr(provider,'generate',AsyncMock(side_effect=ValueError('private secret data')))
    result=client.post('/roadmap/generate',json={'idea':'Build a book club page','level':'beginner'})
    assert result.status_code == 502
    assert 'private secret' not in result.text
