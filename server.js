require("dotenv").config();
const crypto = require("crypto");
const path = require("path");
const express = require("express");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");

const E = process.env;
const BASE = (E.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const SECRET = E.SESSION_SECRET || "";
if (SECRET.length < 24 || /^cambia-esto/i.test(SECRET)) throw new Error("Pon un SESSION_SECRET largo y aleatorio en el .env (no uses el de ejemplo)");
const HTTPS = BASE.startsWith("https"), ORIGIN = new URL(BASE).origin;
const str = (v) => (typeof v === "string" ? v : ""); // solo texto: objetos/arreglos en el JSON se ignoran
const pid = (v) => { const n = Number(v); return Number.isSafeInteger(n) && n > 0 ? n : 0; }; // ids válidos (enteros positivos)
const MIN_POST = Number(E.POST_MIN_LEVEL) || 4;
const SKIN_COL = /^\w{1,40}$/.test(E.SKIN_COLUMN || "") ? E.SKIN_COLUMN : "skin"; // columna de `player` con el id de skin
const SKIN_URL = E.SKIN_URL || "https://assets.open.mp/assets/images/skins/{id}.png"; // {id} se reemplaza por la skin
const CH = 256 * 1024, IMG_MAX = 1200 * 1024, VID_MAX = (Number(E.VIDEO_MAX_MB) || 25) * 1048576, VID_SECS = 15.5; // medios en trozos de 256 KB (evita el límite de paquete de MySQL)
const ADMIN_LEVELS = ["Ciudadano", "Ayudante", "Moderador", "Operador", "Administrador", "Desarrollador"];

const pool = mysql.createPool({ host: E.MYSQL_HOST, port: Number(E.MYSQL_PORT) || 3306, user: E.MYSQL_USER, password: E.MYSQL_PASSWORD, database: E.MYSQL_DATABASE, charset: "utf8mb4", connectionLimit: 5, ssl: E.MYSQL_SSL === "1" ? { minVersion: "TLSv1.2", rejectUnauthorized: E.MYSQL_SSL_STRICT !== "0" } : undefined, dateStrings: true, supportBigNumbers: true, bigNumberStrings: true });
const q = async (sql, p) => (await pool.query(sql, p))[0];

// ---- Sesión: cookie firmada (HMAC), HttpOnly, 7 días ----
const sign = (v) => crypto.createHmac("sha256", SECRET).update(v).digest("base64url");
function setSession(res, id, extra = "") {
  const v = `${id}.${Date.now() + 7 * 864e5}`;
  res.append("Set-Cookie", `sc=${v}.${sign(v)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${HTTPS ? "; Secure" : ""}${extra}`);
}
function sessionId(req) {
  const m = (req.headers.cookie || "").match(/(?:^|; )sc=([^;]+)/);
  if (!m) return null;
  const [id, exp, sig] = m[1].split(".");
  const ok = id && exp && sig && sig.length === sign(`${id}.${exp}`).length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(sign(`${id}.${exp}`)));
  return ok && Number(exp) > Date.now() && /^\d+$/.test(id) ? Number(id) : null;
}
const clearSession = (res) => res.append("Set-Cookie", `sc=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${HTTPS ? "; Secure" : ""}`);

// ---- Contraseñas: igual que snrp.pwn (bcrypt $2a/$2b/$2y, o SHA256(clave + sal) en mayúsculas) ----
function checkPassword(input, salt, stored) {
  if (/^\$2[aby]\$/.test(stored)) return bcrypt.compareSync(input, stored);
  const h = crypto.createHash("sha256").update(input + (salt || "")).digest("hex").toUpperCase();
  return h.length === stored.length && crypto.timingSafeEqual(Buffer.from(h), Buffer.from(stored.toUpperCase()));
}

// ---- Límite de intentos de login (guardado en la base de datos, sobrevive a reinicios) ----
async function limited(key, max) {
  await q("DELETE FROM web_tries WHERE t < ?", [Date.now() - 15 * 60000]);
  return Number((await q("SELECT COUNT(*) AS n FROM web_tries WHERE k = ?", [key]))[0].n) >= max;
}
// ---- Límite de peticiones por IP (en memoria) ----
const buckets = new Map();
const hit = (key, max, ms) => { const now = Date.now(); let b = buckets.get(key); if (!b || b.r < now) { b = { n: 0, r: now + ms }; buckets.set(key, b); } return ++b.n <= max; };
setInterval(() => { const now = Date.now(); for (const [k, b] of buckets) if (b.r < now) buckets.delete(k); }, 60000).unref();
// ---- Protección anti-bots: Cloudflare Turnstile (opcional, se activa con TURNSTILE_SITEKEY y TURNSTILE_SECRET) ----
async function captchaOk(req) {
  if (!E.TURNSTILE_SECRET) return true;
  const t = str(req.body.cf).slice(0, 2048);
  if (!t) return false;
  try {
    const r = await (await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: new URLSearchParams({ secret: E.TURNSTILE_SECRET, response: t, remoteip: req.ip }), signal: AbortSignal.timeout(5000) })).json();
    return !!r.success;
  } catch { return false; }
}
const DUMMY_HASH = bcrypt.hashSync("sampcity-dummy", 10); // para que el tiempo de respuesta no delate si el usuario existe

