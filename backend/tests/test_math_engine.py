from app.services.math_engine import equivalent, validate_expression, validate_step

def test_equivalent_expression_accepts_algebraic_form():
    assert equivalent("2*(x+3)", "2*x+6")

def test_expression_feedback_for_wrong_answer():
    result = validate_expression("5", "4")
    assert not result.correct
    assert "equivalent" in result.feedback.lower()

def test_step_validation_preserves_equation_solution_set():
    result = validate_step("2*x + 3 = 11", "2*x = 8")
    assert result.correct

