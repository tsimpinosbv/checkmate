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
 * Exception — «Δεν μπορώ»: any signed-in user may POST {idToken, kind:"cant", item:{…}}.
 * That email goes ONLY to the admin address(es) saved in Firestore config/notify.adminAlert (comma-separated)
 * (read with the caller's token), never to an address taken from the request, and at most
 * a few times per user every 10 minutes.
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
    if (body.kind === "cant") return json_(cantMail_(body));
    const admin = verifyAdmin_(body.idToken);
    if (!admin) return json_({ ok: false, error: "forbidden" });
    const senderName = String(body.senderName || "Check Mate").slice(0, 80);
    const replyTo = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(body.replyTo || "")) ? String(body.replyTo) : admin;
    let sent = 0;
    const list = (body.messages || []).slice(0, MAX_MESSAGES);
    for (const m of list) {
      const to = String(m.to || "").trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) continue;
      MailApp.sendEmail({
        to: to,
        subject: String(m.subject || "Check Mate").slice(0, 200),
        htmlBody: String(m.html || ""),
        name: senderName,
        replyTo: replyTo
      });
      sent++;
    }
    return json_({ ok: true, sent: sent, account: Session.getEffectiveUser().getEmail(), quota: MailApp.getRemainingDailyQuota() });
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

/* «Δεν μπορώ» from a user → one email to the admin (address from config/notify, not from the request) */
function cantMail_(body) {
  const u = lookup_(body.idToken);
  if (!u) return { ok: false, error: "forbidden" };
  const cache = CacheService.getScriptCache(), key = "cant_" + u.localId, n = Number(cache.get(key) || 0);
  if (n >= 6) return { ok: false, error: "too-many" };
  cache.put(key, String(n + 1), 600);
  const doc = UrlFetchApp.fetch(
    "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT + "/databases/(default)/documents/config/notify",
    { headers: { Authorization: "Bearer " + body.idToken }, muteHttpExceptions: true }
  );
  if (doc.getResponseCode() !== 200) return { ok: false, error: "no-config" };
  const f = JSON.parse(doc.getContentText()).fields || {};
  const list = (f.adminAlert && f.adminAlert.stringValue ? String(f.adminAlert.stringValue) : "").split(/[,;\s]+/)
    .map(x => x.trim()).filter(x => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x)).slice(0, 5);
  if (!list.length) return { ok: false, error: "no-recipient" };
  const to = list.join(",");
  const it = body.item || {}, t = k => esc_(String(it[k] || "").slice(0, 300));
  const who = t("name") || esc_(u.email || "Χρήστης");
  const game = [t("home"), t("away")].filter(String).join(" – ");
  const when = [t("date"), t("time")].filter(String).join(" · ");
  const subject = (it.undo ? "Check Mate: ακύρωση «Δεν μπορώ» — " : "Check Mate: «Δεν μπορώ» — ") + String(it.name || u.email || "").slice(0, 80);
  const rows = [["Άτομο", who], ["Θέση", t("role")], ["Αγώνας", game], ["Ημέρα", when], ["Γήπεδο", t("venue")], ["Λόγος", it.undo ? "" : t("note")]]
    .filter(r => r[1]).map(r => '<tr><td style="padding:4px 12px 4px 0;color:#667">' + r[0] + '</td><td style="padding:4px 0"><b>' + r[1] + "</b></td></tr>").join("");
  const html = '<div style="font-family:Arial,sans-serif;font-size:15px;color:#14213a">' +
    (it.undo ? "<p>Ο/Η <b>" + who + "</b> <b>ακύρωσε</b> τη δήλωση «Δεν μπορώ»· μπορεί τελικά να καλύψει τον αγώνα.</p>"
             : "<p>✋ Ο/Η <b>" + who + "</b> δηλώνει ότι <b>δεν μπορεί</b> να καλύψει τον αγώνα:</p>") +
    '<table style="border-collapse:collapse">' + rows + "</table>" +
    '<p style="color:#667;font-size:13px">Ανοίξτε το Check Mate → Πρόγραμμα για αλλαγή ατόμου.</p></div>';
  const fromName = f.senderName && f.senderName.stringValue ? String(f.senderName.stringValue).slice(0, 80) : "Check Mate";
  const mail = { to: to, subject: subject.slice(0, 200), htmlBody: html, name: fromName };
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(u.email || ""))) mail.replyTo = String(u.email);
  MailApp.sendEmail(mail);
  return { ok: true, sent: 1 };
}

function lookup_(idToken) {
  if (!idToken) return null;
  const look = UrlFetchApp.fetch(
    "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + FIREBASE_API_KEY,
    { method: "post", contentType: "application/json", payload: JSON.stringify({ idToken: idToken }), muteHttpExceptions: true }
  );
  if (look.getResponseCode() !== 200) return null;
  const u = (JSON.parse(look.getContentText()).users || [])[0];
  return u && u.localId ? u : null;
}

