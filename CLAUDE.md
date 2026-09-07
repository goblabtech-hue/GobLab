# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Core Philosophy

1. **Minimalism first.** The best code is the code you don't write. Prefer deleting over adding. Solve the current problem, not hypothetical future ones (YAGNI).
2. **Object-oriented, but pragmatic.** Small classes with a single responsibility. Composition over inheritance. Program against interfaces, not implementations.
3. **Tests are not optional.** Untested code is broken code. Every behavior change ships with tests.
4. **Microservices with clear boundaries.** Each service owns its data and its domain. Communication only through published contracts (API/events), never shared databases.

## Environment Auto-Discovery

- **Before making any change**, inspect the repository to detect the ecosystem: look for `package.json`, `requirements.txt` / `pyproject.toml`, `Cargo.toml`, `go.mod`, `pom.xml` / `build.gradle`, `Makefile`, `docker-compose.yml`, CI config, etc.
- Adapt automatically to the detected ecosystem (package manager, test runner, linter, formatter) without asking — follow the project's existing conventions, not your defaults.
- **Frequent commands (auto-detected):**
  - *Build/Start*: use the standard script of the detected ecosystem (`npm run build` / `npm start`, `cargo build`, `make`, `docker compose up`, etc.).
  - *Testing*: locate the configured test suite (Jest, Vitest, PyTest, cargo test, go test, JUnit...) and run it with the project's own script (`npm test`, `pytest`, `make test`).
  - *Lint/Format*: use the tools already configured in the repo (ESLint, Ruff, Clippy, golangci-lint...). Never introduce a new linter or formatter on your own.
- If multiple ecosystems coexist (monorepo), detect and use the tooling of the specific service you are touching.

## Design Rules (Minimalism)

- Functions ≤ 25 lines, classes ≤ 200 lines, files ≤ 400 lines. If you exceed this, split by responsibility.
- Max 3 parameters per function; beyond that, use a value object or config object.
- No premature abstractions: extract an interface only when there are ≥ 2 real implementations, or the boundary is an external dependency (DB, HTTP, queue).
- No dead code, no commented-out code, no "just in case" flags **in code you write**. If your changes leave imports, variables, or functions unused, remove them — git remembers. Pre-existing dead code: mention it, don't delete it unless asked. Explanatory comments (the *why* behind non-obvious decisions) are always preserved.
- No error handling for impossible scenarios. Handle failures that can actually happen (I/O, network, user input); don't defensively wrap code that cannot fail.
- The simplicity test: "Would a senior engineer say this is overcomplicated?" If yes — or if 200 lines could be 50 — rewrite it before presenting it.
- Strict typing in every language that supports it: TypeScript `strict: true`, Python with full type hints + mypy/pyright, no `any`/`Object`/untyped escapes without justification.
- Prefer pure functions for logic: same input → same output, no hidden side effects. Push I/O and mutation to the edges (infrastructure layer).
- Prefer standard library over dependencies. Every new dependency needs justification in the PR description.
- Explicit over implicit: no magic, no reflection tricks, no hidden side effects.

## Object-Oriented Rules

- **SOLID applies**, with emphasis on:
  - *Single Responsibility*: one reason to change per class.
  - *Dependency Inversion*: domain logic never imports infrastructure. Infrastructure implements domain interfaces.
- Composition over inheritance. Inheritance only for true "is-a" with stable hierarchies (max depth: 2).
- Entities and value objects are immutable where possible. Prefer constructors/factories that guarantee valid state — no half-built objects, no public setters.
- Tell, don't ask: put behavior where the data lives. Avoid anemic models with logic scattered in "manager"/"helper"/"util" classes.
- Encapsulate collections: expose intent-revealing methods, not raw lists.

## Testing Rules

- **TDD preferred**: write the failing test first when fixing bugs or adding behavior.
- **Goal-driven execution** — transform every task into a verifiable goal and loop until it passes:
  - "Add validation" → write tests for invalid inputs, then make them pass.
  - "Fix the bug" → write a test that reproduces it, then make it pass.
  - "Refactor X" → ensure the full suite passes *before* and *after*; behavior must not change.
