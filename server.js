require("dotenv").config();
const crypto = require("crypto");
const path = require("path");
const express = require("express");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");

const E = process.env;
const BASE = (E.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const SECRET = E.SESSION_SECRET || "";
if (SECRET.length < 24) throw new Error("Pon un SESSION_SECRET largo en el .env");
const MIN_POST = Number(E.POST_MIN_LEVEL) || 4;
const ADMIN_LEVELS = ["Ciudadano", "Ayudante", "Moderador", "Operador", "Administrador", "Desarrollador"];

const pool = mysql.createPool({ host: E.MYSQL_HOST, port: Number(E.MYSQL_PORT) || 3306, user: E.MYSQL_USER, password: E.MYSQL_PASSWORD, database: E.MYSQL_DATABASE, charset: "utf8mb4", connectionLimit: 5, dateStrings: true, supportBigNumbers: true, bigNumberStrings: true });
const q = async (sql, p) => (await pool.query(sql, p))[0];

// ---- Sesión: cookie firmada (HMAC), HttpOnly, 7 días ----
const sign = (v) => crypto.createHmac("sha256", SECRET).update(v).digest("base64url");
function setSession(res, id, extra = "") {
  const v = `${id}.${Date.now() + 7 * 864e5}`;
  res.append("Set-Cookie", `sc=${v}.${sign(v)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${BASE.startsWith("https") ? "; Secure" : ""}${extra}`);
}
function sessionId(req) {
  const m = (req.headers.cookie || "").match(/(?:^|; )sc=([^;]+)/);
  if (!m) return null;
  const [id, exp, sig] = m[1].split(".");
  const ok = sig && sig.length === sign(`${id}.${exp}`).length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(sign(`${id}.${exp}`)));
  return ok && Number(exp) > Date.now() && /^\d+$/.test(id) ? Number(id) : null;
}
const clearSession = (res) => res.append("Set-Cookie", "sc=; Path=/; HttpOnly; Max-Age=0");

// ---- Contraseñas: igual que snrp.pwn (bcrypt $2a/$2b/$2y, o SHA256(clave + sal) en mayúsculas) ----
function checkPassword(input, salt, stored) {
  if (/^\$2[aby]\$/.test(stored)) return bcrypt.compareSync(input, stored);
  const h = crypto.createHash("sha256").update(input + (salt || "")).digest("hex").toUpperCase();
  return h.length === stored.length && crypto.timingSafeEqual(Buffer.from(h), Buffer.from(stored.toUpperCase()));
}

// ---- Límite de intentos de login (guardado en la base de datos, sobrevive a reinicios) ----
async function limited(key) {
  await q("DELETE FROM web_tries WHERE t < ?", [Date.now() - 15 * 60000]);
  return Number((await q("SELECT COUNT(*) AS n FROM web_tries WHERE k = ?", [key]))[0].n) >= 6;
}

