"""Conservative secret screening; consent and human review are still required."""
import re

SECRET = re.compile(
    r'AIza[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9_-]{12,}|'
    r'gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|'
    r'xox[baprs]-[A-Za-z0-9-]{16,}|'
    r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|'
    r'AKIA[A-Z0-9]{16}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|'
    r'(?:authorization|api[_-]?key|secret|password|access[_-]?token|auth[_-]?token|token)\s*[\"\']?\s*[:=]|'
    r'\bBearer\s+[A-Za-z0-9._~+/-]{12,}',
    re.I,
)


def reject_sensitive(text: str) -> None:
    if SECRET.search(text):
        raise ValueError('Possible secret detected. Remove sensitive content before sharing.')
