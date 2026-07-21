# Architecture

Nexus Academy is organized as a modular monorepo. API routes are thin and delegate to domain services for assessment, mastery, math validation, writing feedback, tutoring, quest progression, and recommendations.

## Backend Modules

- `auth`: token issuing, password handling, role-aware current user
- `curriculum`: subjects, skills, prerequisite graph, seed curriculum
- `assessment`: placement assessment and mastery evidence
- `math_engine`: deterministic expression and step checks
- `tutor`: safe graduated help ladder with provider interface
- `writing`: structured writing feedback and revision tracking
- `quests`: adventure, boss battle, and reward progression
- `progress`: learner analytics and recommendations
- `teacher`: classrooms and assignments
- `admin`: content review queue and AI validation status

The initial implementation uses in-memory repositories so all workflows run immediately in tests and demos. The data models, Alembic migration, and async session factory define the PostgreSQL target schema for durable deployment.

## AI Safety

All AI-like behavior passes through service interfaces. The deterministic provider is the default and never fabricates math answers. External providers must return typed structures and pass deterministic validation before content reaches learners.

