from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models import Roadmap
from app.services import provider
from app.services.project_idea import PROJECT_IDEA_MESSAGE


client = TestClient(app)
ROADMAP = Roadmap(
    title='Practice project',
    milestones=[
        {
            'title': f'Milestone {index}',
            'goal': 'Build an accessible interface',
            'concepts': ['HTML'],
            'expected_behaviors': ['A labelled form is visible'],
            'steps': ['Plan the interface'],
            'acceptance_criteria': ['The form has labels'],
        }
        for index in range(3)
    ],
)


@pytest.mark.parametrize('idea', [
    'Build a login and registration page.',
    'A footwear shopping website.',
    'I want a portfolio.',
    'College event registration system.',
    'A to-do list.',
    'An online bookstore.',
    'A website for mental health awareness.',
    'Create a food delivery service.',
    'A puzzle game for learning multiplication.',
])
def test_real_project_ideas_keep_existing_roadmap_schema(monkeypatch, idea):
    mock = AsyncMock(return_value=ROADMAP)
    monkeypatch.setattr(provider, 'generate', mock)
    response = client.post('/roadmap/generate', json={'idea': idea, 'level': 'beginner'})
    assert response.status_code == 200
    assert response.json()['verification'] == 'unavailable'
    assert len(response.json()['milestones']) == 3
    mock.assert_awaited_once()


@pytest.mark.parametrize('idea', [
    'What is the weather today?',
    'I want to die.',
    'qzxvbnm asdfghjkl',
    'asdfghjkl website',
    'How does a food delivery service work?',
    'Build something cool.',
    'I want a website.',
])
def test_unrelated_or_ambiguous_ideas_never_reach_provider(monkeypatch, idea):
    mock = AsyncMock(side_effect=AssertionError('Provider must not be called'))
    monkeypatch.setattr(provider, 'generate', mock)
    response = client.post('/roadmap/generate', json={'idea': idea, 'level': 'beginner'})
    assert response.status_code == 422
    assert response.json()['error']['message'] == PROJECT_IDEA_MESSAGE
    assert idea not in response.text
    mock.assert_not_awaited()


def test_short_nonproject_idea_uses_same_sanitized_message(monkeypatch):
    mock = AsyncMock(side_effect=AssertionError('Provider must not be called'))
    monkeypatch.setattr(provider, 'generate', mock)
    response = client.post('/roadmap/generate', json={'idea': 'asdf', 'level': 'beginner'})
    assert response.status_code == 422
    assert response.json()['error']['message'] == PROJECT_IDEA_MESSAGE
    mock.assert_not_awaited()
