from sqlalchemy import DateTime, Float, ForeignKey, Integer, JSON, String, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String(32), default="learner")
    created_at = mapped_column(DateTime, server_default=func.now())

class Skill(Base):
    __tablename__ = "skills"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    subject: Mapped[str] = mapped_column(String(32), nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    difficulty: Mapped[int] = mapped_column(Integer, nullable=False)
    prerequisites_json = mapped_column(JSON, default=list)
    objectives_json = mapped_column(JSON, default=list)

class Mastery(Base):
    __tablename__ = "mastery"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    skill_id: Mapped[str] = mapped_column(String, ForeignKey("skills.id"), nullable=False)
    score: Mapped[float] = mapped_column(Float, default=0)
    evidence_json = mapped_column(JSON, default=list)

