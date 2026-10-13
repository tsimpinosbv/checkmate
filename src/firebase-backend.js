/* Firebase backend for GitHub Pages.
   Provides the same claude.use("db" | "user" | "downloads") interface the app was written against,
   backed by Firebase Authentication (Google sign-in) and Cloud Firestore.
   Admins: users/<email> with role "admin" (or admins/<uid>) — see README and firestore.rules. */
(function(){
  const cfg = window.FIREBASE_CONFIG || {};
  const configured = !!(cfg.apiKey && cfg.projectId && window.firebase);
  let fs = null, auth = null;

  const css = `
  #cm-auth{max-width:420px;margin:60px auto;padding:28px 22px;text-align:center;font:15px "Commissioner",system-ui,sans-serif;color:#14213a;background:#fff;border:1px solid #d9dfea;border-radius:14px}
  #cm-auth h1{font:800 28px "Fira Sans Extra Condensed",system-ui,sans-serif;margin:0 0 6px}
  #cm-auth p{color:#5d6b84;margin:0 0 20px;line-height:1.5}
  #cm-auth button{font:600 15px "Commissioner",system-ui,sans-serif;padding:10px 18px;border-radius:10px;border:0;background:#f0821e;color:#fff;cursor:pointer}
  #cm-auth .err{color:#b3261e;margin-top:14px;font-size:14px}
  #cm-signout{position:fixed;right:12px;bottom:12px;z-index:50;font:500 12px "Commissioner",system-ui,sans-serif;padding:6px 10px;border-radius:8px;border:1px solid #d9dfea;background:#fff;color:#14213a;cursor:pointer;opacity:.85}
  @media (prefers-color-scheme: dark){#cm-auth,#cm-signout{background:#1b2436;color:#eef2f8;border-color:#33405a}#cm-auth p{color:#a9b4c8}}`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  function rootEl(){ return document.getElementById("root") || document.body; }
  function showSetup(){
    rootEl().innerHTML = `<div id="cm-auth"><h1>Check Mate</h1><p>Η εφαρμογή δεν έχει ρυθμιστεί ακόμα. Συμπλήρωσε τα στοιχεία Firebase στο αρχείο <code>firebase-config.js</code>.</p></div>`;
  }
  function showSignIn(msg){
    rootEl().innerHTML = `<div id="cm-auth"><h1>Check Mate</h1><p>Συνδέσου με τον λογαριασμό Google σου για να συνεχίσεις.</p><button type="button" id="cm-login">Σύνδεση με Google</button>${msg?`<div class="err">${msg}</div>`:""}</div>`;
    document.getElementById("cm-login").onclick = async () => {
      try{ await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
      catch(e){
        if(e && (e.code==="auth/popup-blocked" || e.code==="auth/operation-not-supported-in-this-environment")){
          try{ await auth.signInWithRedirect(new firebase.auth.GoogleAuthProvider()); return; }catch(e2){ e = e2; }
        }
        if(e && e.code!=="auth/popup-closed-by-user" && e.code!=="auth/cancelled-popup-request") showSignIn("Η σύνδεση απέτυχε. Δοκίμασε ξανά.");
      }
    };
  }
  function addSignOut(){
    if(document.getElementById("cm-signout")) return;
    const b = document.createElement("button");
    b.id = "cm-signout"; b.type = "button"; b.textContent = "Αποσύνδεση";
    b.onclick = async () => { await auth.signOut(); location.reload(); };
    document.body.appendChild(b);
  }

  /* resolves with the signed-in Firebase user (waits on the sign-in screen until then) */
  const ready = new Promise(resolve => {
    if(!configured){ document.addEventListener("DOMContentLoaded", showSetup); if(document.readyState!=="loading") showSetup(); return; }
    firebase.initializeApp(cfg);
    auth = firebase.auth(); fs = firebase.firestore();
    let done = false;
    auth.onAuthStateChanged(async u => {
      if(!u){ if(done) location.reload(); else showSignIn(); return; }
      if(done) return;
      done = true;
      const boot = document.getElementById("cm-auth");
      if(boot) rootEl().innerHTML = `<div id="boot">Φόρτωση…</div>`;
      try{ await fs.doc(`profiles/${u.uid}`).set({name:u.displayName||"", email:u.email||"", seenAt:Date.now()}, {merge:true}); }catch{}
      addSignOut();
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
