from __future__ import annotations

from dataclasses import dataclass, field
from uuid import uuid4

from app.core.security import hash_password, verify_password

@dataclass
class MemoryStore:
    users: dict[str, dict] = field(default_factory=dict)
    profiles: dict[str, dict] = field(default_factory=dict)
    refresh_tokens: dict[str, str] = field(default_factory=dict)
    mastery: dict[tuple[str, str], dict] = field(default_factory=dict)
    assessments: dict[str, dict] = field(default_factory=dict)
    practice: dict[str, dict] = field(default_factory=dict)
    conversations: dict[str, dict] = field(default_factory=dict)
    writing_projects: dict[str, dict] = field(default_factory=dict)
    quest_runs: dict[str, dict] = field(default_factory=dict)
    classrooms: dict[str, dict] = field(default_factory=dict)

    def create_user(self, email: str, password: str, role: str = "learner") -> dict:
        if any(u["email"] == email for u in self.users.values()):
            raise ValueError("email already registered")
        user = {"id": str(uuid4()), "email": email, "hashed_password": hash_password(password), "role": role}
        self.users[user["id"]] = user
        return user

    def authenticate(self, email: str, password: str) -> dict | None:
        user = next((u for u in self.users.values() if u["email"] == email), None)
        if user and verify_password(password, user["hashed_password"]):
            return user
        return None

store = MemoryStore()
