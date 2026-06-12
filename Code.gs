// ═══════════════════════════════════════════════════════════════════
//  THE GAFFER'S DEN — Google Apps Script Backend
//  Paste this entire file into script.google.com → Deploy as Web App
// ═══════════════════════════════════════════════════════════════════

// ── CONFIG: fill these in before deploying ──────────────────────────
const ADMIN_EMAIL     = 'hoiquananhba2026@gmail.com';          // your email
const APP_URL         = 'https://kiemhung95.github.io/trump2026/'; // your GitHub Pages URL
const SHEET_ID        = '';  // leave blank to use the spreadsheet this script is bound to
const SECRET_SALT     = 'hoiquananhba';
// ────────────────────────────────────────────────────────────────────

// ── SHEET NAMES ──────────────────────────────────────────────────────
const SHEET_USERS   = 'Users';
const SHEET_PICKS   = 'Picks';

// ── COLUMN INDICES (1-based) ──────────────────────────────────────────
// Users sheet:  userId | name | email | passwordHash | status | createdAt
const U_ID    = 1, U_NAME = 2, U_EMAIL = 3, U_HASH = 4, U_STATUS = 5, U_CREATED = 6;
// Picks sheet:  userId | matchId | pick | savedAt
const P_USER  = 1, P_MATCH = 2, P_PICK = 3, P_SAVED = 4;

// ════════════════════════════════════════════════════════════════════
//  ROUTER — ALL requests via GET to avoid CORS preflight
//  API calls:       ?action=login&payload={"userId":"x","password":"y"}
//  Admin approval:  ?action=approve&token=xxx
// ════════════════════════════════════════════════════════════════════
function doGet(e) {
  try {
    const action = e.parameter.action || '';

    // Admin approval link — returns an HTML page
    if (action === 'approve') {
      return approveUser(e.parameter.token);
    }

    // All API actions — body is passed as JSON in ?payload=
    const body = JSON.parse(e.parameter.payload || '{}');
    let result;

    switch (action) {
      case 'signup':          result = signup(body);          break;
      case 'login':           result = login(body);           break;
      case 'getPicks':        result = getPicks(body);        break;
      case 'savePick':        result = savePick(body);        break;
      case 'getAllPicks':      result = getAllPicks();         break;
      case 'getDuplicatePicks': result = getDuplicatePicks(); break;
      default:                result = { success: false, message: 'Unknown action: ' + action };
    }

    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ success: false, message: 'Server error: ' + err.message });
  }
}

// doPost kept as fallback — not used by the frontend
function doPost(e) {
  return doGet(e);
}


// ════════════════════════════════════════════════════════════════════
//  SIGN UP
// ════════════════════════════════════════════════════════════════════
function signup({ name, userId, email, password }) {
  if (!name || !userId || !email || !password)
    return { success: false, message: 'All fields are required.' };

  const sheet = getSheet(SHEET_USERS);

  // Check if userId already exists
  const existing = findUser(userId);
  if (existing) return { success: false, message: 'User ID already taken.' };

  // Check email
  const allData = sheet.getDataRange().getValues();
  for (let i = 1; i < allData.length; i++) {
    if (allData[i][U_EMAIL - 1] === email)
      return { success: false, message: 'Email already registered.' };
  }

  const hash  = hashPassword(password);
  const token = generateToken(userId + email);

  // Add row with status = 'pending'
  sheet.appendRow([userId, name, email, hash, 'pending', new Date().toISOString()]);

  // Email admin with approval link
  const approveLink = ScriptApp.getService().getUrl()
    + '?action=approve&token=' + encodeURIComponent(token) + '&userId=' + encodeURIComponent(userId);

  MailApp.sendEmail({
    to: ADMIN_EMAIL,
    subject: `[Hội quán anh ba] New sign-up request from ${name} (${userId})`,
    body:
      `A new user has requested an account on Hoi Quan Anh Ba.\n\n` +
      `Name:    ${name}\n` +
      `User ID: ${userId}\n` +
      `Email:   ${email}\n\n` +
      `Click the link below to APPROVE their account:\n${approveLink}\n\n` +
      `If you do not recognise this request, ignore this email.`
  });

  // Store token temporarily in user row (append to a helper column or in a separate sheet)
  // Simple approach: store token in column 7
  const row = findUserRow(userId);
  if (row > 0) sheet.getRange(row, 7).setValue(token);

  return { success: true, message: 'Request submitted. Awaiting admin approval.' };
}


