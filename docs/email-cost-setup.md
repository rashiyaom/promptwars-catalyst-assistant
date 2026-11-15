# Brevo email and Firebase cost controls

Reminders call Brevo directly from the existing scheduled function. No Trigger Email extension or SMS service is needed. A private Brevo M2M app was created using the logged-in CLI account. Its credentials are in ignored `functions/.env.brevo-private` with owner-only file permissions. Never commit or paste this file.

Before deployment, set Firebase secret `BREVO_CREDENTIALS` from that file using `firebase functions:secrets:set BREVO_CREDENTIALS --data-file functions/.env.brevo-private --project sanjeevani-5b35b`. Configure ignored `functions/.env` with `MOCK_MODE=false`, `EMAIL_FROM=<verified Brevo sender email>` and `GRACE_MINUTES=30`. Sender verification must be completed in Brevo. Only caretaker-consented recipients are used. Provider acceptance does not mean delivered/read. Unknown outcomes are not automatically retried.

Controls implemented:
- At most 50 missed-dose email attempts per UTC day across this project, transactionally reserved. Further alerts remain pending; this can delay caregiver notification.
- One send attempt per dose, with a deterministic idempotency key and no blind retries after uncertain outcomes.
- Reminder sweep every ten minutes, at most 100 pending and 100 missed records per sweep; appointments limited to 50. Backlogs increase latency.
- Scheduler maximum one instance, zero idle instances, 256 MiB and 120-second timeout; callable maximum two instances, zero idle instances.
- Browser refresh every five minutes only while visible; dose history reads limited to eight days and 1,000 records.

These controls reduce usage, not a guaranteed rupee spending cap. Configure billing alerts and supported service-level spend caps separately after enabling billing. Firestore, Scheduler, build/artifact storage, Tavus and Brevo may have separate charges. Scheduled functions and Brevo delivery have not been deployed or live-tested. Local mocked tests do not prove live delivery.

Current verification: the Brevo CLI login and private app creation succeeded, but direct M2M token exchange returned HTTP 401 invalid_client and sender lookup returned 403. Do not deploy this credential file as a working secret until resolved. Firebase billing remains disabled; Auth is uninitialized and App Check absent. No live email was sent.
