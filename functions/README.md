# Experimental server workflows — not deployed

This workspace preserves tested prototypes for invitations, scheduler-generated dose logs, escalation and Brevo delivery. They are **not part of the current Firebase Spark deployment**. `firebase.json` intentionally has no Functions target; normal deploy scripts publish only Hosting/Firestore.

Do not deploy this directory to the live project without revisiting billing, access and delivery verification. Its environment/secret files are ignored. No working email-delivery or shared-invitation claim should be inferred from these modules. The current product behavior is documented in the root README and `docs/architecture.md`.

`scripts/verify-emulator.mjs` targets these experimental callable flows, not the direct-client personal-profile path.
