# ⚽ The Gaffer's Den — Setup Guide

## Files Overview
| File | Purpose |
|------|---------|
| `index.html` | The entire frontend — deploy this to GitHub Pages |
| `Code.gs` | Google Apps Script backend — handles auth, emails, data |
| `matches_<xx>.json` | Your match data — update this for each matchday |

---

## Step 1 — Set Up Google Sheets + Apps Script

1. Go to [sheets.google.com](https://sheets.google.com) and create a **new spreadsheet**.  
   Name it something like `GaffersDen DB`.

2. In that spreadsheet, open **Extensions → Apps Script**.

3. Delete the default `function myFunction()` code and **paste the entire contents of `Code.gs`**.

4. At the top of `Code.gs`, fill in your config:
   ```js
   const ADMIN_EMAIL = 'your@email.com';      // where admin approval emails go, admin needs to click the link that is sent by the system to approve the user account creation
   const APP_URL     = 'https://yourusername.github.io/your-repo/';
   const SECRET_SALT = 'some_random_secret_string_change_this';
   ```

5. **Save** the script (Ctrl+S / Cmd+S).

---

## Step 2 — Deploy the Apps Script as a Web App

1. Click **Deploy → New Deployment**.
2. Click the gear icon ⚙️ next to "Type" and choose **Web App**.
3. Set:
   - **Execute as:** Me (your Google account)
   - **Who has access:** Anyone
4. Click **Deploy**. Authorise when prompted.
5. **Copy the Web App URL** — it looks like:  
   `https://script.google.com/macros/s/XXXXXXXX/exec`

---

## Step 3 — Add the URL to index.html

Open `index.html` and find this line near the top of the `<script>` section:

```js
const APPS_SCRIPT_URL = 'YOUR_APPS_SCRIPT_URL_HERE';
```

Replace `YOUR_APPS_SCRIPT_URL_HERE` with your Web App URL from Step 2.

Replace `MATCHES_XX_JSON_URL` with the corresponding `json` file

---

## Step 4 — Deploy to GitHub Pages

1. Create a new **GitHub repository** (e.g. `gaffers-den`).
2. Upload these three files to the repo root:
   - `index.html`
   - `matches.json`
3. Go to **Settings → Pages**.
4. Set source to **main branch / root**.
5. GitHub will give you a URL like `https://yourusername.github.io/gaffers-den/`.
6. Update `APP_URL` in `Code.gs` to match, then **re-deploy** the Apps Script.

Note: follow these steps to **re-deploy**:
1. Click **Deploy > Manage deployments**.
2. Select your active deployment and click the **Pencil (Edit)** icon.
3. Click the **Version** dropdown menu and select **New version**.
4. Click **Deploy** to push the fresh modifications live without changing your original URL or Deployment ID.
5. Double check the **APPS_SCRIPT_URL** with the **App Script URL**, should unchange.

---

## Step 5 — Test the Flow

1. Visit your GitHub Pages URL.
2. Click **Sign Up** — fill in the form.
3. Check `ADMIN_EMAIL` inbox — you should see an approval email.
4. Click the approval link → admin sees a confirmation page.
5. The user receives a confirmation email with the login link.
6. Login works — predictions can be made!

---

## Updating matches.json

Edit `matches.json` to add/update matches. The schema is:

```json
{
  "matches": [
    {
      "id": "m001",             ← unique ID (never change once set)
      "league": "Group C - Group stage",
      "home": "Mexico",
      "away": "South Africa",
      "rate": "",        ← update the match rate
      "kickoff": "2025-08-16T15:00:00+01:00",  ← ISO 8601 with timezone
      
      ← update these fields when a match is finished:
      "result": "",      ← put anything here, !blank is fine
      "homeScore": null,
      "awayScore": null
    }
  ]
}
```

**Picks lock automatically** when the current time passes `kickoff`. No server changes needed.

---

## Google Sheets Structure (auto-created)

The Apps Script will automatically create two sheets:

### `Users` sheet
| userId | name | email | passwordHash | status | createdAt | approvalToken |
|--------|------|-------|-------------|--------|-----------|---------------|

- `status` is `pending` until admin approves, then `approved`.
- You can manually set a status to `banned` to block a user.

### `Picks` sheet
| userId | matchId | pick | savedAt |
|--------|---------|------|---------|

- `pick` is `home` or `away`

---

## Points / Balance Logic

Currently: 
- If the result is `draw` -> nothing change
- If the result is `correct` or `wrong` -> Point rules:

| Stage | Point |
|--------|---------|
| Group stage | +/-1 pt |
| Round of 32 | +/-2 pt |
| Round of 16 | +/-3 pt |
| Quarter Final | +/-4 pt |
| Semi Final | +/-5 pt |
| Final / Third-place match | +/-10 pt |

**Note**: From matchId m072 onwards (knock-out rounds), unpick match will be treated as wrong result and point will be reducted follow the point rules.
---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Login says "Connection error" | Check `APPS_SCRIPT_URL` in index.html; redeploy Apps Script |
| Emails not sending | Check Apps Script execution logs; re-authorise permissions |
| Picks not saving | Make sure the Picks sheet exists (it auto-creates on first use) |
| CORS errors | Make sure Apps Script is deployed with "Anyone" access |