// ════════════════════════════════════════════════════════════════════
//  APPROVE (admin clicks email link)
// ════════════════════════════════════════════════════════════════════
function approveUser(token) {
  const sheet   = getSheet(SHEET_USERS);
  const allData = sheet.getDataRange().getValues();

  for (let i = 1; i < allData.length; i++) {
    if (allData[i][6] === token) {  // col 7 (index 6) = token
      const userId = allData[i][U_ID - 1];
      const name   = allData[i][U_NAME - 1];
      const email  = allData[i][U_EMAIL - 1];

      // Set status = 'approved'
      sheet.getRange(i + 1, U_STATUS).setValue('approved');
      // Clear token
      sheet.getRange(i + 1, 7).setValue('');

      // Email user
      MailApp.sendEmail({
        to: email,
        subject: `[Hội Quán Anh Ba] Your account is approved! ⚽`,
        body:
          `Hi ${name},\n\n` +
          `Great news! Your account has been approved.\n\n` +
          `Head over and login now:\n${APP_URL}\n\n` +
          `Your User ID: ${userId}\n\n` +
          `Good luck with your predictions! ⚽`
      });

      return HtmlService.createHtmlOutput(
        `<html><body style="font-family:sans-serif;text-align:center;padding:3rem;background:#0a0f0d;color:#e8f5e9">
          <h1 style="color:#00e676">✅ Account Approved!</h1>
          <p>${name} (${userId}) has been approved and notified by email.</p>
        </body></html>`
      );
    }
  }

  return HtmlService.createHtmlOutput(
    `<html><body style="font-family:sans-serif;text-align:center;padding:3rem;background:#0a0f0d;color:#e8f5e9">
      <h1 style="color:#ff1744">❌ Invalid or expired token</h1>
      <p>This approval link is no longer valid.</p>
    </body></html>`
  );
}


// ════════════════════════════════════════════════════════════════════
//  LOGIN
// ════════════════════════════════════════════════════════════════════
function login({ userId, password }) {
  if (!userId || !password)
    return { success: false, message: 'User ID and password required.' };

  const user = findUser(userId);
  if (!user) return { success: false, message: 'User not found.' };

  if (user.status === 'pending')
    return { success: false, message: 'Your account is awaiting admin approval.' };

  if (user.status !== 'approved')
    return { success: false, message: 'Account is not active.' };

  if (user.hash !== hashPassword(password))
    return { success: false, message: 'Incorrect password.' };

  return { success: true, userId: user.userId, name: user.name, email: user.email };
}


// ════════════════════════════════════════════════════════════════════
//  GET PICKS
// ════════════════════════════════════════════════════════════════════
function getPicks({ userId }) {
  const sheet = getSheet(SHEET_PICKS);
  const rows  = sheet.getDataRange().getValues();
  const picks = {};

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][P_USER - 1] === userId) {
      picks[rows[i][P_MATCH - 1]] = rows[i][P_PICK - 1];
    }
  }

  return { success: true, picks };
}


// ════════════════════════════════════════════════════════════════════
//  SAVE PICK
// ════════════════════════════════════════════════════════════════════
function savePick({ userId, matchId, pick }) {
  if (!userId || !matchId || !pick)
    return { success: false, message: 'Missing fields.' };

  const sheet = getSheet(SHEET_PICKS);
  const rows  = sheet.getDataRange().getValues();

  // Update if exists, else append
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][P_USER - 1] === userId && rows[i][P_MATCH - 1] === matchId) {
      sheet.getRange(i + 1, P_PICK).setValue(pick);
      sheet.getRange(i + 1, P_SAVED).setValue(new Date().toISOString());
      return { success: true };
    }
  }

  sheet.appendRow([userId, matchId, pick, new Date().toISOString()]);
  return { success: true };
}


// ════════════════════════════════════════════════════════════════════
//  REMOVE PICK  — deletes the row entirely so the user has no pick
// ════════════════════════════════════════════════════════════════════
function removePick({ userId, matchId }) {
  if (!userId || !matchId)
    return { success: false, message: 'Missing fields.' };

  const sheet = getSheet(SHEET_PICKS);
  const rows  = sheet.getDataRange().getValues();

  for (let i = rows.length - 1; i >= 1; i--) {
    if (rows[i][P_USER - 1] === userId && rows[i][P_MATCH - 1] === matchId) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }

  // Row didn't exist — that's fine, pick is already gone
  return { success: true };
}


