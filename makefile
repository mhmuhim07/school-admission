.DEFAULT_GOAL := help
.PHONY: help start stop down restart status logs logs-backend rebuild db-shell reset

# Service to rebuild (override like this: make rebuild s=frontend)
s ?= backend

help:
	@echo ""
	@echo "School Admission System - commands"
	@echo ""
	@echo "  make start         Build and start everything in the background"
	@echo "  make stop          Stop everything (data is kept)"
	@echo "  make restart       Stop, then build and start again"
	@echo "  make down          Remove containers (data is kept)"
	@echo "  make status        Show which services are running"
	@echo "  make logs          Follow logs of all services (Ctrl+C only stops watching)"
	@echo "  make logs-backend  Follow logs of the backend only"
	@echo "  make rebuild       Rebuild one service after code changes (default: backend)"
	@echo "                     example: make rebuild s=frontend"
	@echo "  make db-shell      Open a SQL prompt inside the database"
	@echo "  make reset         DELETE ALL DATA and start from scratch"
	@echo ""

start:
	docker compose up --build -d
	@echo "Started. Backend: http://localhost:8880"

stop:
	docker compose stop

restart: stop start

down:
	docker compose down

status:
	docker compose ps

logs:
	docker compose logs -f

logs-backend:
	docker compose logs -f backend

rebuild:
	docker compose up --build -d $(s)

db-shell:
	docker compose exec db psql -U admission -d admission

reset:
	docker compose down -v
	docker compose up --build -d