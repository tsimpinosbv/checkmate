/* Check Mate – schedule parser. rows = array of arrays (sheet_to_json header:1, raw:true) */
(function(root){
  const pad = n => String(n).padStart(2,"0");
  /* fold accents, case, dots and Latin look-alikes so "NOVIΒET" == "NOVIBET", "Ι." == "I" */
  const LAT = {A:"Α",B:"Β",E:"Ε",Z:"Ζ",H:"Η",I:"Ι",K:"Κ",M:"Μ",N:"Ν",O:"Ο",P:"Ρ",T:"Τ",Y:"Υ",X:"Χ"};
  const norm = s => String(s??"").normalize("NFD").replace(/[̀-ͯ]/g,"").toUpperCase()
    .replace(/[ABEZHIKMNOPTYX]/g,c=>LAT[c]).replace(/[.'΄’]/g,"").replace(/\s+/g," ").trim();
  const cell = v => String(v??"").replace(/\s+/g," ").trim();
  const ymd = (y,m,d) => `${y}-${pad(m)}-${pad(d)}`;

  function parseDate(v){
    if(v==null||v==="") return "";
    if(typeof v==="number"){ if(v<20000||v>80000) return ""; const d=new Date(Math.round((v-25569)*864e5)); return ymd(d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate()); }
    if(v instanceof Date && !isNaN(v)) return ymd(v.getFullYear(),v.getMonth()+1,v.getDate());
    const m = String(v).trim().match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})$/);
    if(!m) return "";
    let y=+m[3]; if(y<100) y+=2000; const d=+m[1], mo=+m[2];
    return mo>=1&&mo<=12&&d>=1&&d<=31 ? ymd(y,mo,d) : "";
  }
  /* "17-18-19/10" or "17,18/10" → {day:17, month:10} (year filled in from the season) */
  function parseRange(v){
    const m = String(v??"").trim().match(/^(\d{1,2})(?:\s*[-,&]\s*\d{1,2})+\s*[\/.]\s*(\d{1,2})(?:[\/.](\d{2,4}))?$/);
    if(!m) return null; let y=m[3]?+m[3]:0; if(y&&y<100) y+=2000;
    return {day:+m[1], month:+m[2], year:y};
  }
  function parseTime(v){
    if(v==null||v==="") return "";
    if(typeof v==="number"){
      if(v>0 && v<1){ const mins=Math.round(v*1440); return `${pad(Math.floor(mins/60)%24)}:${pad(mins%60)}`; }
      const h=Math.floor(v); let mi=Math.round((v-h)*100); if(mi>=60) mi=0; return h<24?`${pad(h)}:${pad(mi)}`:"";
    }
    const m=String(v).trim().match(/^(\d{1,2})(?:[.:,](\d{1,2}))?$/);
    if(!m) return "";
    const h=+m[1], mi=m[2]?(m[2].length===1?+m[2]*10:+m[2]):0;
    return h<24&&mi<60?`${pad(h)}:${pad(mi)}`:"";
  }
  function splitTeams(s){
    s=cell(s); if(!s) return ["",""];
    let a=s.split(/\s+[-–—]\s+/); if(a.length<2) a=s.split(/\s*[-–—]\s*/);
    return [cell(a[0]), cell(a.slice(1).join(" - "))];
  }
  function splitPeople(s){
    s=cell(s); if(!s) return [];
    let a=s.split(/\s+[-–—]\s*|\s*[-–—]\s+|\s*\/\s*|\s*[,;&]\s*/).map(cell).filter(Boolean);
    if(a.length===1) a=a[0].split(/(?<=\.)\s*[-–—]\s*/).map(cell).filter(Boolean);
    /* "ΤΣΙΝΤΟΜΗΝΑΣ Μ. ΠΑΠΑΔΟΠΟΥΛΟΣ" (dash forgotten) → split after the initial */
    if(a.length===1) a=a[0].split(/(?<=\s\S{1,3}\.)\s+(?=\S{3,})/).map(cell).filter(Boolean);
    return a;
  }

  const HEAD = [["date",/ΗΜΕΡ|DATE/],["time",/^ΩΡΑ|TIME/],["venue",/ΓΗΠΕΔ|VENUE|ΧΩΡΟΣ/],["match",/ΑΓΩΝ|MATCH/],["tv",/ΚΑΛΥΨ|ΜΕΤΑΔ|TV|ΚΑΝΑΛ/],["vc",/VAR|^VC|ΣΕΤ|ΕΞΟΠΛ/],["people",/ΣΥΝΕΡΓ|ΑΤΟΜ|ΧΕΙΡΙΣΤ|ΠΡΟΣΩΠ/]];
  function findHeader(rows){
    for(let i=0;i<Math.min(rows.length,15);i++){
      const r=rows[i]||[]; const map={};
      r.forEach((v,c)=>{ const t=String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().trim(); if(!t) return; for(const [k,re] of HEAD){ if(map[k]==null && re.test(t)){ map[k]=c; break; } } });
      if(map.date!=null && map.match!=null) return {row:i, map};
    }
    return null;
  }

  function parseRows(rows){
    const hdr = findHeader(rows);
    const C = hdr ? hdr.map : null;
    const out=[], skipped=[]; let comp="", block=[];
    const flush = () => {
      /* rows without their own date take the round's date (marked as to-be-confirmed) */
      const first = block.find(r=>r.date)?.date || "";
      block.forEach(r=>{ if(!r.date && !r._range && first){ r.date=first; r.dateTbc=true; } if(!r.date && !r._range) skipped.push({line:r.line, reason:"Χωρίς ημερομηνία", raw:`${r.home} - ${r.away}`}); else out.push(r); });
      block=[];
    };
    rows.forEach((row,i)=>{
      if(!Array.isArray(row) || (hdr && i<=hdr.row)) return;
      let get, di;
      if(C){ get = k => C[k]==null ? "" : row[C[k]]; }
      else {
        di=row.findIndex(v=>parseDate(v)||parseRange(v)); if(di<0) di=0;
        const pos={date:0,time:1,venue:2,match:3,tv:4,vc:5,people:6}; get = k => row[di+pos[k]];
      }
      const vals = ["date","time","venue","match","tv","vc","people"].map(k=>cell(get(k)));
      if(!vals.some(Boolean)) return;
      const [dRaw,tRaw,venue,match,tv,vc,ppl] = vals;
      const date = parseDate(get("date")), range = date?null:parseRange(get("date"));
      const others = [dRaw,tRaw,venue,tv,vc,ppl].filter(Boolean).length;
      if(!others && match){ flush(); comp=match; return; }              /* competition / round title */
      if(!C && !date && !range && vals.filter(Boolean).length<=2){ flush(); comp=vals.filter(Boolean).join(" "); return; }
      if(!match){ return; }                                              /* date-only or placeholder row */
      const [home,away] = splitTeams(match);
      const people = splitPeople(get("people"));
      const time = parseTime(get("time"));
      const r = {line:i+1, comp, date, dateText: range?dRaw:"", time, timeText: time?"":tRaw, venue, home, away, tv, vc, op:people[0]||"", as:people[1]||"", extra:people.slice(2).join(", ")};
      if(range) r._range=range;
      block.push(r);
    });
    flush();
    /* season: infer year for "17-18-19/10" style ranges, and flag dates outside it */
    const years = out.filter(r=>!r._range).map(r=>+r.date.slice(0,4)+(+r.date.slice(5,7)>=7?0:-1));
    const cnt={}; years.forEach(y=>cnt[y]=(cnt[y]||0)+1);
    const season = +Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0]?.[0] || new Date().getFullYear();
    out.forEach(r=>{
      if(r._range){ const y=r._range.year||(r._range.month>=7?season:season+1); r.date=ymd(y,r._range.month,r._range.day); r.dateTbc=false; delete r._range; }
      const sy=+r.date.slice(0,4)+(+r.date.slice(5,7)>=7?0:-1);
      if(sy!==season) r.warn="Η ημερομηνία είναι εκτός σεζόν "+season+"-"+String(season+1).slice(2)+" – έλεγξέ τη";
    });
    /* "ΠΑΠΑΔΟΠΟΥΛΟΣ" alone → "ΠΑΠΑΔΟΠΟΥΛΟΣ Ι." when exactly one full name has that surname */
    const full = [...new Set(out.flatMap(r=>[r.op,r.as]).filter(n=>/\S+\s+\S/.test(n)))];
    out.forEach(r=>["op","as"].forEach(k=>{
      const n=r[k]; if(!n || /\s/.test(n)) return;
      const hits = full.filter(f=>norm(f).split(" ")[0]===norm(n));
      if(hits.length===1) r[k]=hits[0];
    }));
    return {rows:out, skipped, season};
  }
  root.CMParse = {parseRows, parseDate, parseTime, norm, splitPeople};
})(typeof window!=="undefined"?window:globalThis);
