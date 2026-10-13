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
s1,m1,j1=split(v1); s2,m2,j2=split(v2)
main1=j1[-1]; main2=[j for j in j2 if j.strip()][-1]
out=f'''<title>Check Mate Challenge</title>
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

<div id="modebar" lang="el" hidden>
  <span>Λειτουργία εφαρμογής:</span>
  <span class="mb-seg" role="group" aria-label="Λειτουργία">
    <button type="button" class="mb-btn" data-mode="log" aria-pressed="false">Ημερολόγιο αγώνων</button>
    <button type="button" class="mb-btn" data-mode="assign" aria-pressed="false">Αναθέσεις επόπτη</button>
  </span>
  <span class="hint" id="modehint"></span>
</div>
<div id="root" lang="el"><div id="boot">Φόρτωση…</div></div>

<template id="tpl-log"><style>{s1}</style>{m1}</template>
<template id="tpl-assign"><style>{s2}</style>{m2}</template>

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
  const HINT = {{log:"Οι χρήστες καταγράφουν μόνοι τους τους αγώνες τους.", assign:"Ο επόπτης ορίζει τις αναθέσεις· οι χρήστες βλέπουν μόνο τις δικές τους."}};
  const db = await claude.use("db"), user = await claude.use("user");
  const isAdmin = user ? !!(await user.canEdit()) : false;
  let mode = "assign";
  if(db){{ try{{ const s = await db.doc("config/app").get(); if(s.exists && (s.data().mode==="log"||s.data().mode==="assign")) mode = s.data().mode; }}catch{{}} }}
  const root = document.getElementById("root");
  root.replaceChildren(document.getElementById("tpl-"+mode).content.cloneNode(true));
  (mode==="log" ? runLog : runAssign)();
  if(isAdmin){{
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
'''
open('checkmate.html','w').write(out)

