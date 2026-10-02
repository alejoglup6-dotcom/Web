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
const CSP = ["default-src 'self'", "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com", "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", "font-src https://fonts.gstatic.com", "img-src 'self' data: https:", "connect-src 'self'", "frame-src https://challenges.cloudflare.com", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'"].join("; ");
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
    if (!/^application\/json/i.test(req.headers["content-type"] || "")) return res.status(415).json({ error: "Formato no válido" });
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
  const a = (await q(`SELECT p.name, p.reg_date, p.last_connection, p.time_playing, p.level, p.rep, p.connected, p.admin_level, p.vip, p.vip_expire_date, p.cash, p.bank_money, p.phone_number, p.wanted_level, p.arrests_count, p.kills_count, c.name AS crew FROM player p LEFT JOIN crews c ON c.id = p.crew WHERE p.id = ?`, [u.id]))[0];
  const d = (await q("SELECT discord_id, linked_at FROM discord_links WHERE player_id = ?", [u.id]))[0];
  res.json({ user: { ...a, rango: ADMIN_LEVELS[a.admin_level] || "Ciudadano", canPost: a.admin_level >= MIN_POST, discord: d || null } });
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
    if (!u || !st || typeof req.query.state !== "string" || st !== req.query.state || typeof req.query.code !== "string" || !req.query.code) return res.redirect("/?discord=error");
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
  res.json({ total: Number(r.total), online: Number(r.online), ip: E.SERVER_IP || "", turnstile: E.TURNSTILE_SECRET ? E.TURNSTILE_SITEKEY || "" : "" });
});

// ---- Staff (nombre y rango, nada más) ----
app.get("/api/staff", async (req, res) => res.json(await q("SELECT name, admin_level AS level, connected FROM player WHERE admin_level > 0 ORDER BY admin_level DESC, name LIMIT 60")));

// ---- Noticias / actualizaciones / FAQ / reglas / fotos ----
const TYPES = ["news", "update", "faq", "photo", "rules", "review"]; // review = testimonios (los publica el staff)
const staffOnly = async (req, res) => { const u = await me(req); if (!u || u.admin_level < MIN_POST) { res.status(403).json({ error: "No tienes permiso" }); return null; } return u; };
app.get("/api/posts", async (req, res) => {
  const type = TYPES.includes(req.query.type) ? req.query.type : null, uid = sessionId(req) || 0;
  res.json(await q(`SELECT p.id, p.type, p.title, p.body, p.author, p.created_at, (SELECT COUNT(*) FROM web_likes l WHERE l.post_id = p.id) AS likes, (SELECT COUNT(*) FROM web_comments c WHERE c.post_id = p.id) AS comments, (SELECT COUNT(*) FROM web_likes l WHERE l.post_id = p.id AND l.player_id = ?) AS mine FROM web_posts p ${type ? "WHERE p.type = ?" : ""} ORDER BY p.id DESC LIMIT 50`, type ? [uid, type] : [uid]));
});
app.post("/api/posts", async (req, res) => {
  const u = await staffOnly(req, res); if (!u) return;
  const type = str(req.body.type), title = str(req.body.title).trim(), body = str(req.body.body).trim();
  if (!TYPES.includes(type) || !title || !body) return res.status(400).json({ error: "Faltan datos" });
  if (type === "photo" && !/^https:\/\/[^\s"'<>]{4,500}$/.test(body)) return res.status(400).json({ error: "El enlace de la foto debe empezar con https://" });
  await q("INSERT INTO web_posts (type, title, body, author) VALUES (?, ?, ?, ?)", [type, title.slice(0, 120), body.slice(0, 4000), u.name]);
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
  const u = await staffOnly(req, res); if (!u) return;
  const id = pid(req.params.id), p = (await q("SELECT body FROM web_posts WHERE id = ?", [id]))[0], im = /^\/img\/(\d+)$/.exec(p?.body || "");
  if (im) await q("DELETE FROM web_images WHERE id = ?", [im[1]]);
  await q("DELETE FROM web_likes WHERE post_id = ?", [id]);
  await q("DELETE FROM web_comments WHERE post_id = ?", [id]);
  await q("DELETE FROM web_posts WHERE id = ?", [id]);
  res.json({ ok: true });
});
// ---- Contacto: lo envía cualquiera, solo el staff lo lee ----
app.post("/api/contact", async (req, res) => {
  if (str(req.body.website)) return res.json({ ok: true }); // campo trampa para bots: un humano no lo ve ni lo llena
  const name = str(req.body.name).trim().slice(0, 80), contact = str(req.body.contact).trim().slice(0, 80), body = str(req.body.message).trim().slice(0, 1000);
  if (!name || body.length < 10) return res.status(400).json({ error: "Escribe tu nombre y un mensaje de al menos 10 letras" });
  if (!hit("c|" + req.ip, 3, 3600000)) return res.status(429).json({ error: "Ya enviaste varios mensajes. Inténtalo más tarde." });
  if (!(await captchaOk(req))) return res.status(400).json({ error: "Completa la verificación anti-robots", captcha: true });
  await q("INSERT INTO web_contact (name, contact, body) VALUES (?, ?, ?)", [name, contact, body]);
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
  if (!(await q("SELECT 1 FROM web_posts WHERE id = ?", [id])).length) return res.status(404).json({ error: "No existe" });
  const del = await q("DELETE FROM web_likes WHERE post_id = ? AND player_id = ?", [id, u.id]);
  if (!del.affectedRows) await q("INSERT IGNORE INTO web_likes (post_id, player_id) VALUES (?, ?)", [id, u.id]);
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
  if (!(await q("SELECT 1 FROM web_posts WHERE id = ?", [id])).length) return res.status(404).json({ error: "No existe" });
  if (Number((await q("SELECT COUNT(*) AS n FROM web_comments WHERE player_id = ? AND created_at > NOW() - INTERVAL 1 MINUTE", [u.id]))[0].n) >= 5) return res.status(429).json({ error: "Vas muy rápido, espera un momento" });
  await q("INSERT INTO web_comments (post_id, player_id, author, body) VALUES (?, ?, ?, ?)", [id, u.id, u.name, body]);
  res.json({ ok: true });
});
app.delete("/api/posts/:id/comments/:cid", async (req, res) => {
  const u = await me(req); if (!u) return res.status(401).json({ error: "Inicia sesión" });
  await q("DELETE FROM web_comments WHERE id = ? AND post_id = ? AND (player_id = ? OR ? >= ?)", [pid(req.params.cid), pid(req.params.id), u.id, u.admin_level, MIN_POST]);
  res.json({ ok: true });
});

// ---- SEO: robots.txt, sitemap.xml e index con la URL real (canonical / Open Graph) ----
const fs = require("fs");
const INDEX = fs.readFileSync(path.join(__dirname, "public", "index.html"), "utf8").replace(/\{\{BASE\}\}/g, BASE);
app.get(["/", "/index.html"], (req, res) => res.type("html").set("Cache-Control", "public, max-age=300").send(INDEX));
app.get("/robots.txt", (req, res) => res.type("text/plain").send(`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /auth/\n\nSitemap: ${BASE}/sitemap.xml\n`));
app.get("/sitemap.xml", (req, res) => res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${BASE}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>\n</urlset>\n`));
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
  app.listen(Number(E.PORT) || 3000, () => console.log(`[web] SampCity en ${BASE}`));
})().catch((e) => { console.error("No pude conectar con la base de datos:", e.message); process.exit(1); });
