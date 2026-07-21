# Security Notes

- Store passwords with a production password hasher before deployment.
- Rotate refresh tokens and persist token revocation in PostgreSQL.
- Keep AI prompts, retrieved passages, learner writing, and uploaded content as untrusted data.
- Enforce object-level authorization in every repository method.
- Do not expose model keys or internal prompts to the frontend.
- Minimize collection of data from minors and support deletion/export flows.
- Disable public rankings for children by default.