- Test pyramid per service:
  - Unit tests: fast, isolated, no I/O. Target ≥ 80% coverage on domain logic.
  - Integration tests: real DB/queue via containers (e.g., Testcontainers) for adapters.
  - Contract tests: consumer-driven contracts (e.g., Pact) for every inter-service API/event.
  - E2E: few, only for critical user journeys.
- One assertion concept per test. Test names describe behavior: `rejects_order_when_stock_is_insufficient`.
- Never mock what you don't own — wrap external clients behind an interface and mock the interface.
- No flaky tests: no sleeps, no real clocks, no real network. Inject time and randomness.
- A failing test suite blocks merge. Never skip, disable, or weaken a test to make CI pass — fix the code or fix the test's design, and say so explicitly.

## Microservices Architecture

- **One service = one bounded context.** Never split by technical layer ("api-service", "db-service").
- **Database per service.** No service reads another service's tables. Ever.
- Structure inside each service (hexagonal / ports & adapters):
  ```
  service-name/
  ├── src/
  │   ├── domain/          # entities, value objects, domain services — zero framework imports
  │   ├── application/     # use cases, ports (interfaces)
  │   ├── infrastructure/  # DB, HTTP clients, messaging — implements ports
  │   └── api/             # controllers/handlers, DTOs, mapping
  ├── tests/
  │   ├── unit/
  │   ├── integration/
  │   └── contract/
  └── README.md            # purpose, API, events, how to run locally
  ```
- Communication:
  - Synchronous (REST/gRPC) only when the caller needs an immediate answer.
  - Asynchronous events (queue/bus) for everything else. Prefer choreography over orchestration.
  - Every API and event schema is versioned. Breaking changes require a new version and a deprecation period — never break consumers silently.
- Resilience by default: timeouts on every remote call, retries with backoff + jitter only on idempotent operations, circuit breakers on critical dependencies.
- Idempotent consumers: every event handler must tolerate duplicates.
- Observability: structured logs (JSON) with correlation/trace ID propagated across services; health endpoints (`/health/live`, `/health/ready`); metrics for latency, error rate, and throughput.

## Surgical Changes

**Touch only what you must. Clean up only your own mess.**

- Every changed line must trace directly to the user's request. If it doesn't, revert it.
- Don't "improve" adjacent code, comments, or formatting while editing. Don't refactor things that aren't broken.
- Match the existing style of the file/service, even if you would do it differently.
- Orphans **your** changes created (unused imports, variables, functions): remove them.
- Pre-existing dead code or issues you notice: mention them in your summary — don't fix or delete them unless asked.

## Workflow for Claude

1. **Before coding**: read the relevant service's README and existing tests to understand current behavior and conventions.
2. **Think before coding — don't assume, don't hide confusion:**
   - State your assumptions explicitly before implementing. If uncertain, ask.
   - If the request has multiple reasonable interpretations, present them — never pick one silently.
   - If a simpler approach exists than the one requested, say so. Push back when warranted.
   - If something is unclear, stop, name exactly what's confusing, and ask.
   - For any change touching > 2 files or any public contract: outline the approach and wait for confirmation.
3. **Small steps**: make the smallest change that works, run the tests, then refactor.
4. **After coding**: never assume the code works. Always run the linter + the full test suite of the affected service after modifying files. If any lint or test command fails, **stop immediately, fix the error, and re-run** before continuing with anything else. Report results honestly, including anything you didn't verify.
5. **Never**:
   - Introduce a shared library that couples domain logic between services.
   - Add a dependency, endpoint, or event without flagging it explicitly.
   - Modify another service's code to "make it work" — propose a contract change instead.
   - Commit secrets, credentials, or environment-specific values.
6. **When uncertain**: ask. A clarifying question is cheaper than a wrong abstraction.

## Definition of Done

- [ ] Code follows the minimalism and OOP rules above
- [ ] Unit + integration tests written and passing
- [ ] Contract tests updated if any API/event changed
- [ ] Linter clean, no new warnings; strict typing passes
- [ ] Every changed line traces to the request; no unrelated edits or deletions
- [ ] No new dependencies without justification
- [ ] README updated if behavior, API, or setup changed
