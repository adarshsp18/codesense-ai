from app.curriculum import milestone
from app.models import CustomHintRequest, HintOutput, HintRequest, HintResponse
from app.services import provider
from app.services.hint_validator import safe_hint

async def hint(request: HintRequest | CustomHintRequest) -> HintResponse:
    if isinstance(request, CustomHintRequest):
        fallback = [
            'Which concept in this milestone explains the behavior you want to observe?',
            'How does the behavior you observe differ from the milestone goal, and what might explain that difference?',
            'Describe a small example and predict its outcome. Compare that prediction with what you observe before changing your approach.',
        ][request.level - 1]
        payload = request.model_dump(exclude={'context_consent', 'kind'})
    else:
        m = milestone(request.milestone_id)
        fallback = m['hints'][request.level - 1]
        payload = request.model_dump(exclude={'context_consent'})
        payload['milestone'] = {key: m[key] for key in ['title', 'goal', 'concepts', 'acceptanceCriteria']}
    if not provider.configured():
        return HintResponse(text=fallback, source='Offline scripted hint', level=request.level)
    instructions = 'You are a Socratic coding mentor. Return one concise hint at the requested level, using the active milestone and any approved code context. When code is supplied, focus on one observable difference between that snippet and a milestone behavior if supported; do not invent missing behavior outside the snippet. If a review focus is provided, guide the learner to investigate that issue. Acceptance criteria are provisional; never claim implementation verification. If context is absent, do not pretend to have inspected code. For levels 1 and 2, ask a conceptual or targeted question: absolutely no code, backticks, markup, API method names, exact solution lines, or instructions that disclose the solution. Level 3 may explain a concept with a small example; never replace the whole implementation.'
    for attempt in range(2):
        try:
            result = await provider.generate(HintOutput, instructions, payload)
            if safe_hint(result.text, request.level):
                return HintResponse(text=result.text, source='AI hint (validated)', level=request.level)
            instructions += '\nYour previous output was rejected for code or solution leakage. Ask only a short conceptual question. Do not mention an API or an implementation step.'
        except Exception:
            break
    return HintResponse(text=fallback, source='Offline scripted fallback (AI unavailable or hint rejected)', level=request.level)
