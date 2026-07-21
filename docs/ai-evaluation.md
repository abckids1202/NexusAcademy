# AI Evaluation

Nexus Academy treats generated educational content as untrusted until validated.

## Required Gates

1. Classify the request.
2. Assemble only necessary learner and activity context.
3. Filter prompt-injection attempts.
4. Require structured output.
5. Validate mathematics deterministically.
6. Validate English tasks against rubric and source evidence.
7. Log provider, latency, validation status, and failure category.

The deterministic fallback provider is suitable for development and tests. Production model providers should be evaluated against a fixed suite of misconception, hint-ladder, writing-feedback, and content-validation scenarios.

