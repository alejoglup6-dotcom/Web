// Página: Guía del servidor (/guia). Todo sale de /api/guia: lo que vuelca el gamemode al arrancar (comandos, trabajos,
// facciones, lugares), los negocios y estacionamientos en vivo y los artículos de data/guia.json.
// Búsqueda en el navegador: sin acentos, con plurales, sinónimos y errores de escritura ("quizás quisiste decir").

const GD = { data: null, idx: [], vocab: new Map(), q: "", kind: "", staff: false, open: "", logT: 0, lastLogged: "" };

const GD_KIND = {
  guia: ["Guía", "faq"], comando: ["Comando", "rango_desarrollador"], trabajo: ["Trabajo", "dinero"],
  faccion: ["Facción", "staff_equipo"], lugar: ["Lugar", "ubicacion"], negocio: ["Negocio", "marketplace"],
};
const GD_PLURAL = { guia: "Guías", comando: "Comandos", trabajo: "Trabajos", faccion: "Facciones", lugar: "Lugares", negocio: "Negocios" };
const GD_STOP = new Set("de del la las el los un una unos unas y o a al en con por para que como cual donde cuando se mi mis tu tus su sus es son hay hago hacer puedo puede quiero me lo le les esta este esto eso ese hace sirve pongo poner pone necesito tengo tener saber sabe algo alguien funciona usar uso".split(" "));
// Grupos de sinónimos (sin acentos): buscar una palabra encuentra las demás
const GD_SYN = [
  "dinero plata pesos lana guita billete efectivo money pasta",
  "ganar gano gana ganas ganando conseguir sacar",
  "musica radio mp3 cancion",
  "vender vendo venta vendi",
  "comprar compro compra",
  "trabajo trabajos chamba empleo curro laburo job oficio",
  "coche carro auto vehiculo vehiculos moto nave camioneta",
  "casa casas propiedad propiedades vivienda hogar apartamento depa",
  "telefono movil celular cel iphone llamar",
  "policia poli lspd sapd sheriff lssd tombo cops",
  "medico ems ambulancia paramedico hospital doctor herido curar",
  "mecanico taller reparar arreglar tuning",
  "comida comer hambre food restaurante pizza hamburguesa",
  "bebida beber sed agua tomar",
  "gasolina combustible nafta gas bencina gasolinera",
  "banco cajero atm depositar retirar transferir",
  "gps mapa ubicacion donde ruta llegar ir",
  "comando comandos cmd",
  "nivel experiencia exp subir reputacion",
  "negocio negocios empresa local",
  "vip socio citycoins coins premium tienda",
  "ayuda soporte duda dudas reporte reportar ticket",
  "cuenta registro registrarse crear registrar",
  "verificar verificacion discord vincular",
  "animacion animaciones anim bailar sentarse",
  "rol roleplay me do",
  "faccion facciones",
  "banda bandas pandilla crew gang",
  "robar ladron atracar robo",
  "droga traficante semillas sembrar marihuana",
  "taxi uber chofer taxista",
  "bus autobus colectivo guagua conductor",
  "pesca pescar pescador pez peces",
  "alquiler alquilar rentar renta",
  "estacionamiento estacionamientos parking aparcar estacionar",
  "maletero baul",
  "teclas tecla controles botones atajos",
  "ip servidor conectar puerto",
  "arma armas pistola",
  "ropa skin accesorios",
];
const GD_SYNMAP = (() => { const m = new Map(); for (const g of GD_SYN) { const w = g.split(" "); for (const a of w) m.set(a, (m.get(a) || []).concat(w.filter((b) => b !== a))); } return m; })();

const gdNorm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9/ñ]+/g, " ").trim();
const gdStem = (w) => (w.length > 4 && w.endsWith("es") ? w.slice(0, -2) : w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w);
const gdToks = (s) => gdNorm(s).split(" ").filter((w) => w.length > 1 || w.startsWith("/")).flatMap((w) => (w.startsWith("/") && w.length > 1 ? [w, w.slice(1)] : [w]));
function gdLev(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let low = i;
    for (let j = 1; j <= b.length; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); low = Math.min(low, cur[j]); }
    if (low > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}
const gdTol = (w) => (w.length >= 8 ? 2 : w.length >= 4 ? 1 : 0);

