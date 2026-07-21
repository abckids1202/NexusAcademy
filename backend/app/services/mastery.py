def update_mastery(current: float, correct: bool, difficulty: int, used_hints: int, confidence: int) -> dict:
    evidence_weight = min(0.18, 0.06 + difficulty * 0.02)
    hint_penalty = min(0.08, used_hints * 0.02)
    confidence_bonus = 0.02 if correct and confidence >= 4 else 0
    delta = evidence_weight - hint_penalty + confidence_bonus if correct else -(0.06 + difficulty * 0.01)
    score = max(0, min(1, round(current + delta, 3)))
    return {
        "score": score,
        "delta": round(score - current, 3),
        "reason": "Updated from accuracy, difficulty, hint dependence, and confidence calibration.",
        "retention_check_due": score >= 0.65,
    }

def recommend(skills: list[dict], mastery: dict[str, float]) -> list[dict]:
    ready = []
    for skill in skills:
        prereq_ok = all(mastery.get(pid, 0) >= 0.45 for pid in skill["prerequisites"])
        score = mastery.get(skill["id"], 0)
        if prereq_ok and score < 0.8:
            ready.append({"skill": skill, "why": f"Recommended because prerequisites are ready and mastery is {score:.0%}."})
    return ready[:5]

