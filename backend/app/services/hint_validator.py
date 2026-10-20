"""Conservative heuristic, not a proof against every paraphrased disclosure."""
import re

PATTERNS = [
    r'`', r'~~~', r'<\s*/?\s*[a-z][^>]*>',
    r'(?m)^\s*(?:\$|>>>|\d+\s*[:|])\s*\S+',
    r'\b[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\s*(?:\+\+|--|(?:\+|-|\*|/|%|&&|\|\||\?\?)?=(?!=)|===?|!==?|<=?|>=?)\s*(?:[\w$]|[\'\"{\[(])',
    r'\b[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?\s*(?:\+|-|\*|/|%|&&|\|\|)\s*(?:\d+|[A-Za-z_$][\w$]*)\b',
    r'\b[A-Za-z_$][\w$]*\s*\([^()]{0,80}\)',
    r'\b(?:const|let|var)\s+[A-Za-z_$][\w$]*\b',
    r'\breturn\s+(?:true|false|null|undefined|[A-Za-z_$][\w$]*|\d+)\b',
    r'\b(?:change|replace|edit|fix)\s+(?:the\s+)?line\s*\d+\b',
    r'\b(?:paste|copy)\s+(?:this|the\s+following)\s+line\b',
    r'\b(?:const|let|var)\s+\w+\s*=', r'\bfunction\s*[\w]*\s*\(', r'=>',
    r'\b(?:if|for|while)\s*\(', r'\breturn\s+[^?.!]+;',
    r'\b\w+\s*\([^)]*\)\s*;', r'\b\w+\s*\([^)]*[\'\"][^)]*\)',
    r'\b(?:document|window)\s*\.', r'\b\w+\s*\.\s*\w+\s*(?:\(|=)',
    r'\b(?:appendChild|createElement|addEventListener|querySelector|textContent|innerHTML|aria-label|aria-describedby)\b',
    r'\b(?:input|item|list|button|task)\s*\.\s*\w+', r'\b\w+\s*=\s*[\'\"\d]',
    r'\b(?:use|call|write|add|set|attach|insert|append|assign|clear|reset|trim|connect|bind|register)\b.{0,80}\b(?:listener|handler|node|element|list|button|input|value|label|attribute|text|click|empty string)\b',
    r'\b(?:the solution is|replace.{0,40}with|exact code|copy this|set.{0,30}to empty)\b',
]

def safe_hint(text: str, level: int) -> bool:
    if not isinstance(text, str) or not 10 <= len(text) <= 1500:
        return False
    if level == 3:
        return True
    if level not in (1, 2):
        return False
    return not any(re.search(pattern, text, re.I | re.S) for pattern in PATTERNS)
