# HACKATHON WINNING BLUEPRINT & AI AGENT CODING RULES

**Event:** PromptWars x Catalyst (Hack2Skill / Google for Developers)  
**Target:** 100% Score on Automated AI Evaluation & Judge Assessment

---

## 1. Non-Negotiable Hard Constraints (Disqualification Gates)

| Rule                       | Requirement                       | Verification Step                                                                                                                                   |
| :------------------------- | :-------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Repo Size**              | **Strictly < 10 MB**              | Ensure `.gitignore` ignores `node_modules/`, `venv/`, `.env`, caches, coverage files, and media. Run `git count-objects -vH` to verify before push. |
| **Branch Limit**           | **Exactly 1 branch (`main`)**     | No feature branches on remote. Delete local/remote feature branches before submission.                                                              |
| **Visibility**             | **Public Repository**             | Must be accessible to the AI evaluation engine without authentication.                                                                              |
| **Zero Hardcoded Secrets** | **No exposed API keys or tokens** | Use `.env.example`. Check git diff before every commit.                                                                                             |
| **Submission Limit**       | **Max 2 Attempts**                | Test locally and verify end-to-end so Attempt #1 is 100% production-ready.                                                                          |

---

## 2. AI Evaluator Scoring Rubric & Impact Mapping

Automated AI code evaluators parse the repository tree, run static analysis, execute test suites, analyze prompt architectures, and read the `README.md`. Every file written must score maximum points across all 3 tiers:

### 🔴 High Impact (Score Drivers — Must Be Flawless)

1. **Problem Statement & Vertical Alignment:**
   - Explicitly define the chosen vertical, target persona, and real-world problem.
   - Embed domain-specific heuristics, terminology, and operational constraints into the assistant's prompts and decision engine.
2. **Logical Decision-Making & Dynamic Adaptation:**
   - **Do NOT build a basic LLM wrapper.** The assistant must possess an autonomous **Decision Engine** / State Machine / ReAct Loop that evaluates:
     - User intent & urgency levels.
     - Contextual user profile (preferences, history, constraints).
     - Risk levels and business rules.
   - Dynamic prompt synthesis: context is conditionally injected based on the evaluation phase.
3. **Architecture & Code Quality:**
   - Layered architecture with strict Separation of Concerns (UI/API $\rightarrow$ Orchestrator $\rightarrow$ Decision Engine $\rightarrow$ Guardrails $\rightarrow$ Tools/Memory).
   - 100% typed code (TypeScript strict mode or Python with full Type Hints & Pydantic V2 models).
   - Descriptive naming, zero dead code, clear docstrings, and modular design.
4. **Security & Responsible AI Guardrails:**
   - **Input Sanitization Layer:** Regex and pattern checks for prompt injection, jailbreaks, and toxic tokens.
   - **Output Redaction & Guardrails:** PII filtering (emails, phone numbers, credit cards, identification numbers).
   - **Input Validation:** Strict Pydantic/Zod schemas with boundary enforcement on every input field.
   - **Deterministic Fallbacks:** Fallback logic when confidence scores are low or safety rules trigger.
5. **Comprehensive Testing & Automated Verification:**
   - Complete automated test suite (`pytest` or `vitest`/`jest`) with **$\ge$ 85% code coverage**.
   - Offline mock architecture (`MOCK_MODE=true` default fallback) so tests run in network-isolated sandbox environments without failing on missing API keys.
   - Unit tests, integration tests, security boundary tests, and edge-case handling.
6. **Masterpiece README.md:**
   - Full evaluation rubric mapping table.
   - Mermaid architecture & sequence diagrams.
   - 1-command quickstart guide (Zero-Friction Run).
   - Explicit statement of assumptions and edge case coverage.

### 🟡 Medium Impact (Differentiators — Elevated Scoring)

1. **Efficiency & Resource Optimization:**
   - Full asynchronous non-blocking I/O (`async`/`await`).
   - In-memory / LRU caching for frequent operations and prompt templates.
   - Lightweight dependencies (avoid heavy, unnecessary libraries that bloat repo size).
   - Sub-second deterministic logic execution.
2. **State & Memory Management:**
   - Short-term session memory (multi-turn conversation history).
   - Long-term contextual memory (user profiles, behavioral patterns, historical decisions).
   - Context window optimization (summarization/token trimming to prevent overflow).
