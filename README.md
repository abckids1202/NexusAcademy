# Nexus Academy

Nexus Academy is an AI-powered adaptive learning adventure for mathematics and English. This first commit contains a production-oriented monorepo foundation with a functioning FastAPI API, deterministic educational engines, a React TypeScript frontend, Docker wiring, seed data, tests, and implementation docs.

## Stack

- Frontend: Vite, React, TypeScript, Tailwind CSS, TanStack Query, Framer Motion, React Hook Form, Zod, Recharts, KaTeX
- Backend: FastAPI, async SQLAlchemy-ready architecture, Alembic, PostgreSQL, pgvector, Redis
- Auth: email/password with bcrypt-compatible hashing interface, access and refresh token services
- AI: provider interface with deterministic fallback tutor, diagnostic, writing feedback, and expedition planner

## Quick Start

```bash
cp .env.example .env
docker compose up --build
```

Frontend: http://localhost:5173  
Backend API: http://localhost:8000/docs

## Local Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -e ".[dev]"
pytest
uvicorn app.main:app --reload
```

## Local Frontend

```bash
cd frontend
npm install
npm run dev
npm test
```

## MVP Workflows Included

- Register, login, refresh, and current-user profile endpoints
- Onboarding profile update
- Subject, skill, prerequisite graph, mastery, and recommendations APIs
- Placement assessment lifecycle
- Practice session with adaptive answer feedback
- Deterministic math expression equivalence and step validation
- Graduated tutor hint ladder
- Quest and boss battle progression
- AI expedition planning with transparent rationale
- Writing Studio structured feedback and revision versions
- Learner progress analytics
- Teacher classrooms and assignments
- Admin content review queue

The deterministic fallback keeps the platform usable without external AI credentials. Production model providers can be added behind `AIProvider` without changing route contracts.

