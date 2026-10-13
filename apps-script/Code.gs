/**
 * Check Mate · email sender (Google Apps Script web app).
 *
 * The app (signed in as an admin) POSTs {idToken, messages:[{to, subject, html}]}.
 * Before sending, this script checks:
 *   1. the Firebase ID token is valid (Identity Toolkit accounts:lookup), with a verified email;
 *   2. that account is an admin: Firestore users/<email> has role "admin"
 *      (read with the caller's own token, so the database rules apply).
 * Emails go out from the Google account that deployed this script.
 *
 * Deploy: Deploy → New deployment → Web app → Execute as: Me · Who has access: Anyone.
 * Paste the /exec URL in Check Mate → Άτομα → Ειδοποιήσεις email.
 */
const FIREBASE_API_KEY = "AIzaSyAH1gHQNNCsZyQXK9pnjL6Xx0VlGCW6YWY";
const FIREBASE_PROJECT = "checkmate-33472";
const MAX_MESSAGES = 60;

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const admin = verifyAdmin_(body.idToken);
    if (!admin) return json_({ ok: false, error: "forbidden" });
    let sent = 0;
    const list = (body.messages || []).slice(0, MAX_MESSAGES);
    for (const m of list) {
      const to = String(m.to || "").trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) continue;
      MailApp.sendEmail({
        to: to,
        subject: String(m.subject || "Check Mate").slice(0, 200),
        htmlBody: String(m.html || ""),
        name: "Check Mate",
        replyTo: admin
      });
      sent++;
    }
    return json_({ ok: true, sent: sent, quota: MailApp.getRemainingDailyQuota() });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function doGet() {
  return json_({ ok: true, service: "Check Mate mail", quota: MailApp.getRemainingDailyQuota() });
}

function verifyAdmin_(idToken) {
  if (!idToken) return null;
  const look = UrlFetchApp.fetch(
    "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + FIREBASE_API_KEY,
    { method: "post", contentType: "application/json", payload: JSON.stringify({ idToken: idToken }), muteHttpExceptions: true }
  );
  if (look.getResponseCode() !== 200) return null;
  const users = JSON.parse(look.getContentText()).users || [];
  const u = users[0];
  if (!u || !u.email || !u.emailVerified) return null;
  const email = String(u.email).toLowerCase();
  const doc = UrlFetchApp.fetch(
    "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT + "/databases/(default)/documents/users/" + encodeURIComponent(email),
    { headers: { Authorization: "Bearer " + idToken }, muteHttpExceptions: true }
  );
  if (doc.getResponseCode() !== 200) return null;
  const f = JSON.parse(doc.getContentText()).fields || {};
  return f.role && f.role.stringValue === "admin" ? email : null;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/** Run once from the editor to grant permissions (sends a test email to yourself). */
function authorize() {
  MailApp.sendEmail(Session.getActiveUser().getEmail(), "Check Mate: η αποστολή email ενεργοποιήθηκε", "Οι ειδοποιήσεις του Check Mate θα στέλνονται από αυτόν τον λογαριασμό.");
}
