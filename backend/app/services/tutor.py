from __future__ import annotations

from app.services.activities import ACTIVITIES

HELP_LADDER = [
    "Let us clarify what the question is asking before solving.",
    "List the known information and the target.",
    "What have you tried so far?",
    "I see a likely misconception: check the operation you applied.",
    "Small hint: work on one transformation at a time.",
    "Stronger hint: use the inverse operation on both sides.",
    "Related example: if 2x + 1 = 7, subtract 1, then divide by 2.",
    "Partial method: isolate the variable term first.",
    "Full solution is appropriate now; after it, explain why each step is valid.",
    "Reflection: describe the solution in your own words.",
]

def respond(message: str, activity_id: str | None, help_level: int) -> dict:
    activity = next((a for a in ACTIVITIES if a["id"] == activity_id), None)
    hint = HELP_LADDER[min(max(help_level, 1), 10) - 1]
    if activity:
        hint = f"{hint} Current activity: {activity['prompt']}"
    return {
        "role": "assistant",
        "content": hint,
        "help_level": help_level,
        "safety": "Guidance preserves learner thinking and withholds final answers until later ladder levels.",
    }
