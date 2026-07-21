SUBJECTS = [
    {"id": "mathematics", "name": "Mathematics", "regions": ["Arithmetic Plains", "Fraction Forest", "Algebra City", "Function Valley", "Probability Isles", "Calculus Peaks"]},
    {"id": "english", "name": "English", "regions": ["Vocabulary Grove", "Grammar District", "Reading Archives", "Writing Workshop", "Argumentation Court"]},
]

SKILLS = [
    {"id": "arith-number-sense", "subject": "mathematics", "name": "Number sense", "difficulty": 1, "prerequisites": [], "objectives": ["Compare values", "Estimate results"]},
    {"id": "frac-equivalence", "subject": "mathematics", "name": "Equivalent fractions", "difficulty": 2, "prerequisites": ["arith-number-sense"], "objectives": ["Simplify fractions", "Recognize equal ratios"]},
    {"id": "alg-linear-equations", "subject": "mathematics", "name": "Linear equations", "difficulty": 3, "prerequisites": ["frac-equivalence"], "objectives": ["Solve one-variable equations", "Explain inverse operations"]},
    {"id": "func-notation", "subject": "mathematics", "name": "Function notation", "difficulty": 4, "prerequisites": ["alg-linear-equations"], "objectives": ["Evaluate functions", "Interpret domain"]},
    {"id": "prob-intro", "subject": "mathematics", "name": "Introductory probability", "difficulty": 3, "prerequisites": ["frac-equivalence"], "objectives": ["Build sample spaces", "Compute simple probabilities"]},
    {"id": "calc-derivative-intro", "subject": "mathematics", "name": "Derivative meaning", "difficulty": 5, "prerequisites": ["func-notation"], "objectives": ["Connect slope and rate", "Interpret derivative values"]},
    {"id": "vocab-context", "subject": "english", "name": "Vocabulary in context", "difficulty": 1, "prerequisites": [], "objectives": ["Use context clues", "Distinguish connotation"]},
    {"id": "grammar-agreement", "subject": "english", "name": "Subject-verb agreement", "difficulty": 2, "prerequisites": ["vocab-context"], "objectives": ["Identify subjects", "Choose matching verbs"]},
    {"id": "reading-main-idea", "subject": "english", "name": "Main idea and evidence", "difficulty": 2, "prerequisites": ["vocab-context"], "objectives": ["Find central claims", "Select supporting evidence"]},
    {"id": "writing-paragraph", "subject": "english", "name": "Paragraph writing", "difficulty": 3, "prerequisites": ["grammar-agreement", "reading-main-idea"], "objectives": ["Write topic sentences", "Use transitions"]},
    {"id": "argument-evidence", "subject": "english", "name": "Claims and evidence", "difficulty": 4, "prerequisites": ["writing-paragraph"], "objectives": ["Support claims", "Explain reasoning"]},
]

def graph_for(skill_id: str) -> dict:
    skill = next(item for item in SKILLS if item["id"] == skill_id)
    children = [item for item in SKILLS if skill_id in item["prerequisites"]]
    return {"skill": skill, "prerequisites": [s for s in SKILLS if s["id"] in skill["prerequisites"]], "unlocks": children}

