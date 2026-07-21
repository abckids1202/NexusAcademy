.PHONY: test backend-test frontend-test

test: backend-test frontend-test

backend-test:
	cd backend && pytest

frontend-test:
	cd frontend && npm test

