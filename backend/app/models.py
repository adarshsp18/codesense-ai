from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator
from app.privacy import reject_sensitive

MilestoneId = Literal['html-structure', 'add-task']

class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)

class RoadmapRequest(StrictModel):
    idea: str = Field(min_length=8, max_length=2000)
    level: Literal['beginner', 'intermediate', 'advanced'] = 'beginner'

    @model_validator(mode='after')
    def no_secrets(self):
        reject_sensitive(self.idea)
        return self

class RoadmapMilestone(StrictModel):
    title: str = Field(min_length=1, max_length=150)
    goal: str = Field(min_length=1, max_length=800)
    concepts: list[str] = Field(min_length=1, max_length=8)
    expected_behaviors: list[str] = Field(min_length=1, max_length=8)
    steps: list[str] = Field(min_length=1, max_length=8)
    acceptance_criteria: list[str] = Field(min_length=1, max_length=8)

class Roadmap(StrictModel):
    title: str = Field(min_length=1, max_length=150)
    milestones: list[RoadmapMilestone] = Field(min_length=3, max_length=5)

class TestSummary(StrictModel):
    id: str = Field(max_length=80)
    passed: bool

class HintRequest(StrictModel):
    milestone_id: MilestoneId
    level: int = Field(ge=1, le=3)
    code_context: str = Field(default='', max_length=4000)
    context_consent: bool = Field(default=False, strict=True)
    test_results: list[TestSummary] = Field(default_factory=list, max_length=20)
    previous_hints: list[str] = Field(default_factory=list, max_length=10)

    @model_validator(mode='after')
    def approved_context(self):
        if self.code_context and not self.context_consent:
            raise ValueError('Code context requires explicit consent.')
        for value in [self.code_context, *self.previous_hints, *(r.id for r in self.test_results)]:
            reject_sensitive(value)
        return self

class HintOutput(StrictModel):
    text: str = Field(min_length=10, max_length=1500)

class HintResponse(HintOutput):
    source: str
    level: int

class ExplanationRequest(StrictModel):
    milestone_id: MilestoneId
    explanation: str = Field(min_length=20, max_length=3000)

    @model_validator(mode='after')
    def no_secrets(self):
        reject_sensitive(self.explanation)
        return self

class RubricItem(StrictModel):
    criterion_index: int
    met: bool
    evidence: str = Field(max_length=800)
    feedback: str = Field(max_length=800)

class RubricReview(StrictModel):
    items: list[RubricItem]
    feedback: str = Field(min_length=1, max_length=1500)

class AssessmentResponse(StrictModel):
    passed: bool
    source: str
    correct: list[str]
    missing: list[str]
    feedback: str


CustomText = Annotated[str, Field(min_length=1, max_length=800)]


class CustomMilestone(RoadmapMilestone):
    concepts: list[CustomText] = Field(min_length=1, max_length=8)
    expected_behaviors: list[CustomText] = Field(min_length=1, max_length=8)
    steps: list[CustomText] = Field(min_length=1, max_length=8)
    acceptance_criteria: list[CustomText] = Field(min_length=1, max_length=8)


class CustomQuestionRequest(StrictModel):
    kind: Literal['custom']
    milestone: CustomMilestone
    review_focus: str | None = Field(default=None, max_length=300)

    @model_validator(mode='after')
    def no_secrets(self):
        def check(value):
            if isinstance(value, str):
                reject_sensitive(value)
            elif isinstance(value, dict):
                for item in value.values():
                    check(item)
            elif isinstance(value, list):
                for item in value:
                    check(item)
        check(self.model_dump())
        return self


class ConceptQuestion(StrictModel):
    question: str
    rubric: list[str]


class CustomHintRequest(CustomQuestionRequest):
    level: int = Field(ge=1, le=3)
    code_context: str = Field(default='', max_length=4000)
    context_consent: bool = Field(default=False, strict=True)
    previous_hints: list[Annotated[str, Field(max_length=1500)]] = Field(default_factory=list, max_length=10)

    @model_validator(mode='after')
    def approved_context(self):
        if self.code_context and not self.context_consent:
            raise ValueError('Code context requires explicit consent.')
        return self


class CustomExplanationRequest(CustomQuestionRequest):
    explanation: str = Field(min_length=20, max_length=3000)


class ReviewObservation(StrictModel):
    observation: str = Field(min_length=1, max_length=400)
    evidence: str = Field(min_length=1, max_length=400)


class CustomReviewResponse(StrictModel):
    review_summary: str = Field(min_length=1, max_length=500)
    satisfied: list[Annotated[str, Field(min_length=1, max_length=400)]] = Field(max_length=5)
    potential_issues: list[Annotated[str, Field(min_length=1, max_length=400)]] = Field(max_length=5)
    observations: list[ReviewObservation] = Field(max_length=5)
    cannot_verify: list[Annotated[str, Field(min_length=1, max_length=400)]] = Field(max_length=5)
    next_actions: list[Annotated[str, Field(min_length=1, max_length=400)]] = Field(min_length=2, max_length=3)
    verification_status: Literal['unverified']


class CustomReviewRequest(StrictModel):
    kind: Literal['custom']
    project_id: str = Field(pattern=r'^[a-f0-9-]{36}$')
    milestone_index: int = Field(ge=0, le=4)
    milestone: CustomMilestone
    code_context: str = Field(min_length=1, max_length=4000)
    context_consent: Literal[True]

    @model_validator(mode='after')
    def approved_context(self):
        def check(value):
            if isinstance(value, str):
                reject_sensitive(value)
            elif isinstance(value, dict):
                for item in value.values():
                    check(item)
            elif isinstance(value, list):
                for item in value:
                    check(item)
        check(self.model_dump())
        return self