function esc_(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/** Run once from the editor to grant permissions (sends a test email to yourself). */
function authorize() {
  MailApp.sendEmail(Session.getActiveUser().getEmail(), "Check Mate: η αποστολή email ενεργοποιήθηκε", "Οι ειδοποιήσεις του Check Mate θα στέλνονται από αυτόν τον λογαριασμό.");
}

/* ---------- Weekly full backup of the database to Google Drive ----------
 * Every Sunday 23:00 (Athens) all Firestore documents are saved as one .json file in
 * Drive → «Check Mate Backup» → «Αυτόματα αντίγραφα». The newest 12 are kept (older ones go to the Trash).
 * Restore: Check Mate → Βάση → «Επαναφορά από πλήρες αντίγραφο».
 * One-time setup: this Google account must have the role «Viewer» in the Firebase project;
 * then run setupBackup() from the editor (Run) and allow the permissions.
 * Only if a backup fails, an email is sent to this account. */
const BACKUP_FOLDER = "Check Mate Backup";
const BACKUP_SUBFOLDER = "Αυτόματα αντίγραφα";
const BACKUP_KEEP = 12;
const FS_ROOT = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT + "/databases/(default)/documents";

function setupBackup() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === "backupWeekly").forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("backupWeekly").timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(23).inTimezone("Europe/Athens").create();
  const r = backupNow();
  Logger.log("Εβδομαδιαίο αντίγραφο ενεργό (Κυριακή 23:00). Πρώτο αντίγραφο: " + r);
  return r;
}

function backupWeekly() {
  try { backupNow(); }
  catch (err) {
    MailApp.sendEmail(Session.getEffectiveUser().getEmail(), "Check Mate: το αυτόματο αντίγραφο απέτυχε",
      "Το εβδομαδιαίο αντίγραφο της βάσης δεν ολοκληρώθηκε.\n\nΣφάλμα: " + String(err && err.message || err) +
      "\n\nΔοκιμάστε ξανά από το Apps Script «Check Mate - email»: επιλέξτε backupNow και πατήστε Run.");
  }
}

function backupNow() {
  const token = ScriptApp.getOAuthToken();
  const call = (url, opt) => {
    for (let i = 0; i < 4; i++) {
      const r = UrlFetchApp.fetch(url, Object.assign({ headers: { Authorization: "Bearer " + token }, contentType: "application/json", muteHttpExceptions: true }, opt || {}));
      const c = r.getResponseCode();
      if (c === 200) return JSON.parse(r.getContentText() || "{}");
      if (c === 429 || c >= 500) { Utilities.sleep(1500 * (i + 1)); continue; }
      throw new Error("Firestore " + c + ": " + r.getContentText().slice(0, 300));
    }
    throw new Error("Firestore: δεν απαντά");
  };
  const collIds = url => { let ids = [], tok = "";
    do { const j = call(url + ":listCollectionIds", { method: "post", payload: JSON.stringify(tok ? { pageSize: 100, pageToken: tok } : { pageSize: 100 }) });
         ids = ids.concat(j.collectionIds || []); tok = j.nextPageToken; } while (tok);
    return ids; };
  const listDocs = path => { let out = [], tok = "";
    do { const j = call(FS_ROOT + "/" + path + "?pageSize=300&showMissing=true" + (tok ? "&pageToken=" + encodeURIComponent(tok) : ""));
         out = out.concat(j.documents || []); tok = j.nextPageToken; } while (tok);
    return out; };
  const docs = {};
  const walk = (path, depth) => {
    const list = listDocs(path);
    list.forEach(d => { if (d.createTime) docs[d.name.split("/documents/")[1]] = d.fields || {}; });
    if (depth >= 2) return;
    // look for sub-collections under every document of small collections; in big ones (the programme) only under a few
    const check = list.length <= 60 ? list : list.filter(d => !d.createTime).concat(list.filter(d => d.createTime).slice(0, 5));
    check.forEach(d => collIds("https://firestore.googleapis.com/v1/" + d.name).forEach(c => walk(d.name.split("/documents/")[1] + "/" + c, depth + 1)));
  };
  collIds(FS_ROOT).forEach(c => walk(c, 0));
  const n = Object.keys(docs).length;
  if (!n) throw new Error("Η βάση φαίνεται άδεια ή δεν υπάρχει πρόσβαση");
  const data = { app: "Check Mate", kind: "full-backup", project: FIREBASE_PROJECT, createdAt: new Date().toISOString(), count: n, docs: docs };
  const name = "CheckMate_Backup_" + Utilities.formatDate(new Date(), "Europe/Athens", "yyyy-MM-dd_HHmm") + ".json";
  const folder = backupFolder_();
  folder.createFile(name, JSON.stringify(data), "application/json");
  const files = []; const it = folder.getFiles();
  while (it.hasNext()) { const f = it.next(); if (/^CheckMate_Backup_.*\.json$/.test(f.getName())) files.push(f); }
  files.sort((a, b) => b.getDateCreated() - a.getDateCreated()).slice(BACKUP_KEEP).forEach(f => f.setTrashed(true));
  return name + " · " + n + " έγγραφα";
}

function backupFolder_() {
  const get = (parent, name) => { const it = parent.getFoldersByName(name); return it.hasNext() ? it.next() : parent.createFolder(name); };
  return get(get(DriveApp.getRootFolder(), BACKUP_FOLDER), BACKUP_SUBFOLDER);
}