const app = express();
// Express 4 no captura errores de funciones async: así un fallo de la base de datos no tumba el servidor
["get", "post", "put", "delete"].forEach((m) => { const o = app[m].bind(app); app[m] = (p, ...h) => (h.length ? o(p, ...h.map((f) => (typeof f === "function" && f.length < 4 ? (a, b, c) => Promise.resolve(f(a, b, c)).catch(c) : f))) : o(p)); });
app.set("trust proxy", 1);
app.use((req, res, next) => (req.path === "/api/photos" ? next() : express.json({ limit: "20kb" })(req, res, next)));
app.use((req, res, next) => { res.set({ "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "same-origin" }); next(); });
// Las peticiones que cambian datos deben ser JSON (así un formulario de otra web no puede lanzarlas)
app.use("/api", (req, res, next) => (req.method === "GET" || req.is("json") ? next() : res.status(415).json({ error: "Formato no válido" })));

const me = async (req) => {
  const id = sessionId(req);
  if (!id) return null;
  const r = await q("SELECT id, name, admin_level FROM player WHERE id = ?", [id]);
  return r[0] || null;
};

// ---- Login ----
app.post("/api/login", async (req, res) => {
  const name = String(req.body.name || "").trim().slice(0, 24), pass = String(req.body.password || "").slice(0, 72).replace(/%/g, "#"); // el juego cambia % por # en todo lo que se escribe
  const key = `${req.ip}|${name.toLowerCase()}`;
  if (!name || !pass) return res.status(400).json({ error: "Escribe tu nombre y tu contraseña" });
  if (await limited(key)) return res.status(429).json({ error: "Demasiados intentos. Espera 15 minutos." });
  const r = (await q("SELECT id, salt, pass FROM player WHERE name = ?", [name]))[0];
  if (!r || !r.pass || !checkPassword(pass, r.salt, r.pass)) {
    await q("INSERT INTO web_tries (k, t) VALUES (?, ?)", [key, Date.now()]);
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
  const a = (await q(`SELECT p.name, p.reg_date, p.last_connection, p.time_playing, p.level, p.rep, p.connected, p.admin_level, p.vip, p.vip_expire_date, p.cash, p.bank_money, p.phone_number, p.wanted_level, p.arrests_count, p.kills_count, c.name AS crew FROM player p LEFT JOIN crews c ON c.id = p.crew WHERE p.id = ?`, [u.id]))[0];
  const d = (await q("SELECT discord_id, linked_at FROM discord_links WHERE player_id = ?", [u.id]))[0];
  res.json({ user: { ...a, rango: ADMIN_LEVELS[a.admin_level] || "Ciudadano", canPost: a.admin_level >= MIN_POST, discord: d || null } });
});

// ---- Vincular Discord (OAuth2: solo se lee el id del usuario) ----
app.get("/auth/discord", async (req, res) => {
  const u = await me(req);
  if (!u) return res.redirect("/?login=1");
  const state = crypto.randomBytes(16).toString("hex");
  res.append("Set-Cookie", `dst=${state}; Path=/auth; HttpOnly; SameSite=Lax; Max-Age=600${BASE.startsWith("https") ? "; Secure" : ""}`);
  const p = new URLSearchParams({ client_id: E.DISCORD_CLIENT_ID, redirect_uri: `${BASE}/auth/discord/callback`, response_type: "code", scope: "identify", state });
  res.redirect(`https://discord.com/oauth2/authorize?${p}`);
});
app.get("/auth/discord/callback", async (req, res) => {
  try {
    const u = await me(req);
    const st = (req.headers.cookie || "").match(/(?:^|; )dst=([^;]+)/)?.[1];
    if (!u || !st || st !== req.query.state || !req.query.code) return res.redirect("/?discord=error");
    const t = await (await fetch("https://discord.com/api/oauth2/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: E.DISCORD_CLIENT_ID, client_secret: E.DISCORD_CLIENT_SECRET, grant_type: "authorization_code", code: String(req.query.code), redirect_uri: `${BASE}/auth/discord/callback` }) })).json();
    const d = await (await fetch("https://discord.com/api/users/@me", { headers: { Authorization: `Bearer ${t.access_token}` } })).json();
    if (!/^\d+$/.test(d.id || "")) return res.redirect("/?discord=error");
    const already = (await q("SELECT player_id FROM discord_links WHERE discord_id = ? OR player_id = ?", [d.id, u.id]))[0];
    if (already) return res.redirect("/?discord=duplicado");
    await q("INSERT INTO discord_links (player_id, discord_id) VALUES (?, ?)", [u.id, d.id]);
    res.redirect("/?discord=ok");
  } catch (e) { console.log("[discord]", e.message); res.redirect("/?discord=error"); }
});
app.delete("/api/discord", async (req, res) => {
  const u = await me(req);
  if (!u) return res.status(401).json({ error: "Inicia sesión" });
  await q("DELETE FROM discord_links WHERE player_id = ?", [u.id]);
  res.json({ ok: true });
});

// ---- Estado público (solo cifras, sin datos de cuentas) ----
app.get("/api/info", async (req, res) => {
  const r = (await q("SELECT COUNT(*) AS total, COALESCE(SUM(connected), 0) AS online FROM player"))[0];
  res.json({ total: Number(r.total), online: Number(r.online), ip: E.SERVER_IP || "" });
});

// ---- Staff (nombre y rango, nada más) ----
app.get("/api/staff", async (req, res) => res.json(await q("SELECT name, admin_level AS level, connected FROM player WHERE admin_level > 0 ORDER BY admin_level DESC, name LIMIT 60")));

// ---- Noticias / actualizaciones / FAQ / reglas / fotos ----
const TYPES = ["news", "update", "faq", "photo", "rules"];
const staffOnly = async (req, res) => { const u = await me(req); if (!u || u.admin_level < MIN_POST) { res.status(403).json({ error: "No tienes permiso" }); return null; } return u; };
app.get("/api/posts", async (req, res) => {
  const type = TYPES.includes(req.query.type) ? req.query.type : null, uid = sessionId(req) || 0;
  res.json(await q(`SELECT p.id, p.type, p.title, p.body, p.author, p.created_at, (SELECT COUNT(*) FROM web_likes l WHERE l.post_id = p.id) AS likes, (SELECT COUNT(*) FROM web_comments c WHERE c.post_id = p.id) AS comments, (SELECT COUNT(*) FROM web_likes l WHERE l.post_id = p.id AND l.player_id = ?) AS mine FROM web_posts p ${type ? "WHERE p.type = ?" : ""} ORDER BY p.id DESC LIMIT 50`, type ? [uid, type] : [uid]));
});
app.post("/api/posts", async (req, res) => {
  const u = await staffOnly(req, res); if (!u) return;
  const { type, title, body } = req.body;
  if (!TYPES.includes(type) || !title || !body) return res.status(400).json({ error: "Faltan datos" });
  if (type === "photo" && !/^https:\/\/[^\s"'<>]{4,500}$/.test(String(body))) return res.status(400).json({ error: "El enlace de la foto debe empezar con https://" });
  await q("INSERT INTO web_posts (type, title, body, author) VALUES (?, ?, ?, ?)", [type, String(title).slice(0, 120), String(body).slice(0, 4000), u.name]);
  res.json({ ok: true });
});
app.put("/api/posts/:id", async (req, res) => {
  const u = await staffOnly(req, res); if (!u) return;
  const title = String(req.body.title || "").trim().slice(0, 120), body = String(req.body.body || "").slice(0, 4000);
  if (!title || !body) return res.status(400).json({ error: "Faltan datos" });
  await q("UPDATE web_posts SET title = ?, body = IF(type = 'photo', body, ?) WHERE id = ?", [title, body, Number(req.params.id) || 0]);
  res.json({ ok: true });
});
app.delete("/api/posts/:id", async (req, res) => {
  const u = await staffOnly(req, res); if (!u) return;
  const id = Number(req.params.id) || 0, p = (await q("SELECT body FROM web_posts WHERE id = ?", [id]))[0], im = /^\/img\/(\d+)$/.exec(p?.body || "");
  if (im) await q("DELETE FROM web_images WHERE id = ?", [im[1]]);
  await q("DELETE FROM web_likes WHERE post_id = ?", [id]);
  await q("DELETE FROM web_comments WHERE post_id = ?", [id]);
  await q("DELETE FROM web_posts WHERE id = ?", [id]);
  res.json({ ok: true });
});
// Subida de fotos (solo staff): la imagen llega ya reducida desde el navegador, se guarda en la base de datos
app.post("/api/photos", express.json({ limit: "1500kb" }), async (req, res) => {
  const u = await staffOnly(req, res); if (!u) return;
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(req.body.data || "")), title = String(req.body.title || "").trim().slice(0, 120);
  if (!m || !title) return res.status(400).json({ error: "Escribe un pie de foto y elige una imagen" });
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
  res.set({ "Content-Type": r.mime, "Cache-Control": "public, max-age=604800, immutable" }).send(r.data);
});
// Me gusta y comentarios (hay que haber iniciado sesión)
app.post("/api/posts/:id/like", async (req, res) => {
  const u = await me(req); if (!u) return res.status(401).json({ error: "Inicia sesión" });
  const id = Number(req.params.id) || 0;
  if (!(await q("SELECT 1 FROM web_posts WHERE id = ?", [id])).length) return res.status(404).json({ error: "No existe" });
  const del = await q("DELETE FROM web_likes WHERE post_id = ? AND player_id = ?", [id, u.id]);
  if (!del.affectedRows) await q("INSERT IGNORE INTO web_likes (post_id, player_id) VALUES (?, ?)", [id, u.id]);
  res.json({ liked: !del.affectedRows, likes: Number((await q("SELECT COUNT(*) AS n FROM web_likes WHERE post_id = ?", [id]))[0].n) });
});
app.get("/api/posts/:id/comments", async (req, res) => {
  const u = await me(req), rows = await q("SELECT id, player_id, author, body, created_at FROM web_comments WHERE post_id = ? ORDER BY id LIMIT 200", [Number(req.params.id) || 0]);
  res.json(rows.map((c) => ({ id: c.id, author: c.author, body: c.body, created_at: c.created_at, del: !!u && (String(u.id) === String(c.player_id) || u.admin_level >= MIN_POST) })));
});
app.post("/api/posts/:id/comments", async (req, res) => {
  const u = await me(req); if (!u) return res.status(401).json({ error: "Inicia sesión" });
  const id = Number(req.params.id) || 0, body = String(req.body.body || "").trim().slice(0, 300);
  if (!body) return res.status(400).json({ error: "Escribe algo" });
  if (!(await q("SELECT 1 FROM web_posts WHERE id = ?", [id])).length) return res.status(404).json({ error: "No existe" });
  if (Number((await q("SELECT COUNT(*) AS n FROM web_comments WHERE player_id = ? AND created_at > NOW() - INTERVAL 1 MINUTE", [u.id]))[0].n) >= 5) return res.status(429).json({ error: "Vas muy rápido, espera un momento" });
  await q("INSERT INTO web_comments (post_id, player_id, author, body) VALUES (?, ?, ?, ?)", [id, u.id, u.name, body]);
  res.json({ ok: true });
});
app.delete("/api/posts/:id/comments/:cid", async (req, res) => {
  const u = await me(req); if (!u) return res.status(401).json({ error: "Inicia sesión" });
  await q("DELETE FROM web_comments WHERE id = ? AND post_id = ? AND (player_id = ? OR ? >= ?)", [Number(req.params.cid) || 0, Number(req.params.id) || 0, u.id, u.admin_level, MIN_POST]);
  res.json({ ok: true });
});

app.use(express.static(path.join(__dirname, "public"), { maxAge: "1h" }));
app.use((err, req, res, next) => { console.log("[web]", err.message); res.status(500).json({ error: "Error del servidor" }); });

(async () => {
  // Tablas propias de la web (no se toca ninguna del juego)
  await q(`CREATE TABLE IF NOT EXISTS web_posts (id INT AUTO_INCREMENT PRIMARY KEY, type VARCHAR(8) NOT NULL, title VARCHAR(120) NOT NULL, body TEXT NOT NULL, author VARCHAR(24) NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY t (type)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await q("CREATE TABLE IF NOT EXISTS web_likes (post_id INT NOT NULL, player_id INT NOT NULL, PRIMARY KEY (post_id, player_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  await q("CREATE TABLE IF NOT EXISTS web_comments (id INT AUTO_INCREMENT PRIMARY KEY, post_id INT NOT NULL, player_id INT NOT NULL, author VARCHAR(24) NOT NULL, body VARCHAR(300) NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY p (post_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  await q("CREATE TABLE IF NOT EXISTS web_images (id INT AUTO_INCREMENT PRIMARY KEY, mime VARCHAR(16) NOT NULL, data MEDIUMBLOB NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  await q("CREATE TABLE IF NOT EXISTS web_tries (k VARCHAR(80) NOT NULL, t BIGINT NOT NULL, KEY k (k)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  app.listen(Number(E.PORT) || 3000, () => console.log(`[web] SampCity en ${BASE}`));
})().catch((e) => { console.error("No pude conectar con la base de datos:", e.message); process.exit(1); });
