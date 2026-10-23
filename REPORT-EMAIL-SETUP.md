# Report a Problem email — setup

Problem reports are always stored in the app (Settings → Administration →
Diagnostics lists the recent ones, and admins get an in-app notification).
Email delivery is an optional side channel: when it is configured, each
report is also emailed to an address you choose.

## Worker secrets

Set these three secrets on the Worker:

| Secret | Value |
|---|---|
| `RESEND_API_KEY` | An API key from your Resend account |
| `REPORT_FROM_EMAIL` | A sender on a domain you have verified in Resend, e.g. `ScreenDen <support@your-domain.example>` |
| `REPORT_TO_EMAIL` | The mailbox that should receive reports — your own admin address |

If any of the three is missing, reports are stored in the app only and
nothing is sent. There is no built-in recipient address.

## Steps

1. Verify your sending domain in Resend and add the DNS records it asks for.
2. Create a Resend API key.
3. Add the three secrets above in your Worker's Settings → Variables and Secrets.
4. Deploy (or redeploy) `worker.js`.
5. Submit a test report from the app and confirm it arrives at
   `REPORT_TO_EMAIL` and also appears in the admin report list.

Never put the Resend API key in frontend code or commit it to source control.

## Validation status

- The diagnostics check reports the email channel as configured only when
  all three secrets are present.
- Actual Resend delivery requires your own account credentials and has not
  been live-tested by the project.
