> Latest email implementation: direct Brevo M2M integration replaces the Trigger Email queue described below. See [email and cost setup](email-cost-setup.md) for current status and limits.

# Current account, Tavus and email setup

The public page and login contain no prefilled patient data. The local .env enables Firebase sign-in. New verified accounts begin with no profiles; create a profile, add your own medicines and appointments, then invite caregivers or doctors. Backend Functions and App Check must be configured before profile creation works.

The login uses a local SVG illustration and a lime form panel, in Hindi and English. Offline test fixtures remain isolated from live accounts.

Tavus deployment `d7a059cb-5260-40d7-bcb8-26d508c505a0` loads only after selecting Open Tavus conversation. Configure allowed website origins in Tavus. No API key is exposed. This embed has no private profile context or action tool bridge yet; the separate existing care controls remain functional. No live Tavus session was tested.

Missed-dose email settings are editable only by a caretaker. The scheduler queues a deterministic server-only document in the root `mail` collection for Firebase Trigger Email. Install and configure that extension with your SMTP service and a verified sender. Set functions MOCK_MODE=false only for live delivery. The extension requires an external SMTP service; Firebase alone is not a custom email delivery provider. No SMS is used.

The app displays queued email as pending. Inspect the extension's mail document delivery field for actual delivery outcome; automated receipt synchronization is not yet implemented. Configure the extension before enabling reminders. No live email was sent or provider configured by this change.

Reference: https://firebase.google.com/docs/extensions/official/firestore-send-email

