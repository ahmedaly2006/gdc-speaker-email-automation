# GDC team playbook

## Before every event

1. Make a **copy** of the prior Google Sheet and Apps Script project, or start a new Google Sheet and paste `Code.gs` into Extensions > Apps Script.
2. Set **Project Settings > Script properties**: `EVENT_NAME`, `EMAIL_SUBJECT`, `SENDER_NAME`, `REPLY_TO` (optional), and `TEST_EMAIL` (required to test). Do not store passwords or voucher pools in GitHub.
3. Create a tab named `Speakers`, run `setupSheet`, and populate rows with unique speaker emails and vouchers. Follow the column order in `speakers.example.csv`.
4. Review each recipient and voucher for accuracy. Each voucher must be unique. Use one row per speaker; duplicate recipient emails should be investigated manually.
5. Run `sendTestEmail` with a dedicated example row; check formatting, sender, subject, and reply-to. The test intentionally substitutes a fake voucher, and does not mark rows Sent.
6. Start with 1-2 real rows; run `sendPendingEmails`; confirm messages in Gmail Sent and rows in the sheet. Then continue in batches (max 40 per run).
7. Use `showProgress` and check `Error` and `Sending` rows before any retry. Archive a private copy of the event Sheet in the team's authorized Drive location.

## Status meanings

- Blank / `Pending`: eligible to send.
- `Sending`: a send was started. **Never blindly reset this**—check Gmail Sent first.
- `Sent`: completed; automatically skipped on future runs.
- `Error`: an attempt reported a failure; investigate Gmail Sent before manually setting `Pending` to retry.

## Access and safety

- Give edit access to the Sheet only to event coordinators who require contact and voucher data.
- Never paste real recipient lists, voucher codes, `.clasp.json`, or credentials into GitHub issues, commits, or pull requests.
- The person running the script authorizes Gmail and Sheets access with their own Google account. Gmail sending quotas and organization policies apply.
- This is a manual-batch workflow, not an always-on trigger. Do not add a time trigger before reviewing quotas, permissions, and error handling.
- If more than one event is running, use independent spreadsheet copies and Apps Script projects to prevent mixed vouchers and sends.