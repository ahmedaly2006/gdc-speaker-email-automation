# GDC Speaker Email Automation

Reusable **Google Sheets + Google Apps Script + Gmail** workflow for sending personalized speaker voucher emails for GDC on Campus events (including DevFest).

> **Status:** Reconstructed repository-ready version of the previously tested workflow. The original exact Apps Script source was not available for verification; test this version with your team before production use.

## What it does

- Reads `Name`, `Email`, and **unique** `Voucher` from the `Speakers` sheet.
- Sends a personalized plain-text + HTML email through the account executing the script.
- Writes `Sent` and `Sent At` only after Gmail reports success; skips any non-pending row.
- Uses a lock to prevent simultaneous runs and a `Sending` state to reduce accidental duplicates.
- Sends a safe test to `TEST_EMAIL`, with a deliberately fake voucher, without modifying row status.
- Shows progress totals and processes up to 40 rows per run by default.

## Quick start

1. Create a Google Sheet and a worksheet/tab named **`Speakers`**.
2. Open **Extensions → Apps Script**. Paste `Code.gs` in the script editor. Enable editing the manifest in Project Settings if necessary and copy `appsscript.json`.
3. In **Project Settings → Script properties**, add:

   | Property | Example | Required? |
   |---|---|---|
   | `EVENT_NAME` | `DevFest SRH Berlin` | No (default `DevFest`) |
   | `EMAIL_SUBJECT` | `Your DevFest speaker discount voucher` | No |
   | `SENDER_NAME` | `GDC on Campus SRH Berlin` | No |
   | `REPLY_TO` | `team@example.com` | No |
   | `TEST_EMAIL` | `coordinator@example.com` | Yes, for testing |

4. Run `setupSheet` once from the Apps Script editor and approve Google permissions. **Do not run it on a sheet with different existing headers.**
5. Enter speakers using these **exact columns**, in this order:

   | Name | Email | Voucher | Status | Sent At | Error |
   |---|---|---|---|---|---|
   | Example Speaker | speaker@example.com | EXAMPLE-DO-NOT-USE | Pending | | |

6. Reload the Sheet to see the **GDC Emails** menu. Select **Send a test email** and inspect the message. The test uses a fake voucher and does not change Status.
7. Double-check every recipient and voucher. Select **Send pending speaker emails**. Check **Show progress** afterward.

## Menu items

| Menu action | Apps Script function | Behavior |
|---|---|---|
| Set up headers | `setupSheet` | Creates/validates `Speakers` headers |
| Send a test email | `sendTestEmail` | Test address only; no status changes |
| Send pending speaker emails | `sendPendingEmails` | Sends up to 40 blank/Pending rows |
| Show progress | `showProgress` | Counts Sent/Pending/Sending/Error |

## Retry policy and duplicate protection

- `Sent` is **never** sent again by the script. `Sending`, `Error`, and unexpected status values are also skipped.
- Before a Gmail call the row becomes `Sending`. If the script crashes or sheet writing fails, it may remain `Sending` even when the email was delivered. **Check the Gmail Sent folder before manually changing it back to `Pending`.**
- A row marked `Error` may also require checking Gmail Sent: an email API failure may be ambiguous. This is *at-most-once by automatic retry*, not a guarantee of exactly-once Gmail delivery.
- The script prevents duplicate voucher **values**, but does not automatically reject duplicate recipient email addresses. Review duplicates before sending.
- If Google imposes a daily Gmail quota, stop and continue when the quota resets. Do not bypass sending limits.

## Security

**Do not commit real speaker names, addresses, voucher URLs/codes, access tokens, or private account configuration.** Only the fake `speakers.example.csv` is tracked. Keep live data in the private team Sheet with minimal edit access. Use a private GitHub repository unless the team deliberately wants public source code.

## Reuse for future events

Copy the Sheet and Apps Script project. Replace the speakers and vouchers with a newly checked list, update script properties, run a fresh test, and then use manual sending batches. See [TEAM_GUIDE.md](TEAM_GUIDE.md).

## Repository contents

- `Code.gs` — full Apps Script code
- `appsscript.json` — Apps Script manifest
- `speakers.example.csv` — fake template input
- `TEAM_GUIDE.md` — handover and operational checklist
- `.gitignore` — prevents common local secrets/data files from being committed

## Publish to GitHub without a ZIP

1. At <https://github.com/new>, create a **private** repository named `gdc-speaker-email-automation` (do not initialize it with a README if you will push with Git).
2. On your computer, run from this extracted folder:

   ```bash
   git init
   git add Code.gs appsscript.json README.md TEAM_GUIDE.md speakers.example.csv .gitignore
   git commit -m "Add reusable GDC speaker email automation"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/gdc-speaker-email-automation.git
   git push -u origin main
   ```

Alternatively, on the new empty repository page, choose **uploading an existing file** and upload the six repository files individually. This avoids relying on a ZIP download.