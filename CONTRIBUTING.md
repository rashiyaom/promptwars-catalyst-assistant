# Contributing to Sanjeevani

Thank you for contributing to Sanjeevani × Taus, an elder-first medication coordination platform built with strict TypeScript, React 19, and responsible AI guardrails.

## Development Standards

1. **Strict TypeScript & Zero Warnings:**
   - Every file must pass `tsc --noEmit`.
   - `eslint --max-warnings 0` is strictly enforced.
2. **Offline Parity:**
   - The entire test suite and demo mode must function completely offline without network calls or API keys (`npm run check` and `npm run demo`).
3. **Branch & Commit Hygiene:**
   - Development happens on `main`.
   - Use atomic semantic commit messages (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `security:`, `ci:`, `chore:`, `style:`).
4. **Repository Size Constraint:**
   - The repository footprint must remain strictly < 10 MB. Never commit raw binaries, large models, or generated assets.

## Workflow

```sh
# Install dependencies
npm ci

# Run formatting check
npm run format:check

# Run full offline verification
npm run check

# Launch offline demo
npm run demo
```
