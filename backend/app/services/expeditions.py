from __future__ import annotations

from app.services.curriculum import SKILLS

def generate_plan(goal: str, session_minutes: int, subject: str | None = None) -> dict:
    lowered = goal.lower()
    candidates = [s for s in SKILLS if (not subject or s["subject"] == subject) and any(token in lowered for token in s["name"].lower().split())]
    if not candidates:
        candidates = [s for s in SKILLS if not subject or s["subject"] == subject][:3]
    return {
        "goal": goal,
        "session_minutes": session_minutes,
        "route": [{"skill_id": s["id"], "activity": "lesson-practice-reflection", "minutes": max(10, session_minutes // len(candidates))} for s in candidates],
        "why": "Plan selected from goal keywords, prerequisites, and MVP curriculum coverage.",
        "adaptation_rule": "After each activity, raise difficulty after correct independent answers or schedule prerequisite repair after repeated misconception evidence.",
    }
