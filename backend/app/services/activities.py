from __future__ import annotations

ACTIVITIES = [
    {"id": "linear-1", "skill_id": "alg-linear-equations", "type": "equation", "prompt": "Solve for x: 2*x + 3 = 11", "answer": "4", "difficulty": 3, "hints": ["Undo +3 first.", "Subtract 3 from both sides.", "Then divide both sides by 2."]},
    {"id": "fraction-1", "skill_id": "frac-equivalence", "type": "numeric", "prompt": "Simplify 6/8.", "answer": "3/4", "difficulty": 2, "hints": ["Find a common factor.", "Divide numerator and denominator by 2."]},
    {"id": "agreement-1", "skill_id": "grammar-agreement", "type": "sentence", "prompt": "Choose the correct verb: The list of reasons (is/are) persuasive.", "answer": "is", "difficulty": 2, "hints": ["Find the subject before the prepositional phrase.", "The subject is list."]},
    {"id": "argument-1", "skill_id": "argument-evidence", "type": "open", "prompt": "Write a claim about school gardens and support it with one concrete reason.", "answer": "rubric", "difficulty": 4, "hints": ["Make a debatable claim.", "Add a because statement with evidence."]},
]

def next_activity(skill_id: str | None = None) -> dict:
    return next((item for item in ACTIVITIES if skill_id is None or item["skill_id"] == skill_id), ACTIVITIES[0])
