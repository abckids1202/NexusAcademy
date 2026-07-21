from app.services.mastery import recommend, update_mastery
from app.services.curriculum import SKILLS
from app.services.writing import analyze_writing
from app.services.tutor import respond

def test_mastery_rewards_correct_independent_work():
    result = update_mastery(0.4, correct=True, difficulty=3, used_hints=0, confidence=4)
    assert result["score"] > 0.4
    assert "reason" in result

def test_recommendation_explains_why():
    result = recommend(SKILLS, {"arith-number-sense": 0.6})
    assert result
    assert "why" in result[0]

def test_writing_feedback_is_structured():
    feedback = analyze_writing("School gardens help students because they make science visible.", "argumentative")
    assert "revision_plan" in feedback
    assert isinstance(feedback["priority_improvements"], list)

def test_tutor_uses_help_ladder():
    reply = respond("I am stuck", "linear-1", 5)
    assert reply["help_level"] == 5
    assert "thinking" in reply["safety"]