// ════════════════════════════════════════════════════════════════════
//  GET ALL PICKS  (for leaderboard)
//  Returns: { success: true, picks: { userId: { __name__: 'Display Name', matchId: 'home'|'away', ... } } }
// ════════════════════════════════════════════════════════════════════
function getAllPicks() {
  // Build a userId → displayName map from the Users sheet
  const userSheet = getSheet(SHEET_USERS);
  const userRows  = userSheet.getDataRange().getValues();
  const nameMap   = {};
  for (let i = 1; i < userRows.length; i++) {
    const uid  = userRows[i][U_ID   - 1];
    const name = userRows[i][U_NAME - 1];
    if (uid) nameMap[uid] = name || uid;
  }

  // Collect all picks grouped by userId
  const pickSheet = getSheet(SHEET_PICKS);
  const pickRows  = pickSheet.getDataRange().getValues();
  const result    = {};

  for (let i = 1; i < pickRows.length; i++) {
    const uid     = pickRows[i][P_USER  - 1];
    const matchId = pickRows[i][P_MATCH - 1];
    const pick    = pickRows[i][P_PICK  - 1];
    if (!uid || !matchId || !pick) continue;

    if (!result[uid]) {
      result[uid] = { __name__: nameMap[uid] || uid };
    }
    result[uid][matchId] = pick;
  }

  return { success: true, picks: result };
}


// ════════════════════════════════════════════════════════════════════
//  FIND DUPLICATE PICKS
//  Finds rows where userId + matchId + pick are identical.
//  Writes a summary string to cell F1 of the Picks sheet in the format:
//    "row x:row y, row a:row b, ..."  (spreadsheet row numbers, 1-indexed)
//  Also returns the pairs via the API for programmatic use.
//
//  Usage via API: ?action=getDuplicatePicks
//  Or run findDuplicatePicks() directly from the script editor.
// ════════════════════════════════════════════════════════════════════
function findDuplicatePicks() {
  const sheet = getSheet(SHEET_PICKS);
  const rows  = sheet.getDataRange().getValues();

  // Build a map of key → [spreadsheet row numbers]
  // Key = "userId~matchId~pick"
  // Row numbers are 1-indexed (row 1 = header, data starts at row 2)
  const keyMap = {};
  for (let i = 1; i < rows.length; i++) {
    const uid     = rows[i][P_USER  - 1];
    const matchId = rows[i][P_MATCH - 1];
    const pick    = rows[i][P_PICK  - 1];
    if (!uid || !matchId || !pick) continue;

    const key = `${uid}~${matchId}~${pick}`;
    if (!keyMap[key]) keyMap[key] = [];
    keyMap[key].push(i + 1); // +1 because row 1 is the header
  }

  // Generate all pairs for each group of duplicates
  const pairs = [];
  for (const key in keyMap) {
    const group = keyMap[key];
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        pairs.push(`${group[i]}:${group[j]}`);
      }
    }
  }

  const summary = pairs.join(', ');

  // Write to F1 of the Picks sheet
  // Prepend a single quote so Sheets treats things like "353:354" as text, not a time format
  const textToWrite = summary ? "'" + summary : 'No duplicates found';
  sheet.getRange('F1').setValue(textToWrite);

  return { success: true, duplicates: summary || null, count: pairs.length };
}

// Convenience wrapper so it can be run directly from the script editor
// (e.g. as a menu item or timed trigger) without needing an HTTP call.
function getDuplicatePicks() {
  return findDuplicatePicks();
}


// ════════════════════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════════════════════
function getSheet(name) {
  const ss = SHEET_ID
    ? SpreadsheetApp.openById(SHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();

  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    // Add headers
    if (name === SHEET_USERS) {
      sheet.appendRow(['userId','name','email','passwordHash','status','createdAt','approvalToken']);
    } else if (name === SHEET_PICKS) {
      sheet.appendRow(['userId','matchId','pick','savedAt']);
    }
  }
  return sheet;
}

function findUser(userId) {
  const sheet   = getSheet(SHEET_USERS);
  const allData = sheet.getDataRange().getValues();
  for (let i = 1; i < allData.length; i++) {
    if (allData[i][U_ID - 1] === userId) {
      return {
        userId: allData[i][U_ID - 1],
        name:   allData[i][U_NAME - 1],
        email:  allData[i][U_EMAIL - 1],
        hash:   allData[i][U_HASH - 1],
        status: allData[i][U_STATUS - 1]
      };
    }
  }
  return null;
}

function findUserRow(userId) {
  const sheet   = getSheet(SHEET_USERS);
  const allData = sheet.getDataRange().getValues();
  for (let i = 1; i < allData.length; i++) {
    if (allData[i][U_ID - 1] === userId) return i + 1;
  }
  return -1;
}

function hashPassword(password) {
  return Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    password + SECRET_SALT,
    Utilities.Charset.UTF_8
  ).map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

function generateToken(seed) {
  return Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    seed + Date.now() + SECRET_SALT,
    Utilities.Charset.UTF_8
  ).map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('').substring(0, 40);
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
