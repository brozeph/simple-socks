# AGENTS.md for simple-socks

## Project Overview

This repository is a Node.js SOCKS5 server library (`simple-socks`) with example servers and a small integration-style test suite.

## Build, Lint, Format, and Test Commands

**Install dependencies:**

- `npm ci` (preferred in CI and reproducible local installs)
- `npm install` (acceptable for local development)

**Formatting:**

- `npm run format` to apply formatting (`dprint fmt`)
- `npm run format:check` to verify formatting (`dprint check`)

**Linting:**

- `npm run lint` to run ESLint flat-config checks on `src`, `examples`, and `test`

**Tests:**

- `npm run test` to run the test suite
- `npm run test:coverage` to generate text + lcov coverage output via `c8`

## CI Expectations

GitHub Actions workflow: `.github/workflows/test.yml`

- `quality` job runs formatting and lint checks
- matrix `test` job runs tests on Node `18`, `20`, and `22` across Linux/Windows
- `coverage` job generates lcov and uploads to Codecov
- coverage upload expects `CODECOV_TOKEN` to be configured in repository secrets

All changes should pass:

1. `npm run format:check`
2. `npm run lint`
3. `npm run test`
4. `npm run test:coverage` (when changing CI/coverage behavior)

## Coding Conventions

- Keep imports alphabetized when practical.
- Use camelCase for variables and functions.
- Prefer `const` unless reassignment is required.
- Use ESM module syntax.
- Keep comments concise and focused on non-obvious behavior.
- Follow existing patterns in `src/socks5.js` and examples.

## Security and Dependency Rules

- Never commit secrets or credentials.
- Add/update dependencies via `npm` only.
- Keep dependency and lockfile changes intentional and reviewable.
