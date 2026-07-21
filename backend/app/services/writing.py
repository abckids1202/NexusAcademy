def analyze_writing(content: str, writing_type: str) -> dict:
    words = [w.strip(".,!?;:").lower() for w in content.split() if w.strip()]
    sentences = [s for s in content.replace("!", ".").replace("?", ".").split(".") if s.strip()]
    has_evidence = any(marker in words for marker in ["because", "evidence", "for", "example", "data"])
    feedback = {
        "strengths": [],
        "priority_improvements": [],
        "sentence_level_issues": [],
        "structural_issues": [],
        "revision_plan": [],
        "confidence": "medium",
    }
    feedback["strengths"].append("The draft is long enough to evaluate." if len(words) >= 30 else "The draft has a clear starting point.")
    if writing_type == "argumentative" and not has_evidence:
        feedback["priority_improvements"].append("Add concrete evidence after the main claim.")
    if len(sentences) < 3:
        feedback["structural_issues"].append("Develop at least three sentences: claim, evidence, and reasoning.")
    if any(len(sentence.split()) > 28 for sentence in sentences):
        feedback["sentence_level_issues"].append("Split long sentences so the reasoning is easier to follow.")
    feedback["revision_plan"] = ["Underline the main claim.", "Add one specific example or fact.", "Explain how the evidence supports the claim.", "Read aloud for sentence clarity."]
    return feedback

