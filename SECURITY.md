# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

The Sanjeevani team takes security and elder safety with critical priority. If you discover a security vulnerability or medical safety guardrail flaw:

1. **Do not open a public GitHub issue.**
2. Send an email to `rashiyaom@gmail.com` with:
   - Type of issue (e.g. secret leak, prompt injection, role privilege escalation, PII exposure)
   - Step-by-step reproduction instructions or proof of concept
   - Impact assessment
3. You will receive an acknowledgment within 24 hours and a resolution or mitigation within 72 hours.

## Security Architecture Highlights

- **Zero Client Secrets:** No third-party LLM, vision, or translation API keys are shipped in browser bundles.
- **Strict Guardrails:** Deterministic input sanitization rejects jailbreaks, malicious payloads, and prompt injection before execution.
- **PII Redaction:** Sensitive user identification numbers (Aadhaar, PAN, UPI IDs), phone numbers, and emails are redacted before responses are rendered or spoken.
- **Offline Parity:** Fully functional offline mode ensures zero network exfiltration during local development, demo sessions, and automated evaluation.
