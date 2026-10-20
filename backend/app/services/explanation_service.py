from app.curriculum import milestone
from app.models import AssessmentResponse, ConceptQuestion, CustomExplanationRequest, CustomQuestionRequest, ExplanationRequest, RubricReview
from app.services import provider

def question(request: CustomQuestionRequest) -> ConceptQuestion:
    # Stable, visible rubric: retries always assess the same criteria. No model
    # is allowed to invent a passing grade or modify the assessment contract.
    concept = request.milestone.concepts[0]
    return ConceptQuestion(
        question=(f'Consider this learning point: {request.review_focus}. ' if request.review_focus else '')
        + f'In your own words, explain {concept}. How does it help achieve this milestone goal: {request.milestone.goal}? Predict one outcome or edge case and explain why it happens.',
        rubric=[
            f'Explain the meaning of {concept} accurately in your own words.',
            'Relate this concept to the active milestone goal with a clear reason.',
            'Predict a concrete outcome or edge case and explain the causal reasoning.',
        ],
    )


async def evaluate(request: ExplanationRequest | CustomExplanationRequest) -> AssessmentResponse:
    rubric = question(request).rubric if isinstance(request, CustomExplanationRequest) else milestone(request.milestone_id)['rubric']
    return await evaluate_rubric(request.explanation, rubric, request.milestone.model_dump() if isinstance(request, CustomExplanationRequest) else None)


async def evaluate_rubric(explanation: str, rubric: list[str], active_milestone: dict | None = None) -> AssessmentResponse:
    payload = {'explanation': explanation, 'rubric': list(enumerate(rubric))}
    if active_milestone is not None:
        payload['active_milestone'] = active_milestone
    result = await provider.generate(RubricReview, 'Evaluate the learner explanation against EVERY numbered rubric criterion. Return one item per index (zero based). A met criterion must quote exact supporting words from the learner explanation as evidence. Do not accept negated or contradictory claims. Missing concepts need constructive feedback. Never judge implementation correctness or infer general mastery.', payload)
    indexes = [item.criterion_index for item in result.items]
    if sorted(indexes) != list(range(len(rubric))):
        raise ValueError('Incomplete rubric assessment.')
    correct, missing = [], []
    for item in sorted(result.items, key=lambda i: i.criterion_index):
        # Evidence must be present, not a model confidence score.
        supported = item.met and len(item.evidence.strip()) >= 8 and item.evidence.casefold() in explanation.casefold()
        (correct if supported else missing).append(rubric[item.criterion_index])
    return AssessmentResponse(passed=not missing, source='AI rubric assessment', correct=correct, missing=missing, feedback=result.feedback)