function gdBuild() {
  const F = [["t", 6], ["id", 3], ["g", 4], ["c", 3], ["s", 2], ["b", 1], ["z", 2]];
  GD.idx = GD.data.entries.map((e) => {
    const fields = F.map(([f, w]) => { const set = new Set(); for (const t of gdToks(e[f])) { set.add(t); set.add(gdStem(t)); } return [set, w]; });
    for (const [set] of fields) for (const t of set) if (!t.startsWith("/") && t.length > 2) GD.vocab.set(t, (GD.vocab.get(t) || 0) + 1);
    return { e, fields, title: gdNorm(e.t), sum: gdNorm(e.s) };
  });
  for (const k of GD_SYNMAP.keys()) if (!GD.vocab.has(k)) GD.vocab.set(k, 1);
}

const gdIsStaff = (e) => e.st > 0 || e.c === "Staff" || e.c === "Administracion";
function gdSearch(query, kind = GD.kind) {
  const qn = gdNorm(query), toks = gdToks(query).filter((t) => !GD_STOP.has(t));
  if (!toks.length) return [];
  // solo cuentan para "tiene todas las palabras" las que existen en la guía (o se parecen a algo)
  const known = toks.filter((t) => gdKnown(t)).length || toks.length;
  // preguntas ("como...", "donde...") prefieren guías, trabajos y facciones; "donde" prefiere lugares
  const how = /^(como|que|por que|para que|cuando)\b/.test(qn), where = /^(donde|adonde)\b/.test(qn);
  const out = [];
  for (const it of GD.idx) {
    const e = it.e;
    if (kind && e.k !== kind) continue;
    if (!GD.staff && gdIsStaff(e)) continue;
    let score = 0, hits = 0;
    for (const qt of toks) {
      const st = gdStem(qt), syn = GD_SYNMAP.get(qt) || GD_SYNMAP.get(st) || [], tol = gdTol(qt);
      let best = 0;
      for (const [set, w] of it.fields) {
        if (set.has(qt) || set.has(st)) { best = Math.max(best, w); continue; }
        let s = 0;
        for (const ft of set) {
          if (qt.length >= 3 && ft.startsWith(qt)) s = Math.max(s, 0.7 * w);
          else if (syn.includes(ft)) s = Math.max(s, 0.6 * w);
          else if (tol && Math.abs(ft.length - qt.length) <= tol && gdLev(qt, ft, tol) <= tol) s = Math.max(s, 0.3 * w);
        }
        best = Math.max(best, s);
      }
      if (best > 0) hits++;
      score += best;
    }
    if (!score) continue;
    score *= Math.pow(Math.min(1, hits / known), 2);
    if (hits >= known) score *= 1.5;
    if (toks.length > 1 && it.title.includes(qn)) score += 6;
    else if (toks.length > 1 && it.sum.includes(qn)) score += 5; // la frase tal cual en la descripción
    if (e.k === "comando" && (it.title === qn || it.title === "/" + qn)) score += 25;
    if (e.k === "guia") score *= how ? 1.6 : 1.15;
    if (how && (e.k === "faccion" || e.k === "trabajo")) score *= 1.4;
    if (where && (e.k === "lugar" || e.k === "negocio")) score *= 1.3;
    out.push([score, e]);
  }
  out.sort((a, b) => b[0] - a[0]);
  const top = out.length ? out[0][0] : 0;
  GD.lastTop = top;
  return out.filter((x) => x[0] >= top * 0.25).map((x) => x[1]);
}
function gdKnown(t) {
  const st = gdStem(t);
  if (t.startsWith("/") || GD.vocab.has(t) || GD.vocab.has(st) || GD_SYNMAP.has(t) || GD_SYNMAP.has(st)) return true;
  if (t.length >= 3) for (const v of GD.vocab.keys()) if (v.startsWith(t)) return true;
  return false;
}

// "Quizás quisiste decir": cambia cada palabra que no existe por la más parecida que sí está en la guía
function gdDidYouMean(query) {
  let changed = false;
  const words = gdNorm(query).split(" ").map((w) => {
    if (w.length < 3 || w.startsWith("/") || GD_STOP.has(w) || gdKnown(w)) return w;
    let best = null, bd = 9, bf = 0;
    const tol = w.length >= 7 ? 2 : 1;
    for (const [v, f] of GD.vocab) {
      if (Math.abs(v.length - w.length) > tol) continue;
      const d = gdLev(w, v, tol);
      if (d <= tol && (d < bd || (d === bd && f > bf))) { best = v; bd = d; bf = f; }
    }
    if (best) { changed = true; return best; }
    return w;
  });
  return changed ? words.join(" ") : "";
}

