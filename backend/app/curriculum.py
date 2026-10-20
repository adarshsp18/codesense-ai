import json
from pathlib import Path

PROJECT = json.loads((Path(__file__).resolve().parents[2] / 'shared' / 'guided-projects.json').read_text(encoding='utf-8'))

def milestone(milestone_id: str) -> dict:
    return next(m for m in PROJECT['milestones'] if m['id'] == milestone_id)
