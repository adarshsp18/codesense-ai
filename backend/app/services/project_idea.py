"""Conservative, local project-idea gate; it makes no provider requests."""

import re


PROJECT_IDEA_MESSAGE = (
    "CodeSense AI helps you build web interfaces. Please describe a website "
    "or web application you'd like to create."
)

INTERFACE = re.compile(
    r"\b(?:web\s*(?:site|page|app|application)|website|webpage|site|page|"
    r"app|application|interface|frontend|front\s*end|dashboard|portal|"
    r"form|storefront)\b",
    re.I,
)
PROJECT_TYPE = re.compile(
    r"\b(?:portfolio|blog|bookstore|marketplace|online\s+(?:store|shop)|"
    r"to[ -]?do\s+list|task\s+(?:list|manager|tracker)|quiz|calculator|"
    r"calendar|forum|catalog|gallery|chat\s+app|"
    r"(?:registration|booking|inventory|attendance|library|event|student|order)"
    r"\s+(?:management\s+)?system)\b",
    re.I,
)
PRODUCT = re.compile(r"\b(?:service|platform|tool|tracker|planner|directory|game)\b", re.I)
BUILD_INTENT = re.compile(r"\b(?:build|create|make|develop|design|code|implement)\b", re.I)
INFORMATION_REQUEST = re.compile(
    r"^\s*(?:what|who|when|where|why|how|which|is|are|tell\s+me|explain)\b", re.I
)
DISTRESS_STATEMENT = re.compile(
    r"\b(?:i\s+want\s+to\s+die|i\s+(?:want\s+to\s+)?kill\s+myself)\b", re.I
)
KEYBOARD_NOISE = re.compile(r"^(?:asdf\w*|qwerty\w*|zxcv\w*|[bcdfghjklmnpqrstvwxyz]{7,})$", re.I)
GENERIC_WORDS = {
    'a', 'an', 'the', 'i', 'we', 'my', 'our', 'me', 'want', 'need', 'would', 'like',
    'to', 'for', 'of', 'with', 'and', 'or', 'in', 'on', 'about', 'build', 'create',
    'make', 'develop', 'design', 'code', 'implement', 'simple', 'basic', 'beginner',
    'project', 'new', 'web', 'website', 'webpage', 'site', 'page', 'app',
    'application', 'interface', 'frontend', 'front', 'end', 'dashboard', 'portal',
    'form', 'system', 'service', 'platform', 'tool', 'tracker', 'planner',
    'directory', 'game', 'something', 'anything', 'thing', 'help', 'please',
}


def is_web_project_idea(idea: str) -> bool:
    """Require a recognizable interface goal; leave unclear ideas for clarification."""
    if DISTRESS_STATEMENT.search(idea):
        return False
    if INFORMATION_REQUEST.search(idea) and not BUILD_INTENT.search(idea):
        return False
    words = re.findall(r"[a-z]+", idea.lower())
    purpose = [
        word not in GENERIC_WORDS and len(word) > 2 and not KEYBOARD_NOISE.fullmatch(word)
        for word in words
    ]
    if PROJECT_TYPE.search(idea):
        return True
    if INTERFACE.search(idea):
        return any(purpose)
    return bool(PRODUCT.search(idea) and (BUILD_INTENT.search(idea) or sum(purpose) >= 2)
                and any(purpose))
