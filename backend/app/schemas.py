from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    role: str = "learner"

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class UserOut(BaseModel):
    id: str
    email: EmailStr
    role: str

class OnboardingRequest(BaseModel):
    display_name: str
    learner_type: str
    goals: list[str]
    game_intensity: str = "balanced"
    preferred_language: str = "en"

class AnswerRequest(BaseModel):
    answer: str
    confidence: int = Field(default=3, ge=1, le=5)
    used_hints: int = 0

class WritingRequest(BaseModel):
    title: str
    writing_type: str
    prompt: str
    content: str

class TutorMessageRequest(BaseModel):
    message: str
    activity_id: str | None = None
    help_level: int = Field(default=1, ge=1, le=10)

class ExpeditionRequest(BaseModel):
    goal: str
    session_minutes: int = Field(default=30, ge=5, le=180)
    subject: str | None = None

class ClassroomRequest(BaseModel):
    name: str

class AssignmentRequest(BaseModel):
    title: str
    instructions: str
    ai_help_policy: str = "hint_ladder"