3. **Accessibility (a11y) & Usability:**
   - Semantic HTML5 structure (`<main>`, `<header>`, `<article>`, `<button>`).
   - Full ARIA compliance (`aria-live`, `aria-label`, `role="status"`).
   - 100% keyboard navigable (Tab, Enter, Escape).
   - High-contrast visual hierarchy (WCAG AA standard) and responsive UI.
   - Informative, polite error messages with recovery options.

### 🟢 Low Impact (Final Polish — Perfect Score Enablers)

1. **Developer Experience & Tooling:**
   - Clean `.gitignore` and `.env.example`.
   - Formatted and linted code (PEP 8 / Prettier).
   - Meaningful Git commit history showing incremental progress.
2. **Rich CLI / UI Feedback:**
   - Live loading states, status badges, confidence meters, and contextual tooltips.

---

## 3. Mandatory Architectural Standards

Any code written for this repository must adhere to the following directory layout:

```text
├── .env.example              <- Template for configuration (no secrets!)
├── .gitignore                <- Aggressive filtering (< 10 MB repo guarantee)
├── README.md                 <- Master documentation & rubric alignment
├── INSTRUCTIONS.md           <- This ruleset
├── pyproject.toml / package.json
├── src/
│   ├── config.py             <- Type-safe environment & app settings
│   ├── core/
│   │   ├── agent.py          <- Core assistant orchestrator
│   │   ├── decision_engine.py<- Logic matrix, state machine & decision rules
│   │   ├── memory.py         <- Short-term & long-term context manager
│   │   └── persona.py        <- Vertical persona prompts & system instructions
│   ├── guardrails/
│   │   ├── input_validator.py<- Prompt injection & input sanitization
│   │   └── output_filter.py  <- PII redaction & safety checks
│   ├── tools/
│   │   ├── base.py           <- Tool definitions & interfaces
│   │   └── mock_tools.py     <- Offline deterministic tool implementations
│   ├── web/ or cli/          <- Accessible interface (Semantic UI or Rich CLI)
│   └── models/
│       └── schemas.py        <- Pydantic / Zod data validation models
└── tests/
    ├── test_decision_engine.py
    ├── test_guardrails.py
    ├── test_agent_integration.py
    └── conftest.py           <- Offline mocks & test fixtures
```

---

## 4. Coding Execution Guidelines for AI Agents

1. **Always Implement Offline Mock Mode First:**
   - The system must function 100% out of the box using mock LLM / heuristic fallbacks when `GEMINI_API_KEY` or `OPENAI_API_KEY` is omitted.
   - The AI evaluation runner will likely execute without user-provided API keys; failing to provide mock fallbacks will cause automated grading to fail.

2. **Never Write Hardcoded Magic Values:**
   - All prompts, thresholds, error codes, and configuration parameters must be declared in typed constants or schema configurations.

3. **Strict Error Boundary Pattern:**
   - Wrap all external calls and user inputs in graceful try-except blocks.
   - Return structured error responses: `{ "success": false, "error": { "code": "...", "message": "..." } }`.

4. **Self-Documenting Code:**
   - Every class, function, and module must include standard docstrings detailing parameters, return types, and exceptions raised.

5. **Single-Branch Git Protocol:**
   - Commit directly to `main` with structured semantic commit messages:
     - `feat: implement dynamic context decision engine`
     - `security: add prompt injection and PII redaction guardrails`
     - `test: add comprehensive pytest suite with 90%+ coverage`
     - `docs: update README with architecture diagrams and rubric mapping`

---

## 5. Pre-Submission Checklist (Run Before Pushing)

- [ ] Repository size is verified under 10 MB (`du -sh .` without ignored files).
- [ ] No `.env`, `node_modules/`, `venv/`, or API keys exist in git tracking (`git status`).
- [ ] Only **one branch** exists locally and remotely (`git branch -a`).
- [ ] All automated tests pass with 100% success (`pytest -v` or `npm test`).
- [ ] Zero unhandled exceptions or crashes on unexpected/adversarial inputs.
- [ ] `README.md` is populated with all required sections, Mermaid diagrams, and vertical explanations.
- [ ] Repository is set to **Public** on GitHub.
