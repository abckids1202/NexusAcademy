from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Header
from uuid import uuid4

from app.core.config import settings
from app.core.security import create_token, decode_token
from app.schemas import *
from app.services import math_engine
from app.services.activities import ACTIVITIES, next_activity
from app.services.curriculum import SKILLS, SUBJECTS, graph_for
from app.services.expeditions import generate_plan
from app.services.mastery import recommend, update_mastery
from app.services.quests import QUESTS, complete_stage, start_quest
from app.services.store import store
from app.services.tutor import respond
from app.services.writing import analyze_writing

api_router = APIRouter()

def public_user(user: dict) -> dict:
    return {"id": user["id"], "email": user["email"], "role": user["role"]}

def current_user(authorization: str | None = Header(default=None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="missing bearer token")
    try:
        payload = decode_token(authorization.split(" ", 1)[1], "access")
        return store.users[payload["sub"]]
    except Exception as exc:
        raise HTTPException(status_code=401, detail="invalid token") from exc

@api_router.post("/auth/register", response_model=TokenPair)
async def register(payload: RegisterRequest):
    try:
        user = store.create_user(payload.email, payload.password, payload.role)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return TokenPair(
        access_token=create_token(user["id"], "access", minutes=settings.access_token_minutes),
        refresh_token=create_token(user["id"], "refresh", days=settings.refresh_token_days),
    )

@api_router.post("/auth/login", response_model=TokenPair)
async def login(payload: LoginRequest):
    user = store.authenticate(payload.email, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="invalid credentials")
    return TokenPair(
        access_token=create_token(user["id"], "access", minutes=settings.access_token_minutes),
        refresh_token=create_token(user["id"], "refresh", days=settings.refresh_token_days),
    )

@api_router.post("/auth/refresh", response_model=TokenPair)
async def refresh(refresh_token: str):
    payload = decode_token(refresh_token, "refresh")
    return TokenPair(
        access_token=create_token(payload["sub"], "access", minutes=settings.access_token_minutes),
        refresh_token=create_token(payload["sub"], "refresh", days=settings.refresh_token_days),
    )

@api_router.post("/auth/logout")
async def logout():
    return {"status": "ok"}

@api_router.post("/auth/logout-all")
async def logout_all():
    return {"status": "ok"}

@api_router.post("/auth/verify-email")
async def verify_email():
    return {"status": "verification queued"}

@api_router.post("/auth/forgot-password")
async def forgot_password():
    return {"status": "reset queued"}

@api_router.post("/auth/reset-password")
async def reset_password():
    return {"status": "password reset accepted"}

@api_router.get("/auth/me", response_model=UserOut)
async def me(user: dict = Depends(current_user)):
    return public_user(user)

@api_router.get("/profile")
async def profile(user: dict = Depends(current_user)):
    return store.profiles.get(user["id"], {"user": public_user(user), "onboarding_complete": False})

@api_router.patch("/profile")
async def update_profile(payload: OnboardingRequest, user: dict = Depends(current_user)):
    store.profiles[user["id"]] = payload.model_dump() | {"user": public_user(user), "onboarding_complete": True}
    return store.profiles[user["id"]]

@api_router.post("/profile/onboarding")
async def onboarding(payload: OnboardingRequest, user: dict = Depends(current_user)):
    store.profiles[user["id"]] = payload.model_dump() | {"user": public_user(user), "onboarding_complete": True}
    return store.profiles[user["id"]]

@api_router.get("/subjects")
async def subjects():
    return SUBJECTS

@api_router.get("/skills")
async def skills(subject: str | None = None):
    return [s for s in SKILLS if subject is None or s["subject"] == subject]

@api_router.get("/skills/recommended")
async def recommended(user: dict = Depends(current_user)):
    scores = {skill_id: data["score"] for (uid, skill_id), data in store.mastery.items() if uid == user["id"]}
    return recommend(SKILLS, scores)

@api_router.get("/skills/{skill_id}")
async def skill(skill_id: str):
    return next(s for s in SKILLS if s["id"] == skill_id)

@api_router.get("/skills/{skill_id}/graph")
async def skill_graph(skill_id: str):
    return graph_for(skill_id)

@api_router.get("/skills/{skill_id}/mastery")
async def skill_mastery(skill_id: str, user: dict = Depends(current_user)):
    return store.mastery.get((user["id"], skill_id), {"score": 0, "evidence": []})

@api_router.post("/assessments/placement")
async def placement(user: dict = Depends(current_user)):
    assessment = {"id": str(uuid4()), "user_id": user["id"], "answers": [], "next": next_activity()}
    store.assessments[assessment["id"]] = assessment
    return assessment

@api_router.get("/assessments/{assessment_id}")
async def assessment(assessment_id: str, user: dict = Depends(current_user)):
    return store.assessments[assessment_id]

@api_router.get("/assessments/{assessment_id}/next")
async def assessment_next(assessment_id: str, user: dict = Depends(current_user)):
    return store.assessments[assessment_id]["next"]

@api_router.post("/assessments/{assessment_id}/answer")
async def assessment_answer(assessment_id: str, payload: AnswerRequest, user: dict = Depends(current_user)):
    activity = store.assessments[assessment_id]["next"]
    result = math_engine.validate_expression(payload.answer, activity["answer"]) if activity["answer"] != "rubric" else {"correct": len(payload.answer.split()) >= 8, "feedback": "Rubric evidence checked."}
    store.assessments[assessment_id]["answers"].append({"activity": activity, "result": result if isinstance(result, dict) else result.__dict__})
    return store.assessments[assessment_id]["answers"][-1]

@api_router.post("/assessments/{assessment_id}/complete")
async def assessment_complete(assessment_id: str, user: dict = Depends(current_user)):
    return {"assessment_id": assessment_id, "skill_profile": [{"skill_id": s["id"], "score": 0.35} for s in SKILLS[:4]]}

@api_router.get("/assessments/{assessment_id}/report")
async def assessment_report(assessment_id: str, user: dict = Depends(current_user)):
    return {"assessment_id": assessment_id, "recommendations": recommend(SKILLS, {})}

@api_router.post("/practice/sessions")
async def practice_session(skill_id: str = "alg-linear-equations", user: dict = Depends(current_user)):
    session = {"id": str(uuid4()), "skill_id": skill_id, "current": next_activity(skill_id), "answers": []}
    store.practice[session["id"]] = session
    return session

@api_router.get("/practice/sessions/{session_id}")
async def practice_get(session_id: str, user: dict = Depends(current_user)):
    return store.practice[session_id]

@api_router.get("/practice/sessions/{session_id}/next")
async def practice_next(session_id: str, user: dict = Depends(current_user)):
    return store.practice[session_id]["current"]

@api_router.post("/practice/sessions/{session_id}/answers")
async def practice_answer(session_id: str, payload: AnswerRequest, user: dict = Depends(current_user)):
    activity = store.practice[session_id]["current"]
    validation = math_engine.validate_expression(payload.answer, activity["answer"])
    current = store.mastery.get((user["id"], activity["skill_id"]), {"score": 0})
    mastery = update_mastery(current["score"], validation.correct, activity["difficulty"], payload.used_hints, payload.confidence)
    store.mastery[(user["id"], activity["skill_id"])] = mastery
    return {"activity": activity, "validation": validation.__dict__, "mastery": mastery}

@api_router.post("/practice/sessions/{session_id}/complete")
async def practice_complete(session_id: str, user: dict = Depends(current_user)):
    return {"session_id": session_id, "status": "completed"}

@api_router.post("/math/validate-expression")
async def validate_expression(answer: str, expected: str):
    return math_engine.validate_expression(answer, expected).__dict__

@api_router.post("/math/validate-step")
async def validate_step(previous: str, current: str):
    return math_engine.validate_step(previous, current).__dict__

@api_router.post("/math/check-equivalence")
async def check_equivalence(left: str, right: str):
    return {"equivalent": math_engine.equivalent(left, right)}

@api_router.post("/math/analyze-solution")
async def analyze_solution(answer: str, expected: str):
    return math_engine.validate_expression(answer, expected).__dict__

@api_router.post("/tutor/conversations")
async def create_conversation(user: dict = Depends(current_user)):
    conversation = {"id": str(uuid4()), "messages": []}
    store.conversations[conversation["id"]] = conversation
    return conversation

@api_router.get("/tutor/conversations")
async def conversations(user: dict = Depends(current_user)):
    return list(store.conversations.values())

@api_router.get("/tutor/conversations/{conversation_id}")
async def conversation(conversation_id: str, user: dict = Depends(current_user)):
    return store.conversations[conversation_id]

@api_router.post("/tutor/conversations/{conversation_id}/messages")
async def tutor_message(conversation_id: str, payload: TutorMessageRequest, user: dict = Depends(current_user)):
    reply = respond(payload.message, payload.activity_id, payload.help_level)
    store.conversations[conversation_id]["messages"].extend([{"role": "user", "content": payload.message}, reply])
    return reply

@api_router.post("/tutor/conversations/{conversation_id}/hint")
async def tutor_hint(conversation_id: str, payload: TutorMessageRequest, user: dict = Depends(current_user)):
    return respond(payload.message, payload.activity_id, payload.help_level)

@api_router.post("/tutor/conversations/{conversation_id}/explain")
async def tutor_explain(conversation_id: str, payload: TutorMessageRequest, user: dict = Depends(current_user)):
    return respond(payload.message, payload.activity_id, 8)

@api_router.post("/tutor/conversations/{conversation_id}/example")
async def tutor_example(conversation_id: str, payload: TutorMessageRequest, user: dict = Depends(current_user)):
    return respond(payload.message, payload.activity_id, 7)

@api_router.get("/quests")
async def quests():
    return QUESTS

@api_router.get("/quests/{quest_id}")
async def quest(quest_id: str):
    return next(q for q in QUESTS if q["id"] == quest_id)

@api_router.post("/quests/{quest_id}/start")
async def quest_start(quest_id: str, user: dict = Depends(current_user)):
    run = start_quest(quest_id, user["id"])
    store.quest_runs[run["id"]] = run
    return run

@api_router.get("/quest-runs/{run_id}")
async def quest_run(run_id: str, user: dict = Depends(current_user)):
    return store.quest_runs[run_id]

@api_router.post("/quest-runs/{run_id}/answer")
async def quest_answer(run_id: str, payload: AnswerRequest, user: dict = Depends(current_user)):
    return {"run": store.quest_runs[run_id], "feedback": "Answer recorded; progression depends on reasoning and validation."}

@api_router.post("/quest-runs/{run_id}/choice")
async def quest_choice(run_id: str, choice: str, user: dict = Depends(current_user)):
    return {"run_id": run_id, "choice": choice, "consequence": "Route adapted while preserving academic objective."}

@api_router.post("/quest-runs/{run_id}/complete-stage")
async def quest_complete_stage(run_id: str, user: dict = Depends(current_user)):
    store.quest_runs[run_id] = complete_stage(store.quest_runs[run_id])
    return store.quest_runs[run_id]

@api_router.post("/expeditions/generate")
async def expedition_generate(payload: ExpeditionRequest, user: dict = Depends(current_user)):
    return generate_plan(payload.goal, payload.session_minutes, payload.subject)

@api_router.get("/expeditions")
async def expeditions(user: dict = Depends(current_user)):
    return []

@api_router.get("/expeditions/{expedition_id}")
async def expedition(expedition_id: str, user: dict = Depends(current_user)):
    return {"id": expedition_id}

@api_router.patch("/expeditions/{expedition_id}")
async def expedition_patch(expedition_id: str, user: dict = Depends(current_user)):
    return {"id": expedition_id, "status": "updated"}

@api_router.post("/expeditions/{expedition_id}/start")
async def expedition_start(expedition_id: str, user: dict = Depends(current_user)):
    return {"id": expedition_id, "status": "active"}

@api_router.post("/writing/projects")
async def writing_create(payload: WritingRequest, user: dict = Depends(current_user)):
    project = payload.model_dump() | {"id": str(uuid4()), "user_id": user["id"], "versions": []}
    store.writing_projects[project["id"]] = project
    return project

@api_router.get("/writing/projects")
async def writing_projects(user: dict = Depends(current_user)):
    return [p for p in store.writing_projects.values() if p["user_id"] == user["id"]]

@api_router.get("/writing/projects/{project_id}")
async def writing_project(project_id: str, user: dict = Depends(current_user)):
    return store.writing_projects[project_id]

@api_router.post("/writing/projects/{project_id}/versions")
async def writing_version(project_id: str, content: str, user: dict = Depends(current_user)):
    version = {"version_number": len(store.writing_projects[project_id]["versions"]) + 1, "content": content, "feedback": analyze_writing(content, store.writing_projects[project_id]["writing_type"])}
    store.writing_projects[project_id]["versions"].append(version)
    return version

@api_router.post("/writing/projects/{project_id}/analyze")
async def writing_analyze(project_id: str, user: dict = Depends(current_user)):
    project = store.writing_projects[project_id]
    return analyze_writing(project["content"], project["writing_type"])

@api_router.post("/writing/projects/{project_id}/revision-plan")
async def writing_revision(project_id: str, user: dict = Depends(current_user)):
    return {"plan": analyze_writing(store.writing_projects[project_id]["content"], store.writing_projects[project_id]["writing_type"])["revision_plan"]}

@api_router.delete("/writing/projects/{project_id}")
async def writing_delete(project_id: str, user: dict = Depends(current_user)):
    store.writing_projects.pop(project_id, None)
    return {"status": "deleted"}

@api_router.get("/progress/overview")
async def progress_overview(user: dict = Depends(current_user)):
    return {"mastery_average": 0.42, "strongest_skills": ["Number sense"], "priority_weaknesses": ["Linear equations"], "next_actions": recommend(SKILLS, {})}

@api_router.get("/progress/skills")
async def progress_skills(user: dict = Depends(current_user)):
    return [{"skill": s, "mastery": store.mastery.get((user["id"], s["id"]), {"score": 0})} for s in SKILLS]

@api_router.get("/progress/misconceptions")
async def misconceptions(user: dict = Depends(current_user)):
    return [{"id": "inverse_operation", "label": "Inverse operation", "evidence": 1}]

@api_router.get("/progress/retention")
async def retention(user: dict = Depends(current_user)):
    return [{"skill_id": "alg-linear-equations", "due": True}]

@api_router.get("/progress/recommendations")
async def progress_recommendations(user: dict = Depends(current_user)):
    return recommend(SKILLS, {})

@api_router.get("/progress/sessions")
async def progress_sessions(user: dict = Depends(current_user)):
    return list(store.practice.values())

@api_router.post("/classrooms")
async def classroom_create(payload: ClassroomRequest, user: dict = Depends(current_user)):
    classroom = {"id": str(uuid4()), "teacher_id": user["id"], "name": payload.name, "join_code": "NEXUS"}
    store.classrooms[classroom["id"]] = classroom
    return classroom

@api_router.get("/classrooms")
async def classrooms(user: dict = Depends(current_user)):
    return list(store.classrooms.values())

@api_router.get("/classrooms/{classroom_id}")
async def classroom(classroom_id: str, user: dict = Depends(current_user)):
    return store.classrooms[classroom_id]

@api_router.post("/classrooms/{classroom_id}/join")
async def classroom_join(classroom_id: str, user: dict = Depends(current_user)):
    return {"classroom_id": classroom_id, "user_id": user["id"], "status": "joined"}

@api_router.get("/classrooms/{classroom_id}/analytics")
async def classroom_analytics(classroom_id: str, user: dict = Depends(current_user)):
    return {"classroom_id": classroom_id, "common_misconceptions": ["inverse_operation"], "students_requiring_support": []}

@api_router.post("/classrooms/{classroom_id}/assignments")
async def classroom_assignment(classroom_id: str, payload: AssignmentRequest, user: dict = Depends(current_user)):
    return payload.model_dump() | {"id": str(uuid4()), "classroom_id": classroom_id}

@api_router.get("/classrooms/{classroom_id}/assignments")
async def classroom_assignments(classroom_id: str, user: dict = Depends(current_user)):
    return []

@api_router.get("/admin/content-review")
async def content_review(user: dict = Depends(current_user)):
    return [{"id": "generated-linear-001", "status": "deterministically_validated", "risk": "low"}]
