from __future__ import annotations

from dataclasses import dataclass
from sympy import Eq, simplify, sympify

MISCONCEPTIONS = {
    "negative_product": "A negative times a negative becomes positive.",
    "fraction_denominator": "Fractions need a common denominator before adding.",
    "inverse_operation": "Use the inverse operation on both sides to preserve equality.",
    "distribution": "Distribute multiplication to every term inside parentheses.",
}

@dataclass
class ValidationResult:
    correct: bool
    feedback: str
    misconception: str | None = None

def equivalent(left: str, right: str) -> bool:
    try:
        return simplify(sympify(left) - sympify(right)) == 0
    except Exception:
        return False

def validate_expression(answer: str, expected: str) -> ValidationResult:
    if equivalent(answer, expected):
        return ValidationResult(True, "Equivalent answer accepted.")
    if "/" in answer and "+/" in answer.replace(" ", ""):
        return ValidationResult(False, MISCONCEPTIONS["fraction_denominator"], "fraction_denominator")
    if "--" in answer or "+-" in answer:
        return ValidationResult(False, "Check how the signs combine before simplifying.", "negative_product")
    return ValidationResult(False, "Not equivalent yet. Try simplifying both expressions and compare terms.")

def validate_step(previous: str, current: str) -> ValidationResult:
    try:
        if "=" in previous and "=" in current:
            left_prev, right_prev = previous.split("=", 1)
            left_cur, right_cur = current.split("=", 1)
            if simplify(sympify(left_prev) - sympify(right_prev)) == simplify(sympify(left_cur) - sympify(right_cur)):
                return ValidationResult(True, "This transformation preserves equality.")
        elif equivalent(previous, current):
            return ValidationResult(True, "This simplification is equivalent.")
    except Exception:
        pass
    return ValidationResult(False, MISCONCEPTIONS["inverse_operation"], "inverse_operation")
