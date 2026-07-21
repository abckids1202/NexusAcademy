"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-07-21
"""
from alembic import op
import sqlalchemy as sa

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.create_table(
        "users",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("email", sa.String(320), nullable=False, unique=True),
        sa.Column("hashed_password", sa.String(), nullable=False),
        sa.Column("role", sa.String(32), nullable=False, server_default="learner"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_table(
        "skills",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("subject", sa.String(32), nullable=False),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("difficulty", sa.Integer(), nullable=False),
        sa.Column("prerequisites_json", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("objectives_json", sa.JSON(), nullable=False, server_default="[]"),
    )
    op.create_table(
        "mastery",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("skill_id", sa.String(), sa.ForeignKey("skills.id"), nullable=False),
        sa.Column("score", sa.Float(), nullable=False, server_default="0"),
        sa.Column("evidence_json", sa.JSON(), nullable=False, server_default="[]"),
    )
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("actor_id", sa.String(), nullable=True),
        sa.Column("action", sa.String(120), nullable=False),
        sa.Column("entity_type", sa.String(80), nullable=False),
        sa.Column("entity_id", sa.String(), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

def downgrade():
    op.drop_table("audit_logs")
    op.drop_table("mastery")
    op.drop_table("skills")
    op.drop_table("users")

