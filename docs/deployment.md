# Deployment, secrets and cost controls

## Production

Firebase project: `sanjeevani-5b35b`.

```sh
npm ci
npm run check
firebase deploy --only hosting,firestore --project sanjeevani-5b35b
```

This serves the built `web/dist` SPA and installs the repository's Firestore rules/indexes. It does not deploy Functions, enable billing or run a scheduler. Enable Email/Password in Firebase Authentication and create the default Firestore database first. Verify your authorized domain in Auth settings. The current project has both configured; billing was verified disabled.

Use ignored root `.env` for Firebase's public web configuration and `VITE_MOCK_MODE=false`. Use `.env.example` as a clean-checkout template. Public Firebase configuration identifies the project; rules and verified authentication protect records. Never put server secrets in `VITE_` variables.

## Speech

In local development only, put `SARVAM_API_KEY` in ignored `.env.local`, then restart `npm run dev`. `/api/tts` accepts same-origin loopback requests and keeps the key on the server. It selects Hindi or English, caches the last 20 utterances, allows at most 600 characters/request, 3,000 attempted characters/day and 30 attempts/day, and never automatically retries provider requests. Keep `.env.sarvam-budget.json`: restarting must not reset the daily budget. These are local limits, not an account-wide monetary cap.

Static Firebase Hosting cannot run this secret proxy. Hosted speech uses the device's voice without a Sarvam request. A production Sarvam integration requires a separate authenticated backend; the app does not expose the key to avoid that requirement. Browser speech recognition may itself use the browser vendor's service.

Tavus video is optional, starts only through the consent flow and has its own credits. See [Tavus setup and evidence](tavus.md). Firebase's free tier does not make Tavus or Sarvam free.

## Reminders and email

Firebase Authentication sends verification and password-reset emails. Custom medication emails, SMS and background escalation are not enabled. Reminders work while the page stays open. The experimental Brevo/Functions code is excluded from deployment and does not run on Firebase Spark.

## Troubleshooting

- `auth/configuration-not-found`: enable Firebase Authentication and its Email/Password provider in the selected project.
- `Missing or insufficient permissions`: verify email, reload, then Retry loading profiles. The loader refreshes token claims. Confirm `.env` points at the same project as the deployed rules. Do not replace rules with public access.
- Empty care space: expected for a new account. Add a profile, then your own medicines/appointments.
- Video unavailable: check deployment availability, visitor limit, supported browser, microphone permission and provider challenge/origin settings. Do not repeatedly start a credit-consuming call.
- Voice unavailable: try the text/large-button controls. Device Hindi voices depend on browser/OS support.

No automated system can guarantee a hard rupee spending ceiling across external provider accounts. Firebase billing remains disabled; optional provider usage is bounded separately.