function gdRelated(query, res) {
  const qn = gdNorm(query), toks = new Set(gdToks(query)), out = [];
  const shown = new Set(res.slice(0, 5).map((e) => gdNorm(e.t)));
  const add = (s) => { s = String(s || "").trim(); if (s && gdNorm(s) !== qn && !shown.has(gdNorm(s)) && !out.some((x) => gdNorm(x) === gdNorm(s))) out.push(s); };
  for (const e of res.slice(0, 6)) { if (e.k === "guia") (e.r || []).forEach((slug) => { const a = GD.data.entries.find((x) => x.k === "guia" && x.id === slug); if (a) add(a.t); }); }
  for (const t of toks) (GD_SYNMAP.get(t) || GD_SYNMAP.get(gdStem(t)) || []).slice(0, 3).forEach(add);
  for (const p of GD.data.popular || []) if (gdToks(p).some((t) => toks.has(t))) add(p);
  for (const e of res.slice(0, 4)) if (e.c && e.k !== "guia") add(e.c);
  return out.slice(0, 8);
}

// ---- Pintar ----
const gdMd = (s) => esc(s).split("\n").map((l) => l.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`(.+?)`/g, "<code>$1</code>")).reduce((acc, l) => {
  if (/^- /.test(l)) { if (!acc.ul) { acc.h += "<ul>"; acc.ul = true; } acc.h += `<li>${l.slice(2)}</li>`; }
  else { if (acc.ul) { acc.h += "</ul>"; acc.ul = false; } if (l.trim()) acc.h += `<p>${l}</p>`; }
  return acc;
}, { h: "", ul: false });
const gdMdHtml = (s) => { const r = gdMd(s); return r.h + (r.ul ? "</ul>" : ""); };
const gdKey = (e) => e.k + ":" + e.id;
const gdBadge = (e) => `<span class="gd-k gd-k-${e.k}">${ic(GD_KIND[e.k]?.[1] || "faq")}${esc(t(GD_KIND[e.k]?.[0] || e.k))}</span>`;

function gdDetail(e) {
  let h = "";
  if (e.k === "comando") {
    h += `<div class="gd-use"><code>${esc(e.b || e.t)}</code><button class="btn s" type="button" onclick="gdCopy(this,'${esc((e.b || e.t).replace(/'/g, ""))}')">${ic("copiar_ip")} ${t("Copiar")}</button></div>`;
    if (e.g) h += `<p class="m">${t("También")}: ${esc(e.g)}</p>`;
    if (e.st > 0) h += `<p class="m">${t("Solo staff desde")} ${esc(RANGOS[e.st] || "nivel " + e.st)}.</p>`;
    if (!e.s) h += `<p class="m">${t("Este comando aún no tiene descripción.")}</p>`;
  } else if (e.b) h += e.k === "guia" ? gdMdHtml(e.b) : `<p>${esc(e.b).replace(/\n/g, "<br>")}</p>`;
  if (e.z) h += `<p class="gd-z">${ic("ubicacion")} ${esc(e.z)}${e.x || e.y ? ` <small class="m">(${e.x}, ${e.y})</small>` : ""}</p>`;
  const rel = gdSearch(e.c || e.t).filter((x) => x !== e).slice(0, 4);
  const arts = (e.r || []).map((slug) => GD.data.entries.find((x) => x.k === "guia" && x.id === slug)).filter(Boolean);
  const list = [...arts, ...rel.filter((x) => !arts.includes(x))].slice(0, 6);
  if (list.length) h += `<div class="gd-rel"><b>${t("Relacionado")}</b>${list.map((x) => `<a href="?ver=${encodeURIComponent(gdKey(x))}" onclick="return gdOpen('${esc(gdKey(x))}')">${esc(x.t)}</a>`).join("")}</div>`;
  return h;
}

function gdCard(e) {
  const k = gdKey(e), open = GD.open === k;
  return `<article class="card gd-r${open ? " on" : ""}" id="gd-${esc(k.replace(/[^\w-]/g, "_"))}"><button class="gd-h" type="button" aria-expanded="${open}" onclick="gdToggle('${esc(k)}')">
    ${gdBadge(e)}<span class="gd-t${e.k === "comando" ? " gd-cmd" : ""}">${esc(e.t)}</span>${e.c && e.k !== "comando" ? `<span class="tag">${esc(e.c)}</span>` : ""}
    <span class="gd-s">${esc(e.s || (e.k === "comando" ? e.c : ""))}${e.z && e.k !== "guia" ? ` · ${esc(e.z)}` : ""}</span></button>
    ${open ? `<div class="gd-d">${gdDetail(e)}</div>` : ""}</article>`;
}

function gdChips(list, cls = "") { return list.map((s) => `<button class="chip${cls}" type="button" onclick="gdSet(${esc(JSON.stringify(s))})">${esc(s)}</button>`).join(""); }

