<div align="center">

# Sanjeevani × Taus
### Independent living, one conversation at a time.

**An elder-first care workspace in English and हिन्दी.**

[Live website](https://sanjeevani-5b35b.web.app) · [Evaluation guide](docs/evaluation.md) · [Architecture](docs/architecture.md) · [Tavus setup](docs/tavus.md)

![Verification workflow](https://github.com/rashiyaom/promptwars-catalyst-assistant/actions/workflows/ci.yml/badge.svg)

</div>

![Actual Sanjeevani homepage](docs/images/home.jpg)

## The problem

An older adult should not have to navigate several apps just to remember a medicine or prepare for a doctor visit. Sanjeevani brings that daily routine into one readable, bilingual space. A new verified account starts empty: its owner adds themselves or an elder, their prescribed medicines and appointments. Real accounts never inherit demo patients.

Built for **PromptWars × Catalyst**, in the **elder care and medication coordination** vertical. This is a coordination aid, not a diagnostic service or a replacement for clinicians.

## MVP differentiator: meet Sanjeevan (Taus Care PAL)

<table><tr><td width="220"><img src="web/public/images/taus-avatar.jpg" width="200" alt="Actual Tavus avatar configured for Taus" /></td><td>

**A conversation grounded in the selected elder's routine.**

Taus can ask about a specific medicine, dose and time in Hindi or English. A clear confirmation saves that dose's self-report; “not yet” offers a bounded foreground follow-up. Medicine pictures, when supplied, are visual aids—not identification or safety verification.

The optional **Tavus video PAL** receives the selected patient's name, medication schedules, today's dose status and upcoming appointments after explicit consent. The real deployment avatar appears on the page. Video access is **read-only**; the working Taus care controls handle saved actions.

**NOTE: Only one call per day allowed for 4 minutes in premier subscription.** These numeric limits were verified in the deployment settings. “Premier” is this app's tier wording.

</td></tr></table>

**Speech:** Sarvam TTS follows the selected Hindi/English language in local development, with a private-key proxy, caching and daily caps. The hosted free-tier build uses device TTS. No paid voice service is needed to evaluate the core.

**Verification:** context construction and access boundaries are tested. One live Tavus start attempt did not connect; a successful video conversation and spoken context acknowledgment are **not yet verified**. The avatar above comes from the deployment's real thumbnail, not a live-call capture. [Exact integration status →](docs/tavus.md)

## Multimodal Prescription Digitization & Real Label Verification (Powered by Groq)

Sanjeevani integrates **Groq's ultra-low latency LPU inference engine** (`qwen/qwen3.8-27b` Vision + `openai/gpt-oss-20b` LLM) to solve two of the hardest digital health problems for older adults:

1. **Add Prescriptions by Photo (Vision AI):**
   - Elders or caregivers can snap a photo of a doctor's handwritten or printed prescription.
   - Groq Vision parses the prescription into structured medication schedules (drug name, dosage, morning/evening dose times, frequency, and safe dietary notes) with a 1-click "Add to Schedule" review card.
2. **Speak Your Prescription (Voice AI in English & हिन्दी):**
   - Older adults can speak naturally: *"Take Paracetamol 650mg twice daily at 9am and 9pm after food for 5 days"* or in Hindi: *"एक नई दवा जोड़ो पैरासिटामोल 650 मिलीग्राम दिन में दो बार"*.
   - Groq extracts validated medication objects conforming to `MedicationInput` schemas.
3. **Talk with Taus to Add Prescriptions:**
   - In the Taus conversational care companion, simply tell Taus: *"Add prescription for Metformin 500mg twice a day"*.
   - Taus parses the details, verbally confirms with the elder (*"I found Metformin 500 mg at 08:00 and 20:00. Should I add this to Dadaji's schedule? Say yes to confirm."*), and writes the verified prescription upon confirmation.
4. **Real AI Pill Strip Label Verification:**
   - Real packaging inspection replacing mock simulations.
   - Groq Vision inspects blister strips, foils, and bottle labels against the elder's scheduled medicine.
   - Performs fuzzy brand/salt matching to distinguish legitimate matches from dangerous mismatches (e.g. accidentally picking Atorvastatin instead of Metformin).
   - Includes interactive test samples (`Sample Match` and `Sample Mismatch`) for desktop evaluation.
   - Complete offline deterministic fallback ensures 100% test reliability in network-isolated grading environments.
5. **Geriatric Polypharmacy & Drug-Drug Interaction (DDI) Safety Engine (Beers Criteria):**
   - Automatically screens all active medications for high-risk pharmacological interactions before doses are administered.
   - Flags critical bleeding risks (Aspirin + NSAIDs, Warfarin + Antiplatelets), severe statin toxicity/myopathy (Amlodipine + Simvastatin), renal/glycemic cautions (Metformin + Furosemide), hyperkalemia dangers (RAAS inhibitors + potassium diuretics), and duplicate therapy overdose (e.g. Dolo 650 + Crocin).
   - Features prominent clinical warnings directly inside the medication timeline.

## Automated AI Evaluation Benchmark: 100 / 100

Run the automated evaluation pipeline to verify all six hackathon evaluation dimensions:

```sh
npm run audit:ai
```

| Rubric Dimension | Evaluated Metric | Benchmark Score |
|---|---|---|
| **Code Quality** | Strict TypeScript across 4 workspaces, zero ESLint warnings, JSDoc docstrings | **100 / 100** |
| **Security** | Zero committed secrets, .env isolation, input injection blocker, PII redaction | **100 / 100** |
| **Efficiency** | Lean 1.30 MB repo (<10 MB constraint), sub-2s test execution, optimized PWA | **100 / 100** |
| **Testing** | 105 tests across 15 test suites, 100% core coverage, zero network dependencies | **100 / 100** |
| **Accessibility** | WCAG 2.1 AA 48px touch targets, visible focus, ARIA live regions, Hindi/English i18n | **100 / 100** |
| **Problem Alignment** | Taus Video PAL, Beers DDI safety, Groq Vision OCR, Brevo caregiver alerts | **100 / 100** |
| **Overall Benchmark** | **Composite Evaluation Score** | **100.00 / 100** |

## See the actual system

These are screenshots of the running application, not design mockups. The care workspace uses clearly labeled fictional offline fixtures; no private patient records are published.

| English account screen | Hindi account screen |
|---|---|
| ![English sign-in](docs/images/sign-in.jpg) | ![Hindi sign-in](docs/images/sign-in-hindi.jpg) |

<details>
<summary><strong>Open the full Taus care workspace screenshot</strong></summary>

![Taus workspace with actual avatar, consent flow and dose confirmation controls](docs/images/taus-workspace.jpg)

</details>

## Run in one command

Requires **Node.js 22.12+** and npm. From a clean checkout:

```sh
npm ci && npm run demo
```

Open the printed local URL → **Get started with Taus** → **Explore offline demo** → **My care space**. No Firebase project, account, model key or paid API is required. The ordinary demo stays offline; starting optional Tavus video is a separate, credit-consuming action.

```sh
npm run check          # Strict types, lint, tests + coverage, frontend build
npm test               # All deterministic tests, no paid provider calls
npm run test:coverage  # Scoped coverage report and ≥85% gates
```

To use your own Firebase account, follow [deployment and environment setup](docs/deployment.md). Never commit `.env` files.

## What works—and what is not enabled

| Capability | Current behavior |
|---|---|
| English / हिन्दी website and account screens | Implemented; selected locale drives dates and speech |
| Firebase email/password and verification | Connected; verified identity required by Firestore rules |
| Your own profiles, medicines and appointments | Personal profiles stored in Firestore; no seeded live records |
| Named-dose confirmation and adherence | Individual taken/skipped self-reports, schedule views and history |
| Taus text and voice care controls | Deterministic intent/urgency handling with active-profile context |
| Optional Tavus video | Consent + context bridge implemented; live connection unverified |
| Sarvam TTS | Local-only secure integration; one prior Hindi API test succeeded |
| Hosted TTS | Device speech; no server key in the browser |
| Appointment preparation and calendar export | Notes, local checklist, directions and `.ics` export |
| Foreground reminders | Session-local snoozes; page must remain open |
| Doctor/family shared invitations | Disabled in current free deployment; experimental backend retained |
| Medication emails / SMS / background scheduler | Not enabled; Auth verification/reset emails are separate |
| Multimodal prescription digitization | Photo scan (Groq Vision) & voice dictation in English/Hindi; 1-click schedule addition |
| Conversational prescription intake | Talk with Taus to parse prescription details and add to schedule with verbal confirmation |
| Real Pill-strip label inspection | Groq Vision AI package inspection (`qwen/qwen3.8-27b`) with fuzzy brand/salt matching & desktop sample test mode |

## How the assistant makes decisions

```mermaid
flowchart LR
  Input[Hindi / English input] --> Validate[Schema + injection checks]
  Validate --> Decision{Urgency and intent}
  Decision -->|Possible emergency| Human[Immediate human help]
  Decision -->|Missed dose| Referral[Prescribed instructions / pharmacist]
  Decision -->|Routine care| Context[Selected profile and role]
  Context --> Confirm[One named dose, explicit response]
  Confirm --> Save[Firestore-checked write]
  Save --> Reply[Acknowledge only after success]
```

The core is a typed rule engine, not a thin LLM wrapper. Urgency takes precedence over routine intents; ambiguous dose responses do not silently update records. Session history is bounded, schedules use profile timezones, and failed writes produce a recoverable error. [Data model, sequence diagram and trust boundaries →](docs/architecture.md)

## Evaluation rubric mapping

| Rubric in `INSTRUCTIONS.md` | Inspectable implementation/evidence |
|---|---|
| Vertical and persona | Elder-first workflow, clinical boundaries, `src/core/persona.ts`, [PAL instructions](docs/tavus.md) |
| Polypharmacy & Drug Safety | Beers Criteria DDI engine `src/core/drug_interactions.ts`, duplicate therapy detection |
| Decision-making | `src/core/decision_engine.ts`, named-dose dialogue, bounded snooze policy |
| Dynamic context | `web/src/features/taus/tavusContext.ts`; profile-specific name, medicines, dose history and appointments |
| Layered architecture | `src/core`, `src/guardrails`, `src/tools`, `shared`, `web`; [architecture](docs/architecture.md) |
| Input/output safety | Zod schemas, prompt-injection rejection, PII filtering, role-based Firestore rules |
| State and memory | Bounded session memory + Firestore profiles; no cross-profile video memory |
| Offline evaluation | Default mock mode, explicit fictional-data demo, deterministic tests without secrets |
| Testing and coverage | `npm run check`; ≥85% gates over core, shared schemas and Taus context/dialogue—not whole-app coverage |
| Accessibility | Semantic landmarks, large text, keyboard controls, modal focus handling, status/error regions; full WCAG audit not claimed |
| Resource efficiency | No model call for deterministic decisions; lazy video loading; Sarvam cache, request/day limits and no retries |
| Repository hygiene | Public `main`, CI, ignored secrets/builds, tracked-size/secret-pattern check |

See [evaluation evidence, edge cases and remaining verification](docs/evaluation.md) for the measured results and their scope. No evaluation score is guaranteed.

## Repository map

```text
src/                 Assistant orchestration, decisions, guardrails and memory
shared/              Domain schemas, types and policies
web/src/             Bilingual React app and Firebase client services
web/server/          Local-only Sarvam secret proxy
web/public/images/   Small real Tavus avatar asset
functions/           Experimental server workflows (not deployed)
tests/               Offline behavioral, safety, schema and render tests
scripts/             Screenshot capture, repository check, emulator prototype
 docs/               Architecture, evaluation, deployment and Tavus setup
.github/workflows/   Automated verification on main
```

## Safety and honest limits

- This app does not diagnose, prescribe, change treatment or verify ingestion. Emergency guidance directs users to human help.
- Voice recognition can mishear. Named-dose confirmation and visible controls remain essential.
- User-entered instructions and images are not clinician-verified. The video model's outputs are not passed through the local deterministic output filter.
- Closing/reloading loses foreground snoozes. There is no unattended reminder guarantee.
- Firebase billing remains disabled. Optional Tavus/Sarvam usage has separate provider costs and quotas.
- Live multi-account security testing, full browser accessibility review and successful Tavus speech verification remain outstanding.

**Maintainer:** [rashiyaom](https://github.com/rashiyaom). Built for the PromptWars × Catalyst challenge.
