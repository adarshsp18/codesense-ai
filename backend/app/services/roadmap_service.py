import re

from app.models import Roadmap, RoadmapRequest
from app.services import provider


STORAGE = re.compile(r'\b(?:local\s*storage|localStorage)\b', re.I)
CREDENTIAL = re.compile(r'\b(?:passwords?|passphrases?|credentials?|secrets?|api[_ -]?keys?|access[_ -]?tokens?|auth[_ -]?tokens?)\b', re.I)
STORE = re.compile(r'\b(?:stor(?:e|ed|ing)|sav(?:e|ed|ing)|persist|cache|cached|keep|kept|write|put|place|hold|use)\b', re.I)
NEGATED = re.compile(r"\b(?:never|avoid|do not|don't|must not|should not)\b.{0,60}\b(?:stor(?:e|ed|ing)|sav(?:e|ed|ing)|persist|cache|keep|write|put|place|hold|use)\b", re.I)
FICTIONAL = re.compile(r'\b(?:fictional|fake|mock|dummy|placeholder|test-only|simulated|made-up)\b', re.I)
REAL = re.compile(r'\b(?:real|actual|production|live|plaintext|plain-text)\b', re.I)


def unsafe_auth_advice(roadmap: Roadmap) -> bool:
    """Reject clear affirmative advice to put non-fictional credentials in LocalStorage."""
    for milestone in roadmap.milestones:
        for value in [milestone.title, milestone.goal, *milestone.concepts,
                      *milestone.expected_behaviors, *milestone.steps,
                      *milestone.acceptance_criteria]:
            for sentence in re.split(r'(?<=[.!?;])\s+|\n+', value):
                if (STORAGE.search(sentence) and CREDENTIAL.search(sentence)
                        and STORE.search(sentence) and not NEGATED.search(sentence)
                        and (REAL.search(sentence) or not FICTIONAL.search(sentence))):
                    return True
    return False


async def roadmap(request: RoadmapRequest) -> dict:
    instructions = ('Create a beginner-friendly web project roadmap for the requested level with 3 or 4 milestones. '
                    'Per milestone: one short-sentence goal; 2-3 concepts; 1-2 observable behaviors; '
                    '2-3 brief steps; 1-2 provisional acceptance criteria. Keep each list item under 16 words. '
                    'No executable tests or claims of verification or completion. '
                    'Authentication examples must use fictional credentials only; never recommend storing '
                    'real passwords or production credentials in LocalStorage.')
    for attempt in range(2):
        result = await provider.generate(Roadmap, instructions, request.model_dump())
        if not unsafe_auth_advice(result):
            break
        if attempt == 1:
            raise provider.AIServiceError('AI roadmap failed the credential-storage safety check. Retry or revise the project idea.')
        instructions += ('\nRegenerate safely: no storage of real passwords or production credentials in LocalStorage. '
                         'Explicitly fictional mock credentials are allowed.')
    data = result.model_dump()
    data['source'] = 'AI-generated roadmap'
    data['verification'] = 'unavailable'
    for item in data['milestones']:
        item['verification'] = 'Automated verification is not available for this custom milestone yet.'
    return data
