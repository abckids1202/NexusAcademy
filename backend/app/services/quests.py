QUESTS = [
    {"id": "bridge-equations", "title": "Bridge of Balanced Forces", "subject": "mathematics", "skill_id": "alg-linear-equations", "stages": ["diagnose", "repair", "solve", "explain"], "boss": "The Sign Weaver"},
    {"id": "council-argument", "title": "Council of Evidence", "subject": "english", "skill_id": "argument-evidence", "stages": ["claim", "evidence", "revise", "defend"], "boss": "The Hollow Argument"},
]

def start_quest(quest_id: str, user_id: str) -> dict:
    quest = next(q for q in QUESTS if q["id"] == quest_id)
    return {"id": f"run-{quest_id}-{user_id[:6]}", "quest": quest, "stage_index": 0, "status": "active", "inventory": {"hint_tokens": 3, "retry_tokens": 2}}

def complete_stage(run: dict) -> dict:
    run["stage_index"] += 1
    if run["stage_index"] >= len(run["quest"]["stages"]):
        run["status"] = "completed"
        run["reward"] = {"xp": 120, "item": "Evidence Compass"}
    return run

