import re
def split(src):
    style=re.search(r'<style>(.*?)</style>',src,re.S)
    first_script=src.index('<script>')
    markup=src[style.end():first_script]
    scripts=re.findall(r'<script>(.*?)</script>',src,re.S)
    return style.group(1), markup, scripts
fonts='''<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fira+Sans+Extra+Condensed:wght@600;800&family=Commissioner:wght@400;500;600&family=Fira+Mono:wght@500&display=swap&subset=greek">'''
v1=open('src/mode-log.html').read()
v2=open('src/mode-assign.html').read().replace('/*__PARSER__*/','')
parser=open('src/parse.js').read()
backend=open('src/firebase-backend.js').read()
s1,m1,j1=split(v1); s2,m2,j2=split(v2)
main1=j1[-1]; main2=[j for j in j2 if j.strip()][-1]
out=f'''<!doctype html>
<html lang="el">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Check Mate Challenge</title>
<meta name="theme-color" content="#14213a">
<meta name="description" content="Αγώνες, αναθέσεις και πληρωμές Video Check.">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" sizes="32x32" href="icons/favicon-32.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Check Mate">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
{fonts}
<style>
/* mode bar (admin only) — the two modes bring their own styles inside their templates */
#modebar{{display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:center;padding:8px 16px;font:13px "Commissioner",system-ui,sans-serif;background:#14213a;color:#f3f5f9}}
#modebar[hidden]{{display:none!important}}
#modebar .mb-seg{{display:inline-flex;border:1px solid rgba(255,255,255,.25);border-radius:8px;overflow:hidden}}
#modebar .mb-btn{{border:0;background:none;color:inherit;padding:6px 12px;font:inherit;font-weight:600;cursor:pointer;opacity:.75}}
#modebar .mb-btn[aria-pressed="true"]{{background:#f0821e;color:#fff;opacity:1}}
#modebar .hint{{opacity:.7}}
@media (prefers-color-scheme: dark){{:root:not([data-theme="light"]) #modebar{{background:#e8edf6;color:#14213a}}:root:not([data-theme="light"]) #modebar[hidden]{{display:none!important}}
#modebar .mb-seg{{border-color:rgba(0,0,0,.2)}}}}
:root[data-theme="dark"] #modebar{{background:#e8edf6;color:#14213a}}
#boot{{padding:60px 16px;text-align:center;font:15px "Commissioner",system-ui,sans-serif;color:#5d6b84}}
</style>
</head>
<body>

<div id="modebar" lang="el" hidden>
  <span>Λειτουργία εφαρμογής:</span>
  <span class="mb-seg" role="group" aria-label="Λειτουργία">
    <button type="button" class="mb-btn" data-mode="log" aria-pressed="false">Ημερολόγιο αγώνων</button>
    <button type="button" class="mb-btn" data-mode="assign" aria-pressed="false">Αναθέσεις διαχειριστή</button>
  </span>
  <span class="hint" id="modehint"></span>
</div>
<div id="root" lang="el"><div id="boot">Φόρτωση…</div></div>

<template id="tpl-log"><style>{s1}</style>{m1}</template>
<template id="tpl-assign"><style>{s2}</style>{m2}</template>

<!-- backend: Firebase sign-in + Firestore (see README) -->
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"></script>
<script src="firebase-config.js"></script>
<script>
{backend}
</script>

<script>
{parser}
</script>
<script>
/* ===== MODE 1: personal match log (users record their own matches; admin marks payments and paid ones lock) ===== */
function runLog(){{
{main1}
}}
/* ===== MODE 2: supervisor assignments (admin assigns / imports Excel; users only see their own) ===== */
function runAssign(){{
{main2}
}}
/* ===== boot: read the mode the admin chose and mount it ===== */
(async () => {{
  const HINT = {{log:"Οι χρήστες καταγράφουν μόνοι τους τους αγώνες τους.", assign:"Ο διαχειριστής ορίζει τις αναθέσεις· οι χρήστες βλέπουν μόνο τις δικές τους."}};
  const db = await claude.use("db"), user = await claude.use("user");
  const isAdmin = user ? !!(await user.canEdit()) : false;
  let mode = "assign";
  if(db){{ try{{ const s = await db.doc("config/app").get(); if(s.exists && (s.data().mode==="log"||s.data().mode==="assign")) mode = s.data().mode; }}catch{{}} }}
  const root = document.getElementById("root");
  root.replaceChildren(document.getElementById("tpl-"+mode).content.cloneNode(true));
  (mode==="log" ? runLog : runAssign)();
  /* the mode bar is hidden while "assign" is active; the log mode is switched on from Άτομα → Ημερολόγιο αγώνων */
  if(isAdmin && (mode==="log" || /[?&]modes\b/.test(location.search))){{
    const bar = document.getElementById("modebar"); bar.hidden = false;
    bar.querySelectorAll("[data-mode]").forEach(b=>{{
      b.setAttribute("aria-pressed", String(b.dataset.mode===mode));
      b.onclick = async () => {{
        if(b.dataset.mode===mode) return;
        const label = b.textContent;
        if(!confirm(`Αλλαγή λειτουργίας σε «${{label}}» για όλους τους χρήστες;\\nΤα δεδομένα της άλλης λειτουργίας δεν χάνονται.`)) return;
        try{{ await db.doc("config/app").set({{mode:b.dataset.mode, changedAt:Date.now()}}); location.reload(); }}
        catch{{ alert("Η αλλαγή απέτυχε. Δοκίμασε ξανά."); }}
      }};
    }});
    document.getElementById("modehint").textContent = HINT[mode];
  }}
  if(db) db.doc("config/app").onSnapshot(s => {{ const m = s.exists ? s.data().mode : "assign"; if((m==="log"||m==="assign") && m!==mode) location.reload(); }}, ()=>{{}});
}})();
</script>
</body>
</html>
'''
open('checkmate.html','w').write(out)