function gdResultsHtml() {
  const q = GD.q.trim();
  if (!q) return gdHome();
  const res = gdSearch(q), top = GD.lastTop, dym = gdDidYouMean(q), rel = gdRelated(q, res);
  let h = "";
  if (dym && (!res.length || (gdSearch(dym).length && GD.lastTop > top * 1.3))) h += `<p class="gd-dym">${t("Quizás quisiste decir")}: <a href="?q=${encodeURIComponent(dym)}" onclick="return gdSet(${esc(JSON.stringify(dym))})"><b>${esc(dym)}</b></a></p>`;
  if (!res.length) {
    h += `<div class="card gd-none"><h3>${t("No encontramos")} «${esc(q)}»</h3><p class="m">${t("Prueba con otra palabra, más corta o sin el comando completo. Lo que no encuentra nadie se lo pasamos al staff para añadirlo.")}</p>
      ${rel.length ? `<p><b>${t("Prueba con")}</b></p><div class="gd-chips">${gdChips(rel)}</div>` : ""}
      <p><b>${t("Lo más buscado")}</b></p><div class="gd-chips">${gdChips(gdPopular().slice(0, 8))}</div></div>`;
  } else {
    const shown = res.slice(0, 40);
    h += `<p class="m gd-n">${res.length} ${t(res.length === 1 ? "resultado" : "resultados")}${GD.kind ? ` · ${t(GD_KIND[GD.kind][0])}` : ""}</p>${shown.map(gdCard).join("")}`;
    if (res.length > 40) h += `<p class="m">${t("Afina la búsqueda para ver más.")}</p>`;
    if (rel.length) h += `<div class="gd-relq"><b>${t("Búsquedas relacionadas")}</b><div class="gd-chips">${gdChips(rel)}</div></div>`;
  }
  gdLog(q, res.length);
  return h;
}

function gdPopular() {
  const base = ["cómo ganar dinero", "ip del servidor", "teclas", "trabajos", "gasolinera", "vender coche", "negocios", "misiones", "verificar discord", "/me", "hospital", "alquiler moto"];
  return [...new Set([...(GD.data.popular || []), ...base])];
}

function gdHome() {
  const arts = GD.data.entries.filter((e) => e.k === "guia");
  const cats = [["Empezar", "como-empezar", "jugar"], ["Teclas", "teclas", "mas"], ["Dinero", "ganar-dinero", "dinero"], ["Vehículos", "vehiculos", "marketplace"], ["Negocios", "negocios", "marketplace"], ["Rol", "rol", "comunidad"], ["Facciones", "facciones", "staff_equipo"], ["Ayuda", "ayuda-soporte", "faq"]];
  const count = (k) => GD.data.entries.filter((e) => e.k === k && (GD.staff || !gdIsStaff(e))).length;
  return `<div class="gd-cats">${cats.map(([n, slug, i]) => `<button class="card" type="button" onclick="gdOpen('guia:${slug}')">${ic(i)}<b>${t(n)}</b></button>`).join("")}</div>
    <div class="gd-cats gd-kinds">${["comando", "trabajo", "lugar", "faccion", "negocio"].map((k) => `<button class="card" type="button" onclick="gdKind('${k}',1)">${ic(GD_KIND[k][1])}<b>${t(GD_PLURAL[k])}</b><small class="m">${count(k)}</small></button>`).join("")}</div>
    <h3 class="gd-h3">${t("Lo más buscado")}</h3><div class="gd-chips">${gdChips(gdPopular().slice(0, 12))}</div>
    <h3 class="gd-h3">${t("Guías")}</h3>${arts.map(gdCard).join("")}`;
}

function gdPaint() {
  const r = $("#gd-res");
  if (!r) return;
  r.innerHTML = GD.kind && !GD.q.trim() ? gdKindList() : gdResultsHtml();
  document.querySelectorAll(".gd-f button").forEach((b) => b.classList.toggle("p", b.dataset.k === GD.kind));
  const u = new URL(location.href);
  GD.q.trim() ? u.searchParams.set("q", GD.q.trim()) : u.searchParams.delete("q");
  GD.kind ? u.searchParams.set("tipo", GD.kind) : u.searchParams.delete("tipo");
  GD.open ? u.searchParams.set("ver", GD.open) : u.searchParams.delete("ver");
  history.replaceState(null, "", u.pathname + (u.search || ""));
}

