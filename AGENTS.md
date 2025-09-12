# AGENTS.md for node-chess

## Project Overview

This is a Node.js library for calculating chess moves.

## Build and Test Commands

**Installation:**

- Use `npm install` at the project root to install all dependencies.

**Development:**

- Please alphabetize imports and variables.
- Use camelCase for variable and function names.
- Follow the existing code style and conventions.

**Testing:**

- Run the full test suite for all packages: `npm run test`
- All code changes must pass the entire test suite before merging.
- Run the linter: `npm run lint`
- All linting issues must be resolved before merging.

## Coding Conventions and Style

- **Linting:** We use ESLint with the Airbnb style guide for TypeScript. Run `npm run lint` to check for style and coding errors.
- **Naming:**
  - Components and files use PascalCase (e.g., `Button.tsx`).
  - Functions and variables use camelCase (e.g., `getUsers`).
  - Constants use screaming snake case (e.g., `API_ENDPOINT`).
- **TypeScript:** Use strict mode and explicitly type all function arguments and returns. Avoid using `any`.
- **Comments:**
  - Use JSDoc style comments for all functions and classes. Include parameter and return types.
  - Use inline comments sparingly to explain complex logic. Start inline comments with a lower case letter and do not end with a period.

## Testing Guidelines

## PR Instructions

- **Commit Messages:** Follow the Conventional Commits specification (e.g., `feat:`, `fix:`, `docs:`) to ensure changelogs are generated correctly.
- **Pre-Commit Checks:** Always run `npm run build`, `npm run lint` and `npm run test` before committing your code.

## Security Considerations

- **Secrets:** Never hard-code API keys, credentials, or other sensitive information.
- **Dependencies:** All dependencies must be vetted and installed via `npm`. No manual installations.
