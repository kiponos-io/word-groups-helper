(() => {
'use strict';
const LIVE_ARCHIVE = 'https://raw.githubusercontent.com/Eyefyre/NYT-Connections-Answers/main/connections.json';
const START = '2023-06-12';
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dayNum = d => Math.round((Date.parse(d) - Date.parse(START)) / 864e5) + 1;
const localToday = () => { const n = new Date(); return new Date(n.getTime() - n.getTimezoneOffset()*6e4).toISOString().slice(0,10); };
const HINTS = window.HINTS || {};

let puzzles = (window.PUZZLE_DATA && window.PUZZLE_DATA.puzzles) || [];
let byDate = new Map(puzzles.map(p => [p.d, p]));
let cur = null, st = null;  // current puzzle & state

// ---------- archive ----------
function sortArchive(){ puzzles = [...byDate.values()].filter(p => p.d <= localToday()).sort((a,b)=>a.d<b.d?-1:1); }
sortArchive();
async function liveRefresh(){
  try {
    const r = await fetch(LIVE_ARCHIVE, {cache:'no-cache'});
    if (!r.ok) throw new Error(r.status);
    const data = await r.json(); let added = 0;
    for (const x of data) {
      if (byDate.has(x.date) || x.date > localToday()) continue;
      const g = x.answers.map((a,i)=>({t:a.group, w:a.members, l:a.level>=0?a.level:i})).sort((a,b)=>a.l-b.l);
      byDate.set(x.date, {n: dayNum(x.date), d: x.date, g, src:'eyefyre-live'}); added++;
    }
    if (added) { sortArchive(); setPickerBounds(); }
    status(added ? `Archive updated live: +${added} new puzzle(s). Latest: ${last().d}` : `Archive up to date. Latest: ${last().d}`);
  } catch(e) { status(`Offline/bundled archive. Latest: ${last().d}`); }
}
const last = () => puzzles[puzzles.length-1];
function status(t){ $('#status').textContent = `${puzzles.length} puzzles · ` + t; }

// ---------- picker ----------
function setPickerBounds(){
  $('#date').min = puzzles[0].d; $('#date').max = last().d;
  $('#num').min = puzzles[0].n; $('#num').max = last().n;
}
function nearest(d){ // nearest available puzzle on or before date (or first)
  if (byDate.has(d) && d <= last().d) return byDate.get(d);
  let best = puzzles[0]; for (const p of puzzles) if (p.d <= d) best = p; return best;
}
function go(p){ if (p) location.hash = p.d; }
function step(k){ const i = puzzles.indexOf(cur); go(puzzles[Math.min(puzzles.length-1, Math.max(0, i+k))]); }
$('#prev').onclick = () => step(-1);
$('#next').onclick = () => step(1);
$('#today').onclick = () => go(last());
$('#random').onclick = () => go(puzzles[Math.floor(Math.random()*puzzles.length)]);
$('#date').onchange = e => go(nearest(e.target.value));
$('#num').onchange = e => { const n = +e.target.value; go(puzzles.find(p=>p.n===n) || nearest(new Date(Date.parse(START)+(n-1)*864e5).toISOString().slice(0,10))); };
window.addEventListener('hashchange', route);
function route(){ const d = decodeURIComponent(location.hash.slice(1)); load(byDate.has(d) ? byDate.get(d) : last()); }

// ---------- game ----------
function seeded(seed){ let h = 2166136261; for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => ((h = Math.imul(h ^ (h>>>15), 2246822507) ^ Math.imul(h ^ (h>>>13), 3266489909)) >>> 0) / 4294967296; }
function shuffle(a, rnd=Math.random){ for (let i=a.length-1;i>0;i--){ const j=Math.floor(rnd()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
const key = p => 'ch:state:' + p.d;
function load(p){
  cur = p; $('#date').value = p.d; $('#num').value = p.n;
  const saved = JSON.parse(localStorage.getItem(key(p)) || 'null');
  const all = p.g.flatMap(g => g.w);
  st = saved && saved.order && saved.order.length + saved.solved.length*4 === 16 ? saved :
       {order: p.p ? [...p.p] : shuffle([...all], seeded(p.d)), solved: [], mistakes: 0, guesses: [], hintStep: {}};
  st.sel = []; st.hintStep = st.hintStep || {};
  $('#hints').hidden = true; msg('');
  render(); renderHints();
}
function save(){ const {sel, ...rest} = st; localStorage.setItem(key(cur), JSON.stringify(rest)); }
function msg(t, ms){ $('#msg').textContent = t; clearTimeout(msg.t); if (ms) msg.t = setTimeout(()=>$('#msg').textContent='', ms); }
function groupOf(w){ return cur.g.findIndex(g => g.w.includes(w)); }

const sizeCls = w => { const m = Math.max(...w.split(/\s+/).map(x=>x.length)); return m > 11 ? ' xlong' : m > 8 ? ' long' : ''; };
function fitTiles(){ // shrink text so no word is broken mid-word
  document.querySelectorAll('.tile span').forEach(sp => {
    sp.style.fontSize = ''; const t = sp.parentElement, avail = t.clientWidth - 8;
    let f = parseFloat(getComputedStyle(sp).fontSize);
    while (sp.scrollWidth > avail && f > 8) { f -= 0.5; sp.style.fontSize = f + 'px'; }
  });
}
window.addEventListener('resize', () => fitTiles());
function render(){
  $('#solved').innerHTML = st.solved.map(i => { const g = cur.g[i]; return `<div class="group l${g.l}"><div class="t">${esc(g.t)}</div><div class="w">${g.w.map(w=>`<button data-def="${esc(w)}" title="Definition">${esc(w)}</button>`).join('')}</div></div>`; }).join('');
  $('#board').innerHTML = st.order.map(w => `<div class="tile${st.sel.includes(w)?' sel':''}${sizeCls(w)}" data-w="${esc(w)}" role="button" tabindex="0"><span>${esc(w)}</span><button class="def" data-def="${esc(w)}" aria-label="Definition of ${esc(w)}" title="What does it mean?">📖</button></div>`).join('');
  fitTiles();
  $('#submit').disabled = st.sel.length !== 4;
  $('#deselect').disabled = !st.sel.length;
  const done = st.solved.length === 4;
  $('#mistakes').textContent = done ? (st.revealed ? 'Answers revealed.' : `Solved with ${st.mistakes} mistake${st.mistakes===1?'':'s'}! 🎉`) : `Mistakes so far: ${st.mistakes} (unlimited)`;
  ['#shuffle','#submit'].forEach(s => $(s).disabled = done || (s==='#submit' && st.sel.length!==4));
}
$('#board').addEventListener('click', e => {
  if (e.target.closest('.def')) return;           // handled by definition handler
  const t = e.target.closest('.tile'); if (!t) return;
  const w = t.dataset.w;
  if (st.sel.includes(w)) st.sel = st.sel.filter(x => x !== w);
  else if (st.sel.length < 4) st.sel.push(w);
  render();
});
$('#board').addEventListener('keydown', e => { if ((e.key==='Enter'||e.key===' ') && e.target.classList.contains('tile')) { e.preventDefault(); e.target.click(); }});
document.addEventListener('click', e => { const b = e.target.closest('[data-def]'); if (b) { e.stopPropagation(); showDef(b.dataset.def); } }, true);
$('#shuffle').onclick = () => { shuffle(st.order); save(); render(); };
$('#deselect').onclick = () => { st.sel = []; render(); };
$('#submit').onclick = () => {
  const sel = [...st.sel].sort(), sig = sel.join('|');
  if (st.guesses.includes(sig)) { msg('Already guessed!', 1800); return; }
  st.guesses.push(sig);
  const counts = {}; sel.forEach(w => { const g = groupOf(w); counts[g] = (counts[g]||0)+1; });
  const max = Math.max(...Object.values(counts));
  if (max === 4) {
    const gi = groupOf(sel[0]); st.solved.push(gi);
    st.order = st.order.filter(w => !sel.includes(w)); st.sel = [];
    msg(st.solved.length === 4 ? 'Perfect! All groups found.' : '', 1500);
  } else {
    st.mistakes++;
    msg(max === 3 ? 'One away…' : 'Not quite.', 1800);
    document.querySelectorAll('.tile.sel').forEach(t => { t.classList.remove('shake'); void t.offsetWidth; t.classList.add('shake'); });
  }
  save(); render(); renderHints();
};
$('#reveal').onclick = () => {
  if (!confirm('Reveal all remaining groups?')) return;
  cur.g.forEach((g,i) => { if (!st.solved.includes(i)) st.solved.push(i); });
  st.order = []; st.sel = []; st.revealed = true; save(); render(); renderHints();
};
$('#restart').onclick = () => { if (confirm('Restart this puzzle?')) { localStorage.removeItem(key(cur)); load(cur); } };

// ---------- cultural hints ----------
$('#hintsBtn').onclick = () => { $('#hints').hidden = !$('#hints').hidden; renderHints(); };
const COLORS = ['Yellow (easiest)','Green','Blue','Purple (trickiest)'];
function renderHints(){
  const h = HINTS[cur.d], el = $('#hints');
  if (!h) { el.innerHTML = `<h3>Hints</h3><p>No cultural hints written for this puzzle yet (${cur.d}). Use the 📖 definitions on each tile.</p>`; return; }
  el.innerHTML = `<h3>Hints — reveal step by step</h3>` + cur.g.map((g,i) => {
    const hg = h.groups.find(x => x.title === g.t) || h.groups[i] || {};
    const solved = st.solved.includes(i), s = solved ? 3 : (st.hintStep[i] || 0);
    let body = '';
    if (s >= 1) body += `<p><span class="hint-label">Nudge:</span> ${esc(hg.nudge||'')}</p>`;
    if (s >= 2) body += `<p><span class="hint-label">Explanation:</span> ${esc(hg.explain||'')}</p>`;
    if (s >= 3) body += `<p><span class="hint-label">Category:</span> ${esc(g.t)}</p>`;
    const btn = s < 3 ? `<button data-hint="${i}">${['Show a nudge','Explain the idea','Reveal category name'][s]}</button>` : '';
    return `<div class="hint-group l${g.l}"><div class="hint-label">${COLORS[g.l] || 'Group '+(i+1)}${solved?' — solved ✓':''}</div>${body}${btn}</div>`;
  }).join('');
}
$('#hints').addEventListener('click', e => { const b = e.target.closest('[data-hint]'); if (!b) return; const i = +b.dataset.hint; st.hintStep[i] = (st.hintStep[i]||0)+1; save(); renderHints(); });

// ---------- definitions ----------
const DEF_V = 'ch:def:v2:';
const txt = html => { const d = document.createElement('div'); d.innerHTML = html; return d.textContent.replace(/\s+/g,' ').trim(); };
const titleCase = s => s.toLowerCase().replace(/(^|[\s-])\S/g, m => m.toUpperCase());
async function j(url){ const r = await fetch(url); if (!r.ok) throw new Error(r.status); return r.json(); }
async function freeDict(w){
  const d = await j('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(w.toLowerCase()));
  const phon = (d.find(e=>e.phonetic)||{}).phonetic || '';
  const meanings = [];
  for (const e of d) for (const m of e.meanings) {
    let ex = meanings.find(x => x.pos === m.partOfSpeech);
    if (!ex) meanings.push(ex = {pos: m.partOfSpeech, defs: []});
    for (const df of m.definitions) if (ex.defs.length < 5) ex.defs.push({d: df.definition, ex: df.example || ''});
  }
  return {src: 'Free Dictionary', phon, meanings};
}
async function wiktionary(w, depth=0){
  const tries = [...new Set([w.toLowerCase(), titleCase(w), w])].map(s => s.replace(/ /g,'_'));
  for (const t of tries) {
    try {
      const d = await j('https://en.wiktionary.org/api/rest_v1/page/definition/' + encodeURIComponent(t));
      const en = d.en; if (!en || !en.length) continue;
      const meanings = en.map(m => ({pos: m.partOfSpeech, defs: m.definitions.map(x => ({d: txt(x.definition), ex: x.examples && x.examples[0] ? txt(x.examples[0]) : ''})).filter(x => x.d).slice(0,5)})).filter(m => m.defs.length);
      if (!meanings.length) continue;
      const res = {src: 'Wiktionary' + (t !== tries[0] ? ` (“${t.replace(/_/g,' ')}”)` : ''), meanings};
      // "Alternative form of X" / "plural of X": follow the link once and add X's senses
      const allDefs = en.flatMap(m => m.definitions);
      const m = depth === 0 && allDefs.length <= 3 && allDefs.map(x => /form-of-definition-link[\s\S]*?href="\/wiki\/([^"#]+)/.exec(x.definition)).find(Boolean);
      if (m) { try { const tgt = decodeURIComponent(m[1]); const r2 = await wiktionary(tgt.replace(/_/g,' '), 1); res.meanings = res.meanings.concat(r2.meanings.map(x => ({...x, pos: `${x.pos} (“${tgt.replace(/_/g,' ')}”)`}))); } catch(e){} }
      return res;
    } catch(e) {}
  }
  throw new Error('none');
}
async function wikipedia(w){
  const d = await j('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(titleCase(w).replace(/ /g,'_')));
  if (d.type === 'disambiguation') return {src:'Wikipedia', title: d.title, extract: 'Several things are called this on Wikipedia (names, places, brands…). Open Wikipedia to see the list.', url: d.content_urls && d.content_urls.desktop.page};
  return {src:'Wikipedia', title: d.title, extract: d.extract, url: d.content_urls && d.content_urls.desktop.page};
}
async function lookup(w){
  const k = DEF_V + w.toLowerCase(), c = localStorage.getItem(k);
  if (c) return JSON.parse(c);
  const [fd, wk, wp] = await Promise.allSettled([freeDict(w), wiktionary(w), wikipedia(w)]);
  let dict = fd.status === 'fulfilled' ? fd.value : null;
  if (!dict && wk.status === 'fulfilled') dict = wk.value;
  // also try singular for plurals not found
  if (!dict && /[^s]s$/i.test(w)) { try { dict = await freeDict(w.slice(0,-1)); dict.src += ` (“${w.slice(0,-1).toLowerCase()}”)`; } catch(e){} }
  // multi-word tile with no entry: define each word separately
  let parts = null;
  if (!dict && /[\s-]/.test(w.trim())) {
    const ws = w.split(/[\s-]+/).filter(x => x.length > 1);
    parts = (await Promise.all(ws.map(async x => { try { return {w: x, r: await freeDict(x)}; } catch(e) { try { return {w: x, r: await wiktionary(x)}; } catch(e2) { return null; } } }))).filter(Boolean);
    if (!parts.length) parts = null;
  }
  const res = {dict, parts, wikt: (fd.status==='fulfilled' && wk.status==='fulfilled') ? wk.value : null, wiki: wp.status==='fulfilled' ? wp.value : null};
  if (dict || res.wiki || parts) try { localStorage.setItem(k, JSON.stringify(res)); } catch(e){}
  return res;
}
function meaningsHtml(m){ return m.map(x => `<div class="pos">${esc(x.pos||'')}</div><ol>${x.defs.map(d=>`<li>${esc(d.d)}${d.ex?`<div class="ex">“${esc(d.ex)}”</div>`:''}</li>`).join('')}</ol>`).join(''); }
async function showDef(w){
  $('#sheet').hidden = false; $('#sheetWord').innerHTML = esc(w); 
  const q = encodeURIComponent(w.toLowerCase());
  const links = `<div class="links">
    <a target="_blank" rel="noopener" href="https://translate.google.com/?sl=en&tl=iw&text=${q}">🇮🇱 Hebrew (Google Translate)</a>
    <a target="_blank" rel="noopener" href="https://en.wiktionary.org/wiki/${encodeURIComponent(w.toLowerCase().replace(/ /g,'_'))}">Wiktionary</a>
    <a target="_blank" rel="noopener" href="https://www.google.com/search?q=${encodeURIComponent('"'+w.toLowerCase()+'" meaning')}">Google “meaning”</a>
    <a target="_blank" rel="noopener" href="https://www.urbandictionary.com/define.php?term=${q}">Slang (Urban Dictionary)</a></div>`;
  $('#sheetBody').innerHTML = '<p>Looking up…</p>';
  const r = await lookup(w);
  if ($('#sheetWord').textContent !== w) return; // another word opened meanwhile
  let h = '';
  if (r.dict) { if (r.dict.phon) $('#sheetWord').innerHTML = esc(w) + `<span class="phon">${esc(r.dict.phon)}</span>`; h += `<div class="src">${esc(r.dict.src)}</div>` + meaningsHtml(r.dict.meanings.slice(0,4)); }
  if (r.wikt) { const extra = r.wikt.meanings.filter(m => !(r.dict.meanings||[]).some(x => (x.pos||'').toLowerCase() === (m.pos||'').toLowerCase())); if (extra.length) h += `<div class="src">More senses — Wiktionary</div>` + meaningsHtml(extra.slice(0,3)); }
  if (r.parts) h += `<div class="src">No entry for the whole phrase — word by word</div>` + r.parts.map(p => `<div class="pos">${esc(p.w.toUpperCase())}</div>` + meaningsHtml(p.r.meanings.slice(0,2).map(m => ({...m, defs: m.defs.slice(0,2)})))).join('');
  if (r.wiki && r.wiki.extract) h += `<div class="src">Wikipedia — ${esc(r.wiki.title)} (names, places, culture)</div><p>${esc(r.wiki.extract)}</p>`;
  if (!h) h = '<p>No definition found. It may be a name, phrase or slang — try the links below.</p>';
  $('#sheetBody').innerHTML = h + links;
}
$('#sheet').addEventListener('click', e => { if (e.target.closest('[data-close]')) $('#sheet').hidden = true; });
document.addEventListener('keydown', e => { if (e.key === 'Escape') $('#sheet').hidden = true; });

// ---------- boot ----------
if (!puzzles.length) { document.body.innerHTML = '<p style="padding:20px">No puzzle data (data/puzzles.js missing). Run refresh.py.</p>'; return; }
setPickerBounds(); status(`Bundled archive. Latest: ${last().d}`); route(); liveRefresh();
window.__ch = {lookup, get cur(){return cur}, get st(){return st}};
})();