# ---------- second app: personal diary (imerologio.html), installs separately, not linked to Check Mate ----------
s3,m3,j3=split(open('src/mode-diary.html').read())
diary=f'''<!doctype html>
<html lang="el">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Check Mate · Ημερολόγιο</title>
<meta name="theme-color" content="#1d6b47">
<meta name="description" content="Προσωπικό ημερολόγιο αγώνων και πληρωμών.">
<link rel="manifest" href="imerologio.webmanifest">
<link rel="icon" type="image/png" sizes="32x32" href="icons/diary-32.png">
<link rel="apple-touch-icon" href="icons/diary-apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Ημερολόγιο">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
{fonts}
<style>
#boot{{padding:60px 16px;text-align:center;font:15px "Commissioner",system-ui,sans-serif;color:#5d6b84}}
{s3}
</style>
</head>
<body>
<div id="root" lang="el"><div id="boot">Φόρτωση…</div></div>
<template id="tpl-diary">{m3}</template>

<script>window.CM_APP = "diary";</script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"></script>
<script src="firebase-config.js"></script>
<script>
{backend}
</script>
<script>
/* mount the diary once signed in (the sign-in screen is drawn into #root until then) */
(async () => {{
  await claude.use("db");
  document.getElementById("root").replaceChildren(document.getElementById("tpl-diary").content.cloneNode(true));
  (function(){{
{j3[-1]}
  }})();
}})();
</script>
</body>
</html>
'''
open('imerologio.html','w').write(diary)


# ---------- third page: setup guide (odigos.html) — same accounts as Check Mate, venues shared with the schedule ----------
s4,m4,j4=split(open('src/mode-guide.html').read())
guide=f'''<!doctype html>
<html lang="el">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Check Mate · Οδηγός</title>
<meta name="theme-color" content="#14213a">
<meta name="description" content="Στήσιμο video check, tips και γήπεδα με οδηγίες Google Maps.">
<link rel="manifest" href="odigos.webmanifest">
<link rel="icon" type="image/png" sizes="32x32" href="icons/favicon-32.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Οδηγός">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
{fonts}
<style>
#boot{{padding:60px 16px;text-align:center;font:15px "Commissioner",system-ui,sans-serif;color:#5d6b84}}
{s4}
</style>
</head>
<body>
<div id="root" lang="el"><div id="boot">Φόρτωση…</div></div>
<template id="tpl-guide">{m4}</template>

<script>window.CM_APP = "guide";</script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"></script>
<script src="firebase-config.js"></script>
<script>
{backend}
</script>
<script>
/* mount the guide once signed in (the sign-in screen is drawn into #root until then) */
(async () => {{
  await claude.use("db");
  document.getElementById("root").replaceChildren(document.getElementById("tpl-guide").content.cloneNode(true));
  (function(){{
{j4[-1]}
  }})();
}})();
</script>
</body>
</html>
'''
open('odigos.html','w').write(guide)
