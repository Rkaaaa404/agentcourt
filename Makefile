.PHONY: help dev dev-backend dev-frontend test lint format eval seed check-env docker-build docker-up

PYTHON ?= python

help:
	@echo "Veripact Makefile targets:"
	@echo "  make dev          - Run backend and frontend concurrently"
	@echo "  make test         - Run backend pytest suite"
	@echo "  make lint         - Run ruff linter and format check"
	@echo "  make eval         - Run offline 12-scenario evaluation harness"
	@echo "  make check-env    - Run environment validation script"
	@echo "  make seed         - Seed demo scenarios and database"
	@echo "  make docker-up    - Build and launch via docker compose"

check-env:
	$(PYTHON) scripts/check_env.py

test:
	pytest backend/tests/ -v

lint:
	ruff check backend/ scripts/ eval/

format:
	ruff format backend/ scripts/ eval/

eval:
	$(PYTHON) eval/run_eval.py

seed:
	$(PYTHON) scripts/seed_demo.py

dev-backend:
	uvicorn backend.veripact.api.main:app --reload --port 8000

dev-frontend:
	cd web && npm run dev

dev:
	@echo "Starting backend and frontend..."
	$(MAKE) -j2 dev-backend dev-frontend

docker-build:
	docker compose build

docker-up:
	docker compose up
