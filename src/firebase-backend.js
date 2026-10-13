/* Firebase backend for GitHub Pages.
   Provides the same claude.use("db" | "user" | "downloads") interface the app was written against,
   backed by Firebase Authentication (email/password or Google) and Cloud Firestore.
   Also: the sign-in / sign-up screen and the "install on phone" button.
   Admins: users/<email> with role "admin" (or admins/<uid>) — see README and firestore.rules. */
(function(){
  const cfg = window.FIREBASE_CONFIG || {};
  const configured = !!(cfg.apiKey && cfg.projectId && window.firebase);
  let fs = null, auth = null;

  const css = `
  #cm-auth{--ink:#14213a;--muted:#5d6b84;--line:#d9dfea;--surface:#fff;--accent:#f0821e;--blue:#2a7fd4;--bad:#c43a2c;--good:#1d8a52;
    box-sizing:border-box;width:min(420px,100% - 32px);margin:48px auto 90px;padding:26px 22px 22px;font:15px "Commissioner",system-ui,sans-serif;color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:16px}
  #cm-auth *{box-sizing:border-box}
  #cm-auth .brand{display:flex;align-items:center;gap:12px;margin-bottom:18px}
  #cm-auth .brand img{width:48px;height:48px}
  #cm-auth h1{font:800 30px/1 "Fira Sans Extra Condensed",system-ui,sans-serif;margin:0;text-transform:uppercase;letter-spacing:.01em}
  #cm-auth h1 span{color:var(--accent)}
  #cm-auth .sub{color:var(--muted);font-size:13px;margin-top:3px}
  #cm-auth .tabs{display:grid;grid-template-columns:1fr 1fr;border:1px solid var(--line);border-radius:10px;overflow:hidden;margin-bottom:16px}
  #cm-auth .tabs button{border:0;background:none;padding:10px;font:600 14px "Commissioner",system-ui,sans-serif;color:var(--muted);cursor:pointer}
  #cm-auth .tabs button[aria-selected="true"]{background:var(--ink);color:#fff}
  #cm-auth form{display:flex;flex-direction:column;gap:12px}
  #cm-auth label{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
  #cm-auth input{font:16px "Commissioner",system-ui,sans-serif;padding:11px 12px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--ink);width:100%;text-transform:none;letter-spacing:0}
  #cm-auth input:focus{outline:2px solid var(--blue);outline-offset:1px;border-color:transparent}
  #cm-auth .primary{font:600 16px "Commissioner",system-ui,sans-serif;padding:12px 18px;border-radius:10px;border:0;background:var(--accent);color:#fff;cursor:pointer;margin-top:4px}
  #cm-auth .primary:disabled{opacity:.6;cursor:default}
  #cm-auth .link{border:0;background:none;color:var(--blue);font:500 14px "Commissioner",system-ui,sans-serif;cursor:pointer;padding:4px 0;align-self:flex-start}
  #cm-auth .or{display:flex;align-items:center;gap:10px;color:var(--muted);font-size:13px;margin:16px 0}
  #cm-auth .or::before,#cm-auth .or::after{content:"";flex:1;height:1px;background:var(--line)}
  #cm-auth .google{width:100%;display:flex;align-items:center;justify-content:center;gap:10px;font:600 15px "Commissioner",system-ui,sans-serif;padding:11px;border-radius:10px;border:1px solid var(--line);background:var(--surface);color:var(--ink);cursor:pointer}
  #cm-auth .msg{font-size:14px;line-height:1.45;border-radius:8px;padding:9px 11px}
  #cm-auth .msg.err{color:var(--bad);background:#fbe9e7}
  #cm-auth .msg.ok{color:var(--good);background:#e3f4ea}
  #cm-auth .hint{color:var(--muted);font-size:13px;line-height:1.45;margin:0}
  #cm-auth p.lead{color:var(--muted);margin:0 0 14px;line-height:1.5}
  #cm-dock{position:fixed;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:50;display:flex;gap:8px;align-items:center}
  #cm-dock button{font:600 12px "Commissioner",system-ui,sans-serif;padding:7px 11px;border-radius:999px;border:1px solid #d9dfea;background:#fff;color:#14213a;cursor:pointer;box-shadow:0 1px 4px rgba(20,33,58,.12)}
  #cm-dock button.install{background:#f0821e;color:#fff;border-color:#f0821e}
  #cm-dock button[hidden]{display:none}
  #cm-ios{position:fixed;left:12px;right:12px;bottom:calc(60px + env(safe-area-inset-bottom,0px));z-index:51;max-width:420px;margin:0 auto;background:#14213a;color:#fff;border-radius:14px;padding:14px 16px;font:14px/1.5 "Commissioner",system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.25)}
  #cm-ios[hidden]{display:none}
  #cm-ios b{color:#f0821e}
  #cm-ios button{float:right;border:0;background:none;color:#fff;font-size:20px;line-height:1;cursor:pointer;margin:-4px -6px 0 8px}
  @media (prefers-color-scheme: dark){
    :root:not([data-theme="light"]) #cm-auth{--ink:#eef2f8;--muted:#a9b4c8;--line:#33405a;--surface:#1b2436}
    :root:not([data-theme="light"]) #cm-auth .tabs button[aria-selected="true"]{background:#eef2f8;color:#14213a}
    :root:not([data-theme="light"]) #cm-auth .msg.err{background:#3a1f1f}
    :root:not([data-theme="light"]) #cm-auth .msg.ok{background:#16301f}
    :root:not([data-theme="light"]) #cm-dock button:not(.install){background:#1b2436;color:#eef2f8;border-color:#33405a}
  }`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  const esc = s => String(s??"").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function rootEl(){ return document.getElementById("root") || document.body; }

  /* ---------- install on phone / computer ---------- */
  const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  let deferredPrompt = null;
  if("serviceWorker" in navigator){ addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(()=>{})); }
  addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferredPrompt = e; updateDock(); });
  addEventListener("appinstalled", () => { deferredPrompt = null; updateDock(); });

  function dock(){
    let d = document.getElementById("cm-dock");
    if(!d){
      d = document.createElement("div"); d.id = "cm-dock";
      d.innerHTML = `<button type="button" class="install" id="cm-install" hidden>📲 Εγκατάσταση</button><button type="button" id="cm-signout" hidden>Αποσύνδεση</button>`;
      document.body.appendChild(d);
      const tip = document.createElement("div"); tip.id = "cm-ios"; tip.hidden = true; tip.setAttribute("role","dialog");
      tip.innerHTML = `<button type="button" aria-label="Κλείσιμο" id="cm-ios-x">×</button><b>Εγκατάσταση στο iPhone</b><br>1. Πάτησε το κουμπί <b>Κοινοποίηση</b> (το τετράγωνο με το βέλος ↑) στο Safari.<br>2. Επίλεξε <b>Προσθήκη στην οικία</b>.<br>3. Πάτησε <b>Προσθήκη</b>.`;
      document.body.appendChild(tip);
      document.getElementById("cm-ios-x").onclick = () => { tip.hidden = true; };
      document.getElementById("cm-install").onclick = async () => {
        if(deferredPrompt){ deferredPrompt.prompt(); try{ await deferredPrompt.userChoice; }catch{} deferredPrompt = null; updateDock(); }
        else if(isIOS()) tip.hidden = !tip.hidden;
      };
      document.getElementById("cm-signout").onclick = async () => { await auth.signOut(); location.reload(); };
    }
    return d;
  }
  function updateDock(){
    const d = dock();
    d.querySelector("#cm-install").hidden = isStandalone() || !(deferredPrompt || isIOS());
    d.querySelector("#cm-signout").hidden = !(auth && auth.currentUser);
  }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", updateDock); else updateDock();

  /* ---------- sign-in / sign-up screen ---------- */
  const ERR = {
    "auth/invalid-email":"Το email δεν είναι σωστό.",
    "auth/missing-password":"Γράψε τον κωδικό σου.",
    "auth/invalid-credential":"Λάθος email ή κωδικός.",
    "auth/invalid-login-credentials":"Λάθος email ή κωδικός.",
    "auth/wrong-password":"Λάθος email ή κωδικός.",
    "auth/user-not-found":"Λάθος email ή κωδικός.",
    "auth/user-disabled":"Ο λογαριασμός έχει απενεργοποιηθεί. Μίλησε με τον διαχειριστή.",
    "auth/email-already-in-use":"Υπάρχει ήδη λογαριασμός με αυτό το email. Κάνε είσοδο, ή «Ξέχασα τον κωδικό».",
    "auth/weak-password":"Ο κωδικός θέλει τουλάχιστον 6 χαρακτήρες.",
    "auth/too-many-requests":"Πολλές προσπάθειες. Περίμενε λίγο και δοκίμασε ξανά.",
    "auth/network-request-failed":"Δεν υπάρχει σύνδεση στο διαδίκτυο.",
    "auth/operation-not-allowed":"Η είσοδος με email δεν είναι ενεργή ακόμα. Μίλησε με τον διαχειριστή.",
    "auth/account-exists-with-different-credential":"Αυτό το email χρησιμοποιεί άλλο τρόπο εισόδου. Δοκίμασε «Συνέχεια με Google»."
  };
  const errText = e => ERR[e && e.code] || "Κάτι πήγε στραβά. Δοκίμασε ξανά.";
  const googleSvg = `<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`;
  let pendingSignup = null;

  function showSetup(){
    rootEl().innerHTML = `<div id="cm-auth"><h1>Check <span>Mate</span></h1><p class="lead" style="margin-top:12px">Η εφαρμογή δεν έχει ρυθμιστεί ακόμα. Συμπλήρωσε τα στοιχεία Firebase στο αρχείο <code>firebase-config.js</code>.</p></div>`;
  }
  function showAuth(view="login", msg=null, email=""){
    const head = `<div class="brand"><img src="icons/icon-192.png" alt=""><div><h1>Check <span>Mate</span></h1><div class="sub">Video Check · αγώνες &amp; αναθέσεις</div></div></div>`;
    const note = msg ? `<div class="msg ${msg.ok?"ok":"err"}" role="${msg.ok?"status":"alert"}">${esc(msg.text)}</div>` : "";
    let body;
    if(view==="reset"){
      body = `<p class="lead">Γράψε το email σου και θα σου στείλουμε σύνδεσμο για νέο κωδικό.</p>
      <form id="cm-f" novalidate>
        <label>Email<input id="cm-email" type="email" autocomplete="email" inputmode="email" required value="${esc(email)}"></label>
        ${note}
        <button class="primary" type="submit">Αποστολή συνδέσμου</button>
        <button class="link" type="button" data-view="login">← Πίσω στην είσοδο</button>
      </form>`;
    } else {
      const reg = view==="register";
      body = `<div class="tabs" role="tablist">
        <button type="button" role="tab" aria-selected="${!reg}" data-view="login">Είσοδος</button>
        <button type="button" role="tab" aria-selected="${reg}" data-view="register">Εγγραφή</button></div>
      <form id="cm-f" novalidate>
        ${reg?`<label>Ονοματεπώνυμο<input id="cm-name" autocomplete="name" required placeholder="π.χ. Γιάννης Παπαδόπουλος"></label>`:""}
        <label>Email<input id="cm-email" type="email" autocomplete="email" inputmode="email" required value="${esc(email)}"></label>
        <label>Κωδικός<input id="cm-pass" type="password" autocomplete="${reg?"new-password":"current-password"}" required minlength="6"></label>
        ${reg?`<label>Επανάληψη κωδικού<input id="cm-pass2" type="password" autocomplete="new-password" required minlength="6"></label><p class="hint">Τουλάχιστον 6 χαρακτήρες.</p>`:""}
        ${note}
        <button class="primary" type="submit">${reg?"Δημιουργία λογαριασμού":"Είσοδος"}</button>
        ${reg?"":`<button class="link" type="button" data-view="reset">Ξέχασα τον κωδικό</button>`}
      </form>
      <div class="or">ή</div>
      <button type="button" class="google" id="cm-google">${googleSvg} Συνέχεια με Google</button>`;
    }
    rootEl().innerHTML = `<div id="cm-auth">${head}${body}</div>`;
    const box = document.getElementById("cm-auth");
    box.querySelectorAll("[data-view]").forEach(b => b.onclick = () => showAuth(b.dataset.view, null, (document.getElementById("cm-email")||{}).value||email));
    const g = document.getElementById("cm-google"); if(g) g.onclick = google;
    const f = document.getElementById("cm-f");
    f.onsubmit = async e => {
      e.preventDefault();
      const val = id => (document.getElementById(id)||{}).value || "";
      const em = val("cm-email").trim();
      const btn = f.querySelector(".primary"); btn.disabled = true;
      try{
        if(view==="reset"){
          if(!em) throw {code:"auth/invalid-email"};
          await auth.sendPasswordResetEmail(em);
          showAuth("login", {ok:true, text:"Αν υπάρχει λογαριασμός με αυτό το email, θα λάβεις σύνδεσμο για νέο κωδικό. Κοίτα και στα ανεπιθύμητα."}, em);
          return;
        }
        if(view==="register"){
          const name = val("cm-name").trim(), p1 = val("cm-pass"), p2 = val("cm-pass2");
          if(!name){ showAuth("register", {text:"Γράψε το ονοματεπώνυμό σου."}, em); return; }
          if(p1 !== p2){ showAuth("register", {text:"Οι δύο κωδικοί δεν είναι ίδιοι."}, em); return; }
          let finish; pendingSignup = new Promise(r => finish = r);
          try{
            const cred = await auth.createUserWithEmailAndPassword(em, p1);
            try{ await cred.user.updateProfile({displayName:name}); }catch{}
          } finally { finish(); pendingSignup = null; }
          return;
        }
        await auth.signInWithEmailAndPassword(em, val("cm-pass"));
      }catch(err){
        showAuth(view, {text:errText(err)}, em);
      }
    };
    updateDock();
  }
  async function google(){
    const provider = new firebase.auth.GoogleAuthProvider();
    try{ await auth.signInWithPopup(provider); }
    catch(e){
      if(e && (e.code==="auth/popup-blocked" || e.code==="auth/operation-not-supported-in-this-environment")){
        try{ await auth.signInWithRedirect(provider); return; }catch(e2){ e = e2; }
      }
      if(e && e.code!=="auth/popup-closed-by-user" && e.code!=="auth/cancelled-popup-request") showAuth("login", {text:errText(e)});
    }
  }

  /* resolves with the signed-in Firebase user (waits on the sign-in screen until then) */
  const ready = new Promise(resolve => {
    if(!configured){ document.addEventListener("DOMContentLoaded", showSetup); if(document.readyState!=="loading") showSetup(); return; }
    firebase.initializeApp(cfg);
    auth = firebase.auth(); fs = firebase.firestore();
    auth.languageCode = "el";   // password-reset emails in Greek
    let done = false;
    auth.onAuthStateChanged(async u => {
      if(!u){ if(done) location.reload(); else showAuth(); return; }
      if(done) return;
      if(pendingSignup) await pendingSignup;   // wait for the name to be saved on sign-up
      done = true;
      if(document.getElementById("cm-auth")) rootEl().innerHTML = `<div id="boot">Φόρτωση…</div>`;
      try{ await fs.doc(`profiles/${u.uid}`).set({name:u.displayName||"", email:u.email||"", seenAt:Date.now()}, {merge:true}); }catch{}
      updateDock();
      resolve(u);
    });
  });

  let adminP = null;
  const isAdmin = () => adminP || (adminP = ready.then(async u => {
    try{ const s = await fs.doc(`admins/${u.uid}`).get(); if(s.exists) return true; }catch{}
    try{ if(u.email && u.emailVerified){ const s = await fs.doc(`users/${u.email.toLowerCase()}`).get(); if(s.exists && s.data().role === "admin") return true; } }catch{}
    return false;
  }));

  const userApi = {
    canEdit: () => isAdmin(),
    can: async () => true,
    me: async () => { const u = await ready; return {id:u.uid, name:u.displayName||"", email:u.email||""}; },
    profiles: async (ids) => {
      await ready; const out = {};
      await Promise.all(ids.map(async id => { try{ const s = await fs.doc(`profiles/${id}`).get(); if(s.exists) out[id] = {id, ...s.data()}; }catch{} }));
      return out;
    }
  };

  const downloadsApi = {
    save: async ({filename, data, mimeType}) => {
      const blob = data instanceof Blob ? data : new Blob([data], {type: mimeType || (/\.csv$/i.test(filename) ? "text/csv;charset=utf-8" : "application/octet-stream")});
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = filename || "download";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }
  };

  window.claude = {
    use: async (name) => {
      if(!configured) return new Promise(() => {}); // stays on the setup message
      await ready;
      if(name === "db") return fs;
      if(name === "user") return userApi;
      if(name === "downloads") return downloadsApi;
      return null;
    }
  };
})();
