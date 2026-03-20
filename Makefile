.PHONY: help install build test typecheck lint clean run

help: ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*##"}; {printf "  %-14s %s\n", $$1, $$2}'

install: ## Install dependencies
	npm install

build: ## Compile TypeScript to dist/
	npm run build

test: ## Run tests
	npm test

typecheck: ## Type-check without emitting
	npm run typecheck

lint: ## Lint source and tests
	npm run lint

clean: ## Remove build output
	rm -rf dist

run: build ## Build then audit the current directory
	node dist/cli.js audit .