const app = express();
// Express 4 no captura errores de funciones async: así un fallo de la base de datos no tumba el servidor
["get", "post", "put", "delete"].forEach((m) => { const o = app[m].bind(app); app[m] = (p, ...h) => (h.length ? o(p, ...h.map((f) => (typeof f === "function" && f.length < 4 ? (a, b, c) => Promise.resolve(f(a, b, c)).catch(c) : f))) : o(p)); });
app.set("trust proxy", 1);
app.disable("x-powered-by");
// 18-19. HTTPS forzado + cabeceras de seguridad
const CSP = ["default-src 'self'", "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com", "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", "font-src https://fonts.gstatic.com", "img-src 'self' data: blob: https:", "media-src 'self' blob:", "connect-src 'self'", "frame-src https://challenges.cloudflare.com", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'"].join("; ");
app.use((req, res, next) => {
  if (HTTPS && req.headers["x-forwarded-proto"] === "http") return res.redirect(301, BASE + req.originalUrl);
  res.set({ "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "same-origin", "Content-Security-Policy": CSP, "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()", "Cross-Origin-Opener-Policy": "same-origin" });
  if (HTTPS) res.set("Strict-Transport-Security", "max-age=31536000");
  next();
});
// 17. Límite de la API por IP + peticiones que cambian datos: mismo origen y JSON (así otra web no puede lanzarlas)
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  if (!hit("a|" + req.ip, 300, 60000) || (req.method !== "GET" && !hit("w|" + req.ip, 60, 60000))) return res.set("Retry-After", "60").status(429).json({ error: "Demasiadas peticiones. Espera un momento." });
  if (req.method !== "GET") {
    const o = req.headers.origin;
    if (o && o !== ORIGIN && o !== `${req.protocol}://${req.get("host")}`) return res.status(403).json({ error: "Origen no permitido" });
    if (req.path !== "/media" && !/^application\/json/i.test(req.headers["content-type"] || "")) return res.status(415).json({ error: "Formato no válido" });
  }
  next();
});
app.use((req, res, next) => (req.path === "/api/photos" ? next() : express.json({ limit: "20kb" })(req, res, next)));

const me = async (req) => {
  const id = sessionId(req);
  if (!id) return null;
  const r = await q("SELECT id, name, admin_level FROM player WHERE id = ?", [id]);
  return r[0] || null;
};

// ---- Notificaciones: me gusta, comentarios, menciones, etiquetas, noticias, amistades (por agregar), etc. ----
// notify(destino, actor, tipo, id_publicación, texto): cualquier parte del servidor puede crear una notificación.
// Para solicitudes de amistad usa los tipos "friend_req" (te enviaron una) y "friend_acc" (aceptaron la tuya).
const BCAST = Number(E.NOTIF_BROADCAST_MAX) || 3000; // a cuántos jugadores como máximo se avisa de una noticia/actualización nueva
const ONCE = new Set(["like", "tag", "mention", "friend_req"]); // no se repite si ya existe (mismo actor y publicación)
const UNREAD_ONCE = new Set(["reply", "contact"]); // no se repite mientras haya una sin leer igual
// Solo notificaciones cuya publicación sigue existiendo (y cuyas historias no han caducado)
const NJ = "FROM web_notifs n LEFT JOIN web_posts p ON p.id = n.post_id LEFT JOIN player a ON a.id = n.actor_id WHERE n.player_id = ? AND (n.post_id IS NULL OR p.id IS NOT NULL) AND (p.type IS NULL OR p.type <> 'story' OR p.created_at > NOW() - INTERVAL 24 HOUR)";
async function notify(to, actor, type, postId = null, body = "") {
  try {
    if (!to || String(to) === String(actor.id)) return; // nadie se notifica a sí mismo
    if (ONCE.has(type) && (await q("SELECT 1 FROM web_notifs WHERE player_id = ? AND actor_id = ? AND type = ? AND post_id <=> ? LIMIT 1", [to, actor.id, type, postId])).length) return;
    if (UNREAD_ONCE.has(type) && (await q("SELECT 1 FROM web_notifs WHERE player_id = ? AND type = ? AND post_id <=> ? AND seen = 0 LIMIT 1", [to, type, postId])).length) return;
    await q("INSERT INTO web_notifs (player_id, actor_id, type, post_id, body) VALUES (?, ?, ?, ?, ?)", [to, actor.id, type, postId, String(body).replace(/\s+/g, " ").trim().slice(0, 140)]);
  } catch (e) { console.log("[notif] error al crear el aviso:", e.message); }
}
const unreadCount = async (uid) => Number((await q(`SELECT COUNT(*) AS n ${NJ} AND n.seen = 0`, [uid]))[0].n);
async function mentioned(text, selfId) { // jugadores citados con @Nombre_Apellido que existen
  const names = [...new Set([...String(text).matchAll(/(?:^|[^\w@])@(\w{1,24})/g)].map((m) => m[1]))].slice(0, 10);
  if (!names.length) return [];
  return (await q("SELECT id, name FROM player WHERE name IN (?)", [names])).filter((r) => String(r.id) !== String(selfId));
}
const postOwner = async (id) => { // dueño de una publicación (sin JOIN entre tablas: evita problemas de collation)
  const p = (await q("SELECT type, author FROM web_posts WHERE id = ?", [id]))[0];
  if (!p) return null;
  const a = (await q("SELECT id FROM player WHERE name = ? LIMIT 1", [p.author]))[0];
  if (!a) console.log("[notif] no encontré al jugador autor de la publicación", id, JSON.stringify(p.author));
  return { type: p.type, aid: a ? a.id : null };
};

// ---- Login ----
app.post("/api/login", async (req, res) => {
  const name = str(req.body.name).trim().slice(0, 24), pass = str(req.body.password).slice(0, 72).replace(/%/g, "#"); // el juego cambia % por # en todo lo que se escribe
  const key = `${req.ip}|${name.toLowerCase()}`, ipKey = `${req.ip}|*`;
  if (!name || !pass || /[\u0000-\u001f]/.test(name)) return res.status(400).json({ error: "Escribe tu nombre y tu contraseña" });
  if (!hit("l|" + req.ip, 20, 60000) || (await limited(key, 6)) || (await limited(ipKey, 30))) return res.status(429).json({ error: "Demasiados intentos. Espera 15 minutos." });
  if (!(await captchaOk(req))) return res.status(400).json({ error: "Completa la verificación anti-robots", captcha: true });
  const r = (await q("SELECT id, salt, pass FROM player WHERE name = ?", [name]))[0];
  const good = r && r.pass ? checkPassword(pass, r.salt, r.pass) : (bcrypt.compareSync(pass, DUMMY_HASH), false);
  if (!good) {
    await q("INSERT INTO web_tries (k, t) VALUES (?, ?), (?, ?)", [key, Date.now(), ipKey, Date.now()]);
    return res.status(401).json({ error: "Nombre o contraseña incorrectos" });
  }
  await q("DELETE FROM web_tries WHERE k = ?", [key]);
  setSession(res, r.id);
  res.json({ ok: true });
});
app.post("/api/logout", (req, res) => { clearSession(res); res.json({ ok: true }); });

// ---- Cuenta (solo datos propios) ----
app.get("/api/me", async (req, res) => {
  const u = await me(req);
  if (!u) return res.json({ user: null });
  const a = (await q(`SELECT p.name, p.${SKIN_COL} AS skin, p.reg_date, p.last_connection, p.time_playing, p.level, p.rep, p.connected, p.admin_level, p.vip, p.vip_expire_date, p.cash, p.bank_money, p.phone_number, p.wanted_level, p.arrests_count, p.kills_count, c.name AS crew FROM player p LEFT JOIN crews c ON c.id = p.crew WHERE p.id = ?`, [u.id]))[0];
  const d = (await q("SELECT discord_id, linked_at FROM discord_links WHERE player_id = ?", [u.id]))[0];
  const unread = await unreadCount(u.id).catch(() => 0);
  const fc = (await q("SELECT SUM(status = 1) AS f, SUM(status = 0 AND b = ?) AS r FROM web_friends WHERE a = ? OR b = ?", [u.id, u.id, u.id]).catch(() => [{}]))[0];
  res.json({ user: { ...a, rango: ADMIN_LEVELS[a.admin_level] || "Ciudadano", canPost: a.admin_level >= MIN_POST, discord: d || null, unread, friends: Number(fc.f) || 0, freq: Number(fc.r) || 0 } });
});

// ---- Vincular Discord (OAuth2: solo se lee el id del usuario) ----
app.get("/auth/discord", async (req, res) => {
  const u = await me(req);
  if (!u) return res.redirect("/?login=1");
  const state = crypto.randomBytes(16).toString("hex");
  res.append("Set-Cookie", `dst=${state}; Path=/auth; HttpOnly; SameSite=Lax; Max-Age=600${HTTPS ? "; Secure" : ""}`);
  const p = new URLSearchParams({ client_id: E.DISCORD_CLIENT_ID, redirect_uri: `${BASE}/auth/discord/callback`, response_type: "code", scope: "identify", state });
  res.redirect(`https://discord.com/oauth2/authorize?${p}`);
});
app.get("/auth/discord/callback", async (req, res) => {
  try {
    const u = await me(req);
    const st = (req.headers.cookie || "").match(/(?:^|; )dst=([^;]+)/)?.[1];
    res.append("Set-Cookie", `dst=; Path=/auth; HttpOnly; SameSite=Lax; Max-Age=0${HTTPS ? "; Secure" : ""}`); // el estado se usa una sola vez
    if (!u || !st || typeof req.query.state !== "string" || st !== req.query.state || typeof req.query.code !== "string" || !req.query.code) return res.redirect("/perfil?discord=error");
    const t = await (await fetch("https://discord.com/api/oauth2/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: E.DISCORD_CLIENT_ID, client_secret: E.DISCORD_CLIENT_SECRET, grant_type: "authorization_code", code: String(req.query.code), redirect_uri: `${BASE}/auth/discord/callback` }) })).json();
    const d = await (await fetch("https://discord.com/api/users/@me", { headers: { Authorization: `Bearer ${t.access_token}` } })).json();
    if (!/^\d+$/.test(d.id || "")) return res.redirect("/perfil?discord=error");
    const already = (await q("SELECT player_id FROM discord_links WHERE discord_id = ? OR player_id = ?", [d.id, u.id]))[0];
    if (already) return res.redirect("/perfil?discord=duplicado");
    await q("INSERT INTO discord_links (player_id, discord_id) VALUES (?, ?)", [u.id, d.id]);
    await notify(u.id, { id: 0 }, "discord");
    res.redirect("/perfil?discord=ok");
  } catch (e) { console.log("[discord]", e.message); res.redirect("/perfil?discord=error"); }
});
app.delete("/api/discord", async (req, res) => {
  const u = await me(req);
  if (!u) return res.status(401).json({ error: "Inicia sesión" });
  await q("DELETE FROM discord_links WHERE player_id = ?", [u.id]);
  res.json({ ok: true });
});

// ---- Notificaciones (API) ----
app.get("/api/notifications/count", async (req, res) => {
  const id = sessionId(req);
  res.json({ n: id ? await unreadCount(id).catch(() => 0) : 0 });
});
app.get("/api/notifications", async (req, res) => {
  const id = sessionId(req);
  if (!id) return res.status(401).json({ error: "Inicia sesión" });
  const before = pid(req.query.before), unread = req.query.unread === "1";
  res.json(await q(`SELECT n.id, n.type, n.post_id, n.body, n.seen, n.created_at, a.name AS actor, a.${SKIN_COL} AS skin, p.type AS ptype ${NJ} ${before ? "AND n.id < ?" : ""} ${unread ? "AND n.seen = 0" : ""} ORDER BY n.id DESC LIMIT 31`, before ? [id, before] : [id]));
});
app.post("/api/notifications/read", async (req, res) => { // con id marca una; sin id, todas
  const id = sessionId(req);
  if (!id) return res.status(401).json({ error: "Inicia sesión" });
  const n = pid(req.body.id);
  await q(`UPDATE web_notifs SET seen = 1 WHERE player_id = ? ${n ? "AND id = ?" : ""}`, n ? [id, n] : [id]);
  res.json({ ok: true });
});
app.delete("/api/notifications/:id(\\d+)", async (req, res) => {
  const id = sessionId(req);
  if (!id) return res.status(401).json({ error: "Inicia sesión" });
  await q("DELETE FROM web_notifs WHERE id = ? AND player_id = ?", [pid(req.params.id), id]);
  res.json({ ok: true });
});

// ---- Amigos: solicitudes de amistad. web_friends (a = quien envía, b = quien recibe; status 0 = pendiente, 1 = amigos) ----
const friendIds = async (uid) => (await q("SELECT IF(a = ?, b, a) AS id FROM web_friends WHERE status = 1 AND (a = ? OR b = ?) LIMIT 5000", [uid, uid, uid])).map((r) => Number(r.id));
async function friendStates(uid, ids) { // Map id → "friends" | "sent" (le envié) | "received" (me envió); sin relación no aparece
  const m = new Map();
  if (!ids.length) return m;
  for (const r of await q("SELECT a, b, status FROM web_friends WHERE (a = ? AND b IN (?)) OR (b = ? AND a IN (?))", [uid, ids, uid, ids])) {
    const other = Number(r.a) === Number(uid) ? Number(r.b) : Number(r.a);
    m.set(other, Number(r.status) === 1 ? "friends" : Number(r.a) === Number(uid) ? "sent" : "received");
  }
  return m;
}
async function mutualCounts(mine, ids) { // amigos en común entre yo (mine = ids de mis amigos) y cada jugador de ids
  const out = new Map(ids.map((i) => [Number(i), 0])), set = new Set(mine);
  if (!ids.length || !set.size) return out;
  for (const r of await q("SELECT a, b FROM web_friends WHERE status = 1 AND (a IN (?) OR b IN (?))", [ids, ids])) {
    const a = Number(r.a), b = Number(r.b);
    if (out.has(a) && set.has(b)) out.set(a, out.get(a) + 1);
    if (out.has(b) && set.has(a)) out.set(b, out.get(b) + 1);
  }
  return out;
}
const target = async (req, res, u) => { // jugador indicado en el cuerpo/ruta (no puedes ser tú mismo)
  const n = str(req.body?.name ?? req.params?.name);
  const t = /^\w{1,24}$/.test(n) ? (await q("SELECT id, name FROM player WHERE name = ?", [n]))[0] : null;
  if (!t) { res.status(404).json({ error: "Ese jugador no existe" }); return null; }
  if (String(t.id) === String(u.id)) { res.status(400).json({ error: "No puedes agregarte a ti mismo" }); return null; }
  return t;
};
app.post("/api/friends/request", async (req, res) => {
  const u = await me(req); if (!u) return res.status(401).json({ error: "Inicia sesión" });
  const t = await target(req, res, u); if (!t) return;
  if (!hit("fr|" + u.id, 20, 60000)) return res.status(429).json({ error: "Vas muy rápido, espera un momento" });
  const st = (await friendStates(u.id, [t.id])).get(Number(t.id));
  if (st === "friends" || st === "sent") return res.json({ state: st });
  if (st === "received") { // ya te había enviado una solicitud: al agregarlo se aceptan las dos
    await q("UPDATE web_friends SET status = 1 WHERE a = ? AND b = ?", [t.id, u.id]);
    await q("DELETE FROM web_notifs WHERE player_id = ? AND actor_id = ? AND type = 'friend_req'", [u.id, t.id]);
    await notify(t.id, u, "friend_acc");
    return res.json({ state: "friends" });
  }
  if (Number((await q("SELECT COUNT(*) AS n FROM web_friends WHERE a = ? AND status = 0", [u.id]))[0].n) >= 100) return res.status(429).json({ error: "Tienes demasiadas solicitudes pendientes. Espera a que respondan o cancela algunas." });
  await q("INSERT IGNORE INTO web_friends (a, b, status) VALUES (?, ?, 0)", [u.id, t.id]);
  await notify(t.id, u, "friend_req");
  res.json({ state: "sent" });
});
app.post("/api/friends/accept", async (req, res) => {
  const u = await me(req); if (!u) return res.status(401).json({ error: "Inicia sesión" });
  const t = await target(req, res, u); if (!t) return;
  const r = await q("UPDATE web_friends SET status = 1 WHERE a = ? AND b = ? AND status = 0", [t.id, u.id]);
  if (!r.affectedRows) return res.status(404).json({ error: "Esa solicitud ya no existe" });
  await q("DELETE FROM web_notifs WHERE player_id = ? AND actor_id = ? AND type = 'friend_req'", [u.id, t.id]);
  await notify(t.id, u, "friend_acc");
  res.json({ state: "friends" });
});
app.delete("/api/friends/:name", async (req, res) => { // cancelar la solicitud que enviaste, rechazar la que recibiste o dejar de ser amigos
  const u = await me(req); if (!u) return res.status(401).json({ error: "Inicia sesión" });
  const t = await target(req, res, u); if (!t) return;
  await q("DELETE FROM web_friends WHERE (a = ? AND b = ?) OR (a = ? AND b = ?)", [u.id, t.id, t.id, u.id]);
  await q("DELETE FROM web_notifs WHERE type = 'friend_req' AND ((player_id = ? AND actor_id = ?) OR (player_id = ? AND actor_id = ?))", [u.id, t.id, t.id, u.id]);
  res.json({ state: "none" });
});
app.get("/api/friends", async (req, res) => { // mis amigos
  const id = sessionId(req); if (!id) return res.status(401).json({ error: "Inicia sesión" });
  const ids = await friendIds(id);
  res.json(ids.length ? await q(`SELECT name, ${SKIN_COL} AS skin, connected FROM player WHERE id IN (?) ORDER BY connected DESC, name LIMIT 200`, [ids]) : []);
});
app.get("/api/friends/requests", async (req, res) => { // solicitudes que me enviaron
  const id = sessionId(req); if (!id) return res.status(401).json({ error: "Inicia sesión" });
  const rows = await q(`SELECT p.id, p.name, p.${SKIN_COL} AS skin, f.created_at FROM web_friends f JOIN player p ON p.id = f.a WHERE f.b = ? AND f.status = 0 ORDER BY f.created_at DESC LIMIT 50`, [id]);
  const mc = await mutualCounts(await friendIds(id), rows.map((r) => Number(r.id)));
  res.json(rows.map((r) => ({ name: r.name, skin: r.skin, created_at: r.created_at, mutual: mc.get(Number(r.id)) || 0 })));
});
app.get("/api/friends/suggestions", async (req, res) => { // jugadores recomendados: con amigos en común primero, luego los más activos
  const id = sessionId(req); if (!id) return res.status(401).json({ error: "Inicia sesión" });
  const pool = await q(`SELECT p.id, p.name, p.${SKIN_COL} AS skin, p.connected, p.level FROM player p WHERE p.id <> ? AND p.id NOT IN (SELECT IF(a = ?, b, a) FROM web_friends WHERE (a = ? OR b = ?) AND (status = 1 OR b = ?)) ORDER BY p.connected DESC, p.last_connection DESC, p.id DESC LIMIT 100`, [id, id, id, id, id]);
  const ids = pool.map((r) => Number(r.id)), [mc, st] = await Promise.all([mutualCounts(await friendIds(id), ids), friendStates(id, ids)]);
  res.json(pool.map((r) => ({ name: r.name, skin: r.skin, connected: r.connected, level: r.level, mutual: mc.get(Number(r.id)) || 0, state: st.get(Number(r.id)) || "none" })).sort((x, y) => y.mutual - x.mutual || Number(y.connected) - Number(x.connected)).slice(0, 30));
});
app.get("/api/friends/search", async (req, res) => { // buscar jugadores para agregarlos
  const u = await me(req); if (!u) return res.status(401).json({ error: "Inicia sesión" });
  const v = str(req.query.q).trim().replace(/\s+/g, "_").slice(0, 24).replace(/[\\%_]/g, "\\$&");
  if (v.length < 2) return res.json([]);
  const rows = await q(`SELECT id, name, ${SKIN_COL} AS skin, connected FROM player WHERE name LIKE ? AND id <> ? ORDER BY connected DESC, name LIMIT 12`, [`%${v}%`, u.id]);
  const st = await friendStates(u.id, rows.map((r) => Number(r.id)));
  res.json(rows.map((r) => ({ name: r.name, skin: r.skin, connected: r.connected, state: st.get(Number(r.id)) || "none" })));
});

// ---- Estado público (solo cifras, sin datos de cuentas) ----
app.get("/api/info", async (req, res) => {
  const r = (await q("SELECT COUNT(*) AS total, COALESCE(SUM(connected), 0) AS online FROM player"))[0];
  res.json({ total: Number(r.total), online: Number(r.online), ip: E.SERVER_IP || "", skinUrl: SKIN_URL, videoMax: Math.round(VID_MAX / 1048576), turnstile: E.TURNSTILE_SECRET ? E.TURNSTILE_SITEKEY || "" : "" });
});

// ---- Staff (nombre y rango, nada más) ----
app.get("/api/staff", async (req, res) => res.json(await q(`SELECT name, admin_level AS level, connected, last_connection, ${SKIN_COL} AS skin FROM player WHERE admin_level > 0 ORDER BY admin_level DESC, name LIMIT 100`)));
// ---- Clasificación (solo nombre, skin y cifras públicas) ----
app.get("/api/top", async (req, res) => {
  const by = { level: "level", time: "time_playing", rep: "rep" }[req.query.by] || "level";
  res.json(await q(`SELECT name, level, rep, time_playing, ${SKIN_COL} AS skin FROM player ORDER BY ${by} DESC, level DESC, time_playing DESC, name LIMIT 20`));
});

// ---- Noticias / actualizaciones / FAQ / reglas / fotos ----
const TYPES = ["news", "update", "faq", "photo", "rules", "review", "post", "story"]; // post = publicaciones de los jugadores (muro) // review = testimonios (los publica el staff)
const staffOnly = async (req, res) => { const u = await me(req); if (!u || u.admin_level < MIN_POST) { res.status(403).json({ error: "No tienes permiso" }); return null; } return u; };
app.get("/api/posts", async (req, res) => {
  const type = TYPES.includes(req.query.type) ? req.query.type : null, uid = sessionId(req) || 0;
  const paged = req.query.page !== undefined, per = paged ? 12 : req.query.type === "story" ? 150 : 50, pg = Math.min(1000, Math.max(0, Number(req.query.page) || 0)); // con ?page= devuelve 12 (+1 para saber si hay siguiente)
  const where = [], wp = [], au = str(req.query.author);
  if (req.query.type === "feed" || (req.query.scope === "friends" && type === "story")) { // solo publicaciones de tus amigos (y las tuyas)
    if (!uid) return res.json([]);
    const names = (await q("SELECT name FROM player WHERE id IN (?)", [[...(await friendIds(uid)), uid]])).map((r) => r.name);
    where.push("p.author IN (?)"); wp.push(names);
  }
  if (req.query.type === "feed") where.push("(p.type = 'post' OR (p.type = 'story' AND p.created_at > NOW() - INTERVAL 24 HOUR))"); else if (type) { where.push("p.type = ?"); wp.push(type); if (type === "story") where.push("p.created_at > NOW() - INTERVAL 24 HOUR"); } // las historias duran 24 h
  if (/^\w{1,24}$/.test(au)) { where.push("p.author = ?"); wp.push(au); }
  res.json(await attach(await q(`SELECT p.id, p.type, p.title, p.body, p.author, (SELECT ${SKIN_COL} FROM player WHERE name = p.author LIMIT 1) AS skin, p.created_at, (SELECT COUNT(*) FROM web_likes l WHERE l.post_id = p.id) AS likes, (SELECT COUNT(*) FROM web_comments c WHERE c.post_id = p.id) AS comments, (SELECT COUNT(*) FROM web_likes l WHERE l.post_id = p.id AND l.player_id = ?) AS mine FROM web_posts p ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY p.id DESC LIMIT ? OFFSET ?`, [uid, ...wp, paged ? per + 1 : per, pg * per])));
});
const ONE = (extra = "") => `SELECT p.id, p.type, p.title, p.body, p.author, (SELECT ${SKIN_COL} FROM player WHERE name = p.author LIMIT 1) AS skin, p.created_at, (SELECT COUNT(*) FROM web_likes l WHERE l.post_id = p.id) AS likes, (SELECT COUNT(*) FROM web_comments c WHERE c.post_id = p.id) AS comments, (SELECT COUNT(*) FROM web_likes l WHERE l.post_id = p.id AND l.player_id = ?) AS mine FROM web_posts p WHERE p.id = ? ${extra}`;
const STORY_LIVE = "AND (p.type <> 'story' OR p.created_at > NOW() - INTERVAL 24 HOUR)";
app.get("/api/posts/:id(\\d+)", async (req, res) => {
  const id = pid(req.params.id), uid = sessionId(req) || 0;
  const row = (await q(ONE(), [uid, id]))[0];
  if (!row) return res.status(404).json({ error: "No existe" });
  if (row.type === "story" && !(await q("SELECT 1 FROM web_posts p WHERE p.id = ? " + STORY_LIVE, [id])).length) return res.status(404).json({ error: "Esta historia ya caducó" });
  res.json((await attach([row]))[0]);
});
app.post("/api/posts", async (req, res) => {
  const u = await staffOnly(req, res); if (!u) return;
  const type = str(req.body.type), title = str(req.body.title).trim(), body = str(req.body.body).trim();
  if (!TYPES.includes(type) || type === "story" || !title || !body) return res.status(400).json({ error: "Faltan datos" });
  if (type === "photo" && !/^https:\/\/[^\s"'<>]{4,500}$/.test(body)) return res.status(400).json({ error: "El enlace de la foto debe empezar con https://" });
  const ins = await q("INSERT INTO web_posts (type, title, body, author) VALUES (?, ?, ?, ?)", [type, title.slice(0, 120), body.slice(0, 4000), u.name]);
  if (type === "news" || type === "update") try { await q("INSERT INTO web_notifs (player_id, actor_id, type, post_id, body) SELECT id, ?, ?, ?, ? FROM player WHERE id <> ? ORDER BY id DESC LIMIT ?", [u.id, type, ins.insertId, title.slice(0, 120), u.id, BCAST]); } catch (e) { console.log("[notif]", e.message); }
  res.json({ ok: true });
});
app.put("/api/posts/:id", async (req, res) => {
  const u = await staffOnly(req, res); if (!u) return;
  const title = str(req.body.title).trim().slice(0, 120), body = str(req.body.body).slice(0, 4000);
  if (!title || !body || !pid(req.params.id)) return res.status(400).json({ error: "Faltan datos" });
  await q("UPDATE web_posts SET title = ?, body = IF(type = 'photo', body, ?) WHERE id = ?", [title, body, pid(req.params.id)]);
  res.json({ ok: true });
});
app.delete("/api/posts/:id", async (req, res) => {
  const u = await me(req); if (!u) return res.status(401).json({ error: "Inicia sesión" });
  const id = pid(req.params.id), p = (await q("SELECT body, type, author FROM web_posts WHERE id = ?", [id]))[0];
  if (!p) return res.status(404).json({ error: "No existe" });
  if (u.admin_level < MIN_POST && !((p.type === "post" || p.type === "story") && p.author === u.name)) return res.status(403).json({ error: "No tienes permiso" }); // el staff borra cualquiera; cada jugador, solo lo suyo
  const im = /^\/img\/(\d+)$/.exec(p?.body || "");
  if (im) await q("DELETE FROM web_images WHERE id = ?", [im[1]]);
  await removePosts([id]);
  res.json({ ok: true });
});
// ---- Muro: cualquier jugador con sesión publica; el perfil público de cada jugador ----
app.post("/api/wall", async (req, res) => {
  const u = await me(req); if (!u) return res.status(401).json({ error: "Inicia sesión" });
  const body = str(req.body.body).trim().slice(0, 1000);
  const mids = [...new Set((Array.isArray(req.body.media) ? req.body.media : []).slice(0, 4).map(pid).filter(Boolean))];
  const tags = [...new Set((Array.isArray(req.body.tags) ? req.body.tags : []).map(str).filter((n) => /^\w{1,24}$/.test(n)))].slice(0, 10);
  if (!body && !mids.length) return res.status(400).json({ error: "Escribe algo o agrega una foto" });
  if (!hit("p|" + u.id, 5, 60000)) return res.status(429).json({ error: "Vas muy rápido, espera un momento" });
  if (mids.length && (await q("SELECT m.id FROM web_media m WHERE m.id IN (?) AND m.owner = ? AND m.kind = 'img' AND NOT EXISTS (SELECT 1 FROM web_post_media x WHERE x.media_id = m.id)", [mids, u.id])).length !== mids.length) return res.status(400).json({ error: "Alguna foto no es válida, vuelve a subirla" });
  const tg = tags.length ? await q("SELECT id, name FROM player WHERE name IN (?)", [tags]) : [];
  const r = await q("INSERT INTO web_posts (type, title, body, author) VALUES ('post', '', ?, ?)", [body, u.name]);
  for (const [i, m] of mids.entries()) await q("INSERT INTO web_post_media (post_id, media_id, pos) VALUES (?, ?, ?)", [r.insertId, m, i]);
  for (const t of tg) await q("INSERT IGNORE INTO web_tags (post_id, player_id, name) VALUES (?, ?, ?)", [r.insertId, t.id, t.name]);
  const done = new Set(tg.map((t) => String(t.id)));
  for (const t of tg) await notify(t.id, u, "tag", r.insertId, body);
  for (const m of await mentioned(body, u.id)) if (!done.has(String(m.id))) await notify(m.id, u, "mention", r.insertId, body);
  res.json({ ok: true, id: r.insertId });
});
app.get("/api/user/:name", async (req, res) => {
  const n = str(req.params.name);
  if (!/^\w{1,24}$/.test(n)) return res.status(404).json({ error: "No existe" });
  const r = (await q(`SELECT id, name, ${SKIN_COL} AS skin, admin_level, level, rep, time_playing, reg_date, last_connection, connected FROM player WHERE name = ?`, [n]))[0];
  if (!r) return res.status(404).json({ error: "No existe" });
  const me_ = sessionId(req), fids = await friendIds(r.id);
  const fstate = !me_ ? "none" : String(me_) === String(r.id) ? "self" : (await friendStates(me_, [r.id])).get(Number(r.id)) || "none";
  const fl = fids.length ? await q(`SELECT name, ${SKIN_COL} AS skin, connected FROM player WHERE id IN (?) ORDER BY connected DESC, name LIMIT 30`, [fids]) : [];
  const posts = (await q("SELECT COUNT(*) AS n FROM web_posts WHERE author = ? AND type = 'post'", [r.name]))[0].n;
  const likes = (await q("SELECT COUNT(*) AS n FROM web_likes l JOIN web_posts p ON p.id = l.post_id WHERE p.author = ? AND p.type = 'post'", [r.name]))[0].n;
  res.json({ name: r.name, skin: r.skin, rango: ADMIN_LEVELS[r.admin_level] || "Ciudadano", level: r.level, rep: r.rep, time_playing: r.time_playing, reg_date: r.reg_date, last_connection: r.last_connection, connected: r.connected, posts: Number(posts), likes: Number(likes), friends: fids.length, fstate, fl }); // sin dinero, teléfono ni datos privados
});
// ---- Contacto: lo envía cualquiera, solo el staff lo lee ----
app.post("/api/contact", async (req, res) => {
  if (str(req.body.website)) return res.json({ ok: true }); // campo trampa para bots: un humano no lo ve ni lo llena
  const name = str(req.body.name).trim().slice(0, 80), contact = str(req.body.contact).trim().slice(0, 80), body = str(req.body.message).trim().slice(0, 1000);
  if (!name || body.length < 10) return res.status(400).json({ error: "Escribe tu nombre y un mensaje de al menos 10 letras" });
  if (!hit("c|" + req.ip, 3, 3600000)) return res.status(429).json({ error: "Ya enviaste varios mensajes. Inténtalo más tarde." });
  if (!(await captchaOk(req))) return res.status(400).json({ error: "Completa la verificación anti-robots", captcha: true });
  await q("INSERT INTO web_contact (name, contact, body) VALUES (?, ?, ?)", [name, contact, body]);
  for (const s of await q("SELECT id FROM player WHERE admin_level >= ? LIMIT 100", [MIN_POST]).catch(() => [])) await notify(s.id, { id: 0 }, "contact");
  res.json({ ok: true });
});
app.get("/api/contact", async (req, res) => {
  if (!(await staffOnly(req, res))) return;
  res.json(await q("SELECT id, name, contact, body, created_at FROM web_contact ORDER BY id DESC LIMIT 100"));
});
app.delete("/api/contact/:id", async (req, res) => {
  if (!(await staffOnly(req, res))) return;
  await q("DELETE FROM web_contact WHERE id = ?", [pid(req.params.id)]);
  res.json({ ok: true });
});
// Subida de fotos (solo staff): la imagen llega ya reducida desde el navegador, se guarda en la base de datos
app.post("/api/photos", express.json({ limit: "1500kb" }), async (req, res) => {
  const u = await staffOnly(req, res); if (!u) return;
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(str(req.body.data)), title = str(req.body.title).trim().slice(0, 120);
  if (!m || !title || m[2].length > 1250000) return res.status(400).json({ error: "Escribe un pie de foto y elige una imagen" });
  const buf = Buffer.from(m[2], "base64");
  const magic = (m[1] === "jpeg" && buf[0] === 0xff && buf[1] === 0xd8) || (m[1] === "png" && buf[0] === 0x89 && buf[1] === 0x50) || (m[1] === "webp" && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP");
  if (!magic || buf.length > 900 * 1024) return res.status(400).json({ error: "Imagen no válida o muy pesada (máx. 900 KB)" });
  const r = await q("INSERT INTO web_images (mime, data) VALUES (?, ?)", ["image/" + m[1], buf]);
  await q("INSERT INTO web_posts (type, title, body, author) VALUES ('photo', ?, ?, ?)", [title, `/img/${r.insertId}`, u.name]);
  res.json({ ok: true });
});
app.get("/img/:id(\\d+)", async (req, res) => {
  const r = (await q("SELECT mime, data FROM web_images WHERE id = ?", [req.params.id]))[0];
  if (!r) return res.status(404).end();
  res.set({ "Content-Type": r.mime, "Cache-Control": "public, max-age=604800, immutable", "Content-Security-Policy": "default-src 'none'; sandbox", "Content-Disposition": "inline" }).send(r.data);
});
// Me gusta y comentarios (hay que haber iniciado sesión)
app.post("/api/posts/:id/like", async (req, res) => {
  const u = await me(req); if (!u) return res.status(401).json({ error: "Inicia sesión" });
  const id = pid(req.params.id);
  const own = await postOwner(id);
  if (!own) return res.status(404).json({ error: "No existe" });
  const del = await q("DELETE FROM web_likes WHERE post_id = ? AND player_id = ?", [id, u.id]);
  if (!del.affectedRows) { await q("INSERT IGNORE INTO web_likes (post_id, player_id) VALUES (?, ?)", [id, u.id]); await notify(own.aid, u, "like", id); }
  else await q("DELETE FROM web_notifs WHERE actor_id = ? AND post_id = ? AND type = 'like'", [u.id, id]); // quitar el me gusta quita el aviso
  res.json({ liked: !del.affectedRows, likes: Number((await q("SELECT COUNT(*) AS n FROM web_likes WHERE post_id = ?", [id]))[0].n) });
});
app.get("/api/posts/:id/comments", async (req, res) => {
  const u = await me(req), rows = await q("SELECT id, player_id, author, body, created_at FROM web_comments WHERE post_id = ? ORDER BY id LIMIT 200", [pid(req.params.id)]);
  res.json(rows.map((c) => ({ id: c.id, author: c.author, body: c.body, created_at: c.created_at, del: !!u && (String(u.id) === String(c.player_id) || u.admin_level >= MIN_POST) })));
});
app.post("/api/posts/:id/comments", async (req, res) => {
  const u = await me(req); if (!u) return res.status(401).json({ error: "Inicia sesión" });
  const id = pid(req.params.id), body = str(req.body.body).trim().slice(0, 300);
  if (!body) return res.status(400).json({ error: "Escribe algo" });
  const own = await postOwner(id);
  if (!own) return res.status(404).json({ error: "No existe" });
  if (Number((await q("SELECT COUNT(*) AS n FROM web_comments WHERE player_id = ? AND created_at > NOW() - INTERVAL 1 MINUTE", [u.id]))[0].n) >= 5) return res.status(429).json({ error: "Vas muy rápido, espera un momento" });
  await q("INSERT INTO web_comments (post_id, player_id, author, body) VALUES (?, ?, ?, ?)", [id, u.id, u.name, body]);
  // avisos: citados (@) → dueño de la publicación → quienes ya habían comentado
  const sent = new Set();
  for (const m of await mentioned(body, u.id)) { sent.add(String(m.id)); await notify(m.id, u, "mention_c", id, body); }
  if (own.aid && !sent.has(String(own.aid))) await notify(own.aid, u, "comment", id, body);
  if (own.aid) sent.add(String(own.aid));
  for (const c of await q("SELECT DISTINCT player_id FROM web_comments WHERE post_id = ? AND player_id <> ? LIMIT 20", [id, u.id]).catch(() => [])) if (!sent.has(String(c.player_id))) await notify(c.player_id, u, "reply", id, body);
  res.json({ ok: true });
});
app.delete("/api/posts/:id/comments/:cid", async (req, res) => {
  const u = await me(req); if (!u) return res.status(401).json({ error: "Inicia sesión" });
  await q("DELETE FROM web_comments WHERE id = ? AND post_id = ? AND (player_id = ? OR ? >= ?)", [pid(req.params.cid), pid(req.params.id), u.id, u.admin_level, MIN_POST]);
  res.json({ ok: true });
});

// ---- Medios (fotos y videos): se guardan en la base de datos en trozos, con soporte de Range (necesario para videos en iPhone) ----
const imgOk = (m, b) => (m === "image/jpeg" && b[0] === 0xff && b[1] === 0xd8) || (m === "image/png" && b[0] === 0x89 && b[1] === 0x50) || (m === "image/webp" && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP");
function mp4Dur(b) { // duración en segundos leyendo moov > mvhd (MP4/MOV)
  try {
    const find = (st, en, name) => { let o = st; while (o + 8 <= en) { let sz = b.readUInt32BE(o), hd = 8; const ty = b.toString("ascii", o + 4, o + 8); if (sz === 1) { sz = Number(b.readBigUInt64BE(o + 8)); hd = 16; } else if (sz === 0) sz = en - o; if (sz < hd) return null; if (ty === name) return [o + hd, Math.min(o + sz, en)]; o += sz; } return null; };
    const mo = find(0, b.length, "moov"), mv = mo && find(mo[0], mo[1], "mvhd"); if (!mv) return null;
    const v = b[mv[0]], p = mv[0] + 4, ts = v === 1 ? b.readUInt32BE(p + 16) : b.readUInt32BE(p + 8), du = v === 1 ? Number(b.readBigUInt64BE(p + 20)) : b.readUInt32BE(p + 12);
    return ts ? du / ts : null;
  } catch { return null; }
}
function webmDur(b) { // duración en segundos leyendo Duration y TimecodeScale (WebM)
  try {
    const h = b.subarray(0, 8192); if (h.readUInt32BE(0) !== 0x1a45dfa3) return null;
    let sc = 1e6; const i = h.indexOf(Buffer.from([0x2a, 0xd7, 0xb1])); if (i >= 0) { const n = h[i + 3] - 0x80; if (n >= 1 && n <= 6) sc = h.readUIntBE(i + 4, n); }
    const j = h.indexOf(Buffer.from([0x44, 0x89])); if (j < 0) return null;
    const d = h[j + 2] === 0x84 ? h.readFloatBE(j + 3) : h[j + 2] === 0x88 ? h.readDoubleBE(j + 3) : null;
    return d == null ? null : (d * sc) / 1e9;
  } catch { return null; }
}
const delMedia = async (ids) => { ids = ids.filter(Boolean); if (!ids.length) return; await q("DELETE FROM web_media_chunks WHERE media_id IN (?)", [ids]); await q("DELETE FROM web_media WHERE id IN (?)", [ids]); };
async function removePosts(ids) { // borra publicaciones con sus me gusta, comentarios, etiquetas y medios
  if (!ids.length) return;
  const ms = await q("SELECT m.id, m.thumb FROM web_post_media pm JOIN web_media m ON m.id = pm.media_id WHERE pm.post_id IN (?)", [ids]);
  for (const t of ["web_post_media", "web_tags", "web_likes", "web_comments", "web_notifs"]) await q(`DELETE FROM ${t} WHERE post_id IN (?)`, [ids]);
  await q("DELETE FROM web_posts WHERE id IN (?)", [ids]);
  await delMedia(ms.flatMap((m) => [m.id, m.thumb]));
}
async function attach(rows) { // añade fotos/videos y etiquetas a cada publicación
  if (!rows.length) return rows;
  const ids = rows.map((r) => r.id), ms = await q("SELECT pm.post_id, m.id, m.kind, m.thumb FROM web_post_media pm JOIN web_media m ON m.id = pm.media_id WHERE pm.post_id IN (?) ORDER BY pm.pos", [ids]), ts = await q("SELECT post_id, name FROM web_tags WHERE post_id IN (?) ORDER BY player_id", [ids]);
  for (const r of rows) { r.media = ms.filter((m) => m.post_id === r.id).map((m) => ({ id: m.id, kind: m.kind, thumb: m.thumb })); r.tags = ts.filter((t) => t.post_id === r.id).map((t) => t.name); }
  return rows;
}
async function cleanup() { // historias vencidas (24 h) y medios huérfanos
  try {
    await q("DELETE FROM web_notifs WHERE created_at < NOW() - INTERVAL 45 DAY");
    await removePosts((await q("SELECT id FROM web_posts WHERE type = 'story' AND created_at < NOW() - INTERVAL 24 HOUR")).map((r) => r.id));
    await delMedia((await q("SELECT m.id FROM web_media m LEFT JOIN web_post_media pm ON pm.media_id = m.id LEFT JOIN web_media v ON v.thumb = m.id WHERE m.created_at < NOW() - INTERVAL 2 HOUR AND pm.media_id IS NULL AND v.id IS NULL")).map((r) => r.id));
  } catch (e) { console.log("[cleanup]", e.message); }
}
app.post("/api/media", express.raw({ type: () => true, limit: VID_MAX }), async (req, res) => {
  const u = await me(req); if (!u) return res.status(401).json({ error: "Inicia sesión" });
  if (req.headers["x-sc"] !== "1") return res.status(403).json({ error: "Petición no válida" });
  if (!hit("m|" + u.id, 20, 600000)) return res.status(429).json({ error: "Demasiadas subidas, espera unos minutos" });
  const kind = req.query.kind === "vid" ? "vid" : "img", mime = String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase(), buf = req.body;
  if (!Buffer.isBuffer(buf) || !buf.length) return res.status(400).json({ error: "Archivo vacío" });
  let thumb = null;
  if (kind === "img") { if (!imgOk(mime, buf) || buf.length > IMG_MAX) return res.status(400).json({ error: "Imagen no válida o muy pesada" }); }
  else {
    const mp = mime === "video/mp4" || mime === "video/quicktime", wb = mime === "video/webm";
    if ((!mp && !wb) || buf.length > VID_MAX || (mp && buf.toString("ascii", 4, 8) !== "ftyp")) return res.status(400).json({ error: "Video no válido. Usa MP4 de hasta " + Math.round(VID_MAX / 1048576) + " MB" });
    const d = mp ? mp4Dur(buf) : webmDur(buf);
    if (d == null || d > VID_SECS) return res.status(400).json({ error: d == null ? "No pude leer la duración del video. Usa un MP4." : "El video debe durar máximo 15 segundos" });
    thumb = pid(req.query.thumb);
    if (!thumb || !(await q("SELECT id FROM web_media WHERE id = ? AND owner = ? AND kind = 'img'", [thumb, u.id])).length) return res.status(400).json({ error: "Falta la miniatura del video" });
  }
  const r = await q("INSERT INTO web_media (owner, kind, mime, size, thumb) VALUES (?, ?, ?, ?, ?)", [u.id, kind, mime, buf.length, thumb]);
  try { for (let n = 0, o = 0; o < buf.length; n++, o += CH) await q("INSERT INTO web_media_chunks (media_id, n, data) VALUES (?, ?, ?)", [r.insertId, n, buf.subarray(o, o + CH)]); }
  catch (e) { await delMedia([r.insertId]); throw e; }
  res.json({ id: r.insertId, kind });
});
app.get("/media/:id(\\d+)", async (req, res) => {
  const m = (await q("SELECT mime, size FROM web_media WHERE id = ?", [req.params.id]))[0];
  if (!m) return res.status(404).end();
  const size = Number(m.size); let s = 0, e = size - 1, part = false;
  const rg = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
  if (rg && (rg[1] || rg[2])) {
    part = true;
    if (rg[1] === "") s = Math.max(0, size - Number(rg[2])); else { s = Number(rg[1]); if (rg[2]) e = Math.min(e, Number(rg[2])); }
    if (s > e) return res.status(416).set("Content-Range", `bytes */${size}`).end();
    e = Math.min(e, s + 2 * 1048576 - 1);
  }
  const a = Math.floor(s / CH), rows = await q("SELECT data FROM web_media_chunks WHERE media_id = ? AND n BETWEEN ? AND ? ORDER BY n", [req.params.id, a, Math.floor(e / CH)]);
  const buf = Buffer.concat(rows.map((r) => r.data)).subarray(s - a * CH, e - a * CH + 1);
  res.status(part ? 206 : 200).set({ "Content-Type": m.mime, "Accept-Ranges": "bytes", "Content-Length": buf.length, "Cache-Control": "public, max-age=86400", ...(part ? { "Content-Range": `bytes ${s}-${e}/${size}` } : {}) }).end(buf);
});
// ---- Historias: una foto o video (máx. 15 s) por historia; duran 24 h; usan los mismos me gusta y comentarios que las publicaciones ----
app.post("/api/stories", async (req, res) => {
  const u = await me(req); if (!u) return res.status(401).json({ error: "Inicia sesión" });
  const mid = pid(req.body.media), cap = str(req.body.body).trim().slice(0, 200);
  if (!hit("s|" + u.id, 10, 60000)) return res.status(429).json({ error: "Vas muy rápido, espera un momento" });
  if (!mid || !(await q("SELECT m.id FROM web_media m WHERE m.id = ? AND m.owner = ? AND NOT EXISTS (SELECT 1 FROM web_post_media x WHERE x.media_id = m.id)", [mid, u.id])).length) return res.status(400).json({ error: "Sube primero la foto o el video" });
  const r = await q("INSERT INTO web_posts (type, title, body, author) VALUES ('story', '', ?, ?)", [cap, u.name]);
  await q("INSERT INTO web_post_media (post_id, media_id, pos) VALUES (?, ?, 0)", [r.insertId, mid]);
  res.json({ ok: true, id: r.insertId });
});
// ---- Buscar jugadores para etiquetar (solo nombre y skin) ----
app.get("/api/users/search", async (req, res) => {
  const u = await me(req); if (!u) return res.status(401).json({ error: "Inicia sesión" });
  const v = str(req.query.q).trim().replace(/\s+/g, "_").slice(0, 24).replace(/[\\%_]/g, "\\$&");
  if (v.length < 2) return res.json([]);
  res.json(await q(`SELECT name, ${SKIN_COL} AS skin FROM player WHERE name LIKE ? ORDER BY connected DESC, name LIMIT 8`, [`%${v}%`]));
});

// ---- SEO: robots.txt, sitemap.xml e index con la URL real (canonical / Open Graph) ----
const fs = require("fs");
// Cada página es su propio archivo en public/ con su propia URL (ver README)
const ROUTES = { "/": "index", "/feed": "feed", "/amigos": "amigos", "/noticias": "noticias", "/actualizaciones": "actualizaciones", "/faq": "faq", "/fotos": "fotos", "/staff": "staff", "/solicitar-staff": "solicitar-staff", "/clasificacion": "clasificacion", "/reglas": "reglas", "/testimonios": "testimonios", "/contacto": "contacto", "/comunidad": "comunidad", "/perfil": "perfil", "/notificaciones": "notificaciones" };
const PAGES = {}, VER = Date.now().toString(36); // la versión cambia en cada arranque: el navegador siempre baja el CSS/JS nuevo
const USER_PAGE = fs.readFileSync(path.join(__dirname, "public", "usuario.html"), "utf8").replace(/\?v=1/g, "?v=" + VER);
app.get("/u/:name", (req, res) => (/^\w{1,24}$/.test(req.params.name) ? res.type("html").set("Cache-Control", "no-cache").send(USER_PAGE) : res.status(404).sendFile(path.join(__dirname, "public", "404.html"))));
for (const [url, file] of Object.entries(ROUTES)) {
  PAGES[url] = fs.readFileSync(path.join(__dirname, "public", file + ".html"), "utf8").replace(/\{\{BASE\}\}/g, BASE).replace(/\?v=1/g, "?v=" + VER);
  app.get(url === "/" ? ["/", "/index.html"] : [url, url + ".html"], (req, res) => res.type("html").set("Cache-Control", "public, max-age=300").send(PAGES[url]));
}
const PUB_PAGE = fs.readFileSync(path.join(__dirname, "public", "publicacion.html"), "utf8").replace(/\?v=1/g, "?v=" + VER);
const oe = (v) => String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
app.get("/p/:id(\\d+)", async (req, res) => { // enlace propio de cada publicación/historia, con vista previa al compartir
  const id = pid(req.params.id);
  let t = "Publicación", d = "Mira esta publicación en SampCity RolePlay.", img = BASE + "/assets/logo.png";
  try {
    const p = (await q("SELECT p.id, p.type, p.author, p.body FROM web_posts p WHERE p.id = ? " + STORY_LIVE, [id]))[0];
    if (p) {
      t = p.author.replace(/_/g, " ") + (p.type === "story" ? " · Historia" : "");
      if (p.body && p.type !== "photo") d = p.body.replace(/\s+/g, " ").slice(0, 160);
      const m = (await q("SELECT m.id, m.kind, m.thumb FROM web_post_media pm JOIN web_media m ON m.id = pm.media_id WHERE pm.post_id = ? ORDER BY pm.pos LIMIT 1", [id]))[0];
      if (m) img = `${BASE}/media/${m.kind === "vid" ? m.thumb : m.id}`; else if (p.type === "photo" && /^\/img\/\d+$/.test(p.body)) img = BASE + p.body;
    }
  } catch (e) { console.log("[p]", e.message); }
  res.type("html").set("Cache-Control", "no-cache").send(PUB_PAGE.replace(/\{\{OGTITLE\}\}/g, oe(t)).replace(/\{\{OGDESC\}\}/g, oe(d)).replace(/\{\{OGIMG\}\}/g, oe(img)).replace(/\{\{OGURL\}\}/g, oe(`${BASE}/p/${id}`)));
});
app.get("/robots.txt", (req, res) => res.type("text/plain").send(`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /auth/\nDisallow: /notificaciones\nDisallow: /amigos\n\nSitemap: ${BASE}/sitemap.xml\n`));
app.get("/sitemap.xml", (req, res) => res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${Object.keys(ROUTES).filter((u) => u !== "/perfil" && u !== "/notificaciones" && u !== "/amigos").map((u) => `  <url><loc>${BASE}${u}</loc><changefreq>${u === "/" || u === "/noticias" ? "daily" : "weekly"}</changefreq><priority>${u === "/" ? "1.0" : "0.7"}</priority></url>`).join("\n")}\n</urlset>\n`));
app.use(express.static(path.join(__dirname, "public"), { maxAge: "1h", setHeaders: (res, f) => { if (/[\\/]assets[\\/]/.test(f)) res.set("Cache-Control", "public, max-age=86400"); } }));
// Página 404 propia (la API responde JSON)
app.use((req, res) => (req.path.startsWith("/api/") ? res.status(404).json({ error: "No existe" }) : res.status(404).sendFile(path.join(__dirname, "public", "404.html"))));
app.use((err, req, res, next) => {
  const st = err.status >= 400 && err.status < 500 ? err.status : 500; // JSON roto, cuerpo muy grande, etc. no son errores del servidor
  if (st === 500) console.log("[web]", err.message);
  res.status(st).json({ error: st === 500 ? "Error del servidor" : st === 413 ? "Contenido demasiado grande" : "Petición no válida" });
});

(async () => {
  // Tablas propias de la web (no se toca ninguna del juego)
  await q(`CREATE TABLE IF NOT EXISTS web_posts (id INT AUTO_INCREMENT PRIMARY KEY, type VARCHAR(8) NOT NULL, title VARCHAR(120) NOT NULL, body TEXT NOT NULL, author VARCHAR(24) NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY t (type)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await q("CREATE TABLE IF NOT EXISTS web_likes (post_id INT NOT NULL, player_id INT NOT NULL, PRIMARY KEY (post_id, player_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  await q("CREATE TABLE IF NOT EXISTS web_comments (id INT AUTO_INCREMENT PRIMARY KEY, post_id INT NOT NULL, player_id INT NOT NULL, author VARCHAR(24) NOT NULL, body VARCHAR(300) NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY p (post_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  await q("CREATE TABLE IF NOT EXISTS web_images (id INT AUTO_INCREMENT PRIMARY KEY, mime VARCHAR(16) NOT NULL, data MEDIUMBLOB NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  await q("CREATE TABLE IF NOT EXISTS web_contact (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(80) NOT NULL, contact VARCHAR(80) NOT NULL, body VARCHAR(1000) NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  await q("CREATE TABLE IF NOT EXISTS web_tries (k VARCHAR(80) NOT NULL, t BIGINT NOT NULL, KEY k (k)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  await q("CREATE TABLE IF NOT EXISTS web_media (id INT AUTO_INCREMENT PRIMARY KEY, owner INT NOT NULL, kind VARCHAR(3) NOT NULL, mime VARCHAR(20) NOT NULL, size INT NOT NULL, thumb INT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY o (owner), KEY th (thumb)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  await q("CREATE TABLE IF NOT EXISTS web_media_chunks (media_id INT NOT NULL, n INT NOT NULL, data MEDIUMBLOB NOT NULL, PRIMARY KEY (media_id, n)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  await q("CREATE TABLE IF NOT EXISTS web_post_media (post_id INT NOT NULL, media_id INT NOT NULL, pos TINYINT NOT NULL DEFAULT 0, PRIMARY KEY (post_id, media_id), KEY m (media_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  await q("CREATE TABLE IF NOT EXISTS web_tags (post_id INT NOT NULL, player_id INT NOT NULL, name VARCHAR(24) NOT NULL, PRIMARY KEY (post_id, player_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  await q("CREATE TABLE IF NOT EXISTS web_notifs (id INT AUTO_INCREMENT PRIMARY KEY, player_id INT NOT NULL, actor_id INT NOT NULL DEFAULT 0, type VARCHAR(12) NOT NULL, post_id INT NULL, body VARCHAR(160) NOT NULL DEFAULT '', seen TINYINT NOT NULL DEFAULT 0, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY pl (player_id, id), KEY pu (player_id, seen), KEY po (post_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  await q("CREATE TABLE IF NOT EXISTS web_friends (a INT NOT NULL, b INT NOT NULL, status TINYINT NOT NULL DEFAULT 0, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (a, b), KEY b (b, status)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  setInterval(cleanup, 3600000).unref(); cleanup();
  app.listen(Number(E.PORT) || 3000, () => console.log(`[web] SampCity en ${BASE}`));
})().catch((e) => { console.error("No pude conectar con la base de datos:", e.message); process.exit(1); });