function gdKindList() { // un tipo sin texto: todo ese tipo, por categoría
  const l = GD.data.entries.filter((e) => e.k === GD.kind && (GD.staff || !gdIsStaff(e)));
  const by = new Map();
  for (const e of l) { const c = e.c || t("Otros"); if (!by.has(c)) by.set(c, []); by.get(c).push(e); }
  return [...by.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([c, es]) => `<h3 class="gd-h3">${esc(c)} <small class="m">${es.length}</small></h3>${es.sort((a, b) => a.t.localeCompare(b.t)).map(gdCard).join("")}`).join("") || `<div class="card m">${t("Sin datos")}.</div>`;
}

function gdLog(q, n) { // apunta la búsqueda cuando el usuario deja de escribir
  clearTimeout(GD.logT);
  GD.logT = setTimeout(() => { const v = gdNorm(q); if (v.length >= 3 && v !== GD.lastLogged) { GD.lastLogged = v; api("/guia/busqueda", { method: "POST", body: { q: v, n } }); } }, 1500);
}

// ---- Acciones ----
let gdT = 0;
function gdInput(v) { GD.q = v; GD.open = ""; clearTimeout(gdT); gdT = setTimeout(gdPaint, 120); }
function gdSet(v) { GD.q = v; GD.open = ""; const i = $("#gd-q"); if (i) i.value = v; gdPaint(); scrollTo({ top: 0, behavior: "smooth" }); return false; }
function gdKind(k, fromHome) { GD.kind = GD.kind === k && !fromHome ? "" : k; GD.open = ""; gdPaint(); return false; }
function gdToggle(k) { GD.open = GD.open === k ? "" : k; gdPaint(); const el = document.getElementById("gd-" + k.replace(/[^\w-]/g, "_")); if (el && GD.open) el.scrollIntoView({ block: "nearest" }); }
function gdOpen(k) {
  const e = GD.data.entries.find((x) => gdKey(x) === k);
  if (!e) return false;
  GD.q = e.k === "comando" ? e.t : e.t; GD.kind = ""; GD.open = k;
  if (gdIsStaff(e)) GD.staff = true;
  const i = $("#gd-q"); if (i) i.value = GD.q;
  gdPaint(); scrollTo({ top: 0, behavior: "smooth" }); return false;
}
function gdStaff(on) { GD.staff = on; gdPaint(); }
function gdCopy(btn, txt) { (navigator.clipboard?.writeText(txt) || Promise.reject()).then(() => toast(t("Copiado"))).catch(() => toast(txt)); }

async function pg_guia() {
  if (!GD.data) {
    const r = await api("/guia");
    if (!r.ok) return fail(r.d.error, "guia");
    GD.data = r.d; gdBuild();
    const p = new URLSearchParams(location.search);
    GD.q = p.get("q") || ""; GD.kind = GD_KIND[p.get("tipo")] ? p.get("tipo") : ""; GD.open = p.get("ver") || "";
    if (GD.open) { const e = GD.data.entries.find((x) => gdKey(x) === GD.open); if (e && !GD.q) GD.q = e.t; if (e && gdIsStaff(e)) GD.staff = true; }
  }
  window.PTITLE = t("Guía del servidor");
  const up = GD.data.updated ? new Date(GD.data.updated).toLocaleString(L === "en" ? "en-US" : "es-CO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
  setTimeout(() => { gdPaint(); const i = $("#gd-q"); if (i && !GD.open) i.focus(); }, 0);
  return `<h2 class="ttl">${ic("buscar")} ${t("Guía del servidor")}</h2>
  <p class="m gd-sub">${t("Comandos, trabajos, lugares, negocios, facciones y guías de SampCity. Se actualiza sola con el servidor")}${up ? ` · ${t("última vez")} ${esc(up)}` : ""}.</p>
  <form class="gd-b" role="search" onsubmit="event.preventDefault();gdPaint()"><label class="gd-in">${ic("buscar")}<input id="gd-q" type="search" autocomplete="off" enterkeyhint="search" placeholder="${t("Busca un comando, un lugar, un trabajo… (ej. vender coche, /me, gasolinera)")}" value="${esc(GD.q)}" oninput="gdInput(this.value)" aria-label="${t("Buscar en la guía")}"></label></form>
  <div class="gd-f">${["", "guia", "comando", "trabajo", "lugar", "faccion", "negocio"].map((k) => `<button class="btn s" type="button" data-k="${k}" onclick="gdKind('${k}')">${t(k ? GD_PLURAL[k] : "Todo")}</button>`).join("")}
    <label class="gd-st"><input type="checkbox" ${GD.staff ? "checked" : ""} onchange="gdStaff(this.checked)"> ${t("Comandos de staff")}</label></div>
  <div id="gd-res" aria-live="polite"></div>`;
}

mountPage(() => pg_guia());
