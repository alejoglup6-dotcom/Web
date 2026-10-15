// store.js — Tienda SampCity con Tebex Headless.
// Recibe las utilidades existentes de server.js; no crea otra conexión MySQL.

const crypto = require("crypto");
const path = require("path");
const express = require("express");

const TEBEX_BASE = "https://headless.tebex.io/api";
const WEBHOOK_PATH = "/api/tebex/webhook";

module.exports = function store(app, { q, me, hit, str, pid, E, BASE }) {
  const publicToken = String(E.TEBEX_PUBLIC_TOKEN || "").trim();
  const privateKey = String(E.TEBEX_PRIVATE_KEY || "").trim();
  const webhookSecret = String(E.TEBEX_WEBHOOK_SECRET || "").trim();

  const headlessHeaders = () => {
    if (!publicToken || !privateKey) throw new Error("Faltan TEBEX_PUBLIC_TOKEN o TEBEX_PRIVATE_KEY");
    const auth = Buffer.from(`${publicToken}:${privateKey}`).toString("base64");
    return { Authorization: `Basic ${auth}`, "Content-Type": "application/json" };
  };

  const tebexFetch = async (path, options = {}) => {
    const response = await fetch(`${TEBEX_BASE}${path}`, {
      ...options,
      headers: { ...headlessHeaders(), ...(options.headers || {}) },
      signal: AbortSignal.timeout(15000),
    });

    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text.slice(0, 500) }; }

    if (!response.ok) {
      console.log("[store] Tebex rechazó", path, response.status, JSON.stringify(data).slice(0, 1000));
      const error = new Error(data.message || data.error || `Tebex respondió ${response.status}`);
      error.status = response.status;
      error.tebex = data;
      throw error;
    }

    return data;
  };

  const activeProduct = async (packageId) => {
    const id = pid(packageId);
    if (!id) return null;
    return (await q("SELECT * FROM store_products WHERE tebex_package_id = ? AND active = 1 LIMIT 1", [id]))[0] || null;
  };

  const orderForBasket = async (basketIdent) =>
    (await q(
      `SELECT o.*, p.tebex_package_id, p.kind, p.amount
       FROM store_orders o
       JOIN store_products p ON p.id = o.product_id
       WHERE o.tebex_basket_id = ? LIMIT 1`,
      [basketIdent],
    ))[0] || null;

  // ---- Página de la tienda ----
  app.get("/tienda", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "tienda.html"));
  });

  // ---- Catálogo ----
  app.get("/api/store/catalog", async (req, res) => {
    const products = await q("SELECT tebex_package_id, name, kind, amount FROM store_products WHERE active = 1 ORDER BY id");
    const catalog = [];

    for (const product of products) {
      try {
        const remote = await tebexFetch(`/accounts/${encodeURIComponent(publicToken)}/packages/${product.tebex_package_id}`);
        const packageData = remote.data || remote;

        catalog.push({
          packageId: product.tebex_package_id,
          name: product.name,
          kind: product.kind,
          amount: product.amount,
          tebexName: packageData.name || product.name,
          price: packageData.total_price ?? packageData.base_price ?? null,
          currency: packageData.currency || "USD",
          description: packageData.description || "",
        });
      } catch (error) {
        console.log("[store] no pude consultar el paquete", product.tebex_package_id, error.message);
      }
    }

    res.json({ products: catalog });
  });

  // ---- Crear carrito y pedido ----
  app.post("/api/store/cart", async (req, res) => {
    const user = await me(req);
    if (!user) return res.status(401).json({ error: "Inicia sesión" });

    const packageId = pid(req.body.packageId);
    const product = await activeProduct(packageId);
    if (!product) return res.status(400).json({ error: "Producto no disponible" });

    if (!hit(`store|${user.id}`, 10, 60000)) return res.status(429).json({ error: "Vas muy rápido, espera un momento" });

    const basket = await tebexFetch(`/accounts/${encodeURIComponent(publicToken)}/baskets`, {
      method: "POST",
      body: JSON.stringify({
        complete_url: `${BASE}/tienda?pedido=creado`,
        cancel_url: `${BASE}/tienda?pedido=cancelado`,
        complete_auto_redirect: true,
        custom: {
          sampcity_player_id: String(user.id),
          sampcity_package_id: String(product.tebex_package_id),
        },
      }),
    });

    const basketData = basket.data || basket;
    const basketIdent = basketData.ident || basketData.id;

    if (!basketIdent) return res.status(502).json({ error: "No se pudo crear el carrito" });

    // Tebex espera el ID numérico del paquete, no su ident.
    await tebexFetch(`/baskets/${encodeURIComponent(basketIdent)}/packages`, {
      method: "POST",
      body: JSON.stringify({
        package_id: String(product.tebex_package_id),
        quantity: 1,
      }),
    });

    const order = await q(
      "INSERT INTO store_orders (player_id, product_id, status, tebex_basket_id) VALUES (?, ?, 'pending', ?)",
      [user.id, product.id, basketIdent],
    );

    res.json({
      ok: true,
      orderId: order.insertId,
      basketIdent,
      checkoutUrl: basketData.links?.checkout || null,
    });
  });

  // ---- Ver carrito ----
  app.get("/api/store/cart", async (req, res) => {
    const user = await me(req);
    if (!user) return res.status(401).json({ error: "Inicia sesión" });

    const basketIdent = str(req.query.basketIdent).slice(0, 64);
    if (!basketIdent) return res.status(400).json({ error: "Falta el carrito" });

    const order = await orderForBasket(basketIdent);
    if (!order || Number(order.player_id) !== Number(user.id)) return res.status(404).json({ error: "Carrito no válido" });

    const basket = await tebexFetch(`/baskets/${encodeURIComponent(basketIdent)}`);
    res.json({ order: { id: order.id, status: order.status }, basket });
  });

  // ---- Ir al checkout ----
  app.post("/api/store/checkout", async (req, res) => {
    const user = await me(req);
    if (!user) return res.status(401).json({ error: "Inicia sesión" });

    const basketIdent = str(req.body.basketIdent).slice(0, 64);
    if (!basketIdent) return res.status(400).json({ error: "Falta el carrito" });

    const order = await orderForBasket(basketIdent);
    if (!order || Number(order.player_id) !== Number(user.id)) return res.status(404).json({ error: "Carrito no válido" });
    if (order.status !== "pending") return res.status(409).json({ error: "Este pedido ya no está pendiente" });

    const basket = await tebexFetch(`/baskets/${encodeURIComponent(basketIdent)}`);
    const basketData = basket.data || basket;
    const checkoutUrl = basketData.links?.checkout;

    if (!checkoutUrl) return res.status(502).json({ error: "Tebex no devolvió un enlace de pago" });

    res.json({ ok: true, checkoutUrl });
  });

  // ---- Historial de compras ----
  app.get("/api/store/orders", async (req, res) => {
    const user = await me(req);
    if (!user) return res.status(401).json({ error: "Inicia sesión" });

    const rows = await q(
      `SELECT o.id, o.status, o.created_at, o.updated_at, p.name AS product, p.kind, p.amount,
              d.status AS delivery_status, d.delivered_at
       FROM store_orders o
       JOIN store_products p ON p.id = o.product_id
       LEFT JOIN store_deliveries d ON d.order_id = o.id
       WHERE o.player_id = ?
       ORDER BY o.id DESC LIMIT 50`,
      [user.id],
    );

    res.json({ orders: rows });
  });

  // ---- Webhook de Tebex ----
  // El cuerpo crudo llega desde server.js en req.rawBody.
  app.post(WEBHOOK_PATH, async (req, res) => {
    const raw = Buffer.isBuffer(req.rawBody)
      ? req.rawBody
      : Buffer.from(typeof req.rawBody === "string" ? req.rawBody : "");

    const signature = String(req.headers["x-signature"] || "");
    let event = {};

    try { event = JSON.parse(raw.toString("utf8") || "{}"); } catch {}

    const eventType = str(event.type).slice(0, 48);
    const transactionId = str(event.data?.transaction?.id || event.data?.id).slice(0, 64);

    let signatureValid = 0;

    try {
      if (webhookSecret && signature) {
        // Tebex firma HMAC-SHA256(secret, SHA256(body)), no HMAC-SHA256(secret, body).
        const bodyHash = crypto
          .createHash("sha256")
          .update(raw.toString("utf8"), "utf8")
          .digest("hex");

        const expected = crypto
          .createHmac("sha256", webhookSecret)
          .update(bodyHash)
          .digest("hex");

        signatureValid = crypto.timingSafeEqual(
          Buffer.from(signature.toLowerCase()),
          Buffer.from(expected),
        ) ? 1 : 0;
      }
    } catch (error) {
      console.log("[store] error validando firma:", error.message);
    }

    const saved = await q(
      `INSERT INTO store_webhook_events
        (provider, event_type, transaction_id, signature_valid, processed, body)
       VALUES ('tebex', ?, ?, ?, 0, CAST(? AS JSON))`,
      [eventType, transactionId, signatureValid, raw.toString("utf8") || "{}"],
    );

    if (!signatureValid) {
      console.log("[store] webhook rechazado: firma inválida");
      return res.status(401).json({ error: "Firma inválida" });
    }

    // Tebex envía este evento al crear el webhook y espera que devolvamos su id.
    if (eventType === "validation.webhook") {
      await q("UPDATE store_webhook_events SET processed = 1 WHERE id = ?", [saved.insertId]);
      return res.status(200).json({ id: event.id });
    }

    if (eventType !== "payment.completed") {
      await q("UPDATE store_webhook_events SET processed = 1 WHERE id = ?", [saved.insertId]);
      return res.status(200).json({ ok: true, ignored: eventType });
    }

    const basketIdent = str(event.data?.basket?.ident || event.data?.basket?.id).slice(0, 64);
    const order = basketIdent ? await orderForBasket(basketIdent) : null;

    if (!order) {
      console.log("[store] pago recibido sin pedido local válido:", basketIdent || transactionId);
      await q("UPDATE store_webhook_events SET processed = 1 WHERE id = ?", [saved.insertId]);
      return res.status(200).json({ ok: true, ignored: "order_not_found" });
    }

    const payment = event.data?.transaction || {};

    await q(
      `INSERT INTO store_payments
        (order_id, provider, transaction_id, status, amount, currency, raw_event)
       VALUES (?, 'tebex', ?, ?, ?, ?, CAST(? AS JSON))
       ON DUPLICATE KEY UPDATE status = VALUES(status), raw_event = VALUES(raw_event)`,
      [
        order.id,
        transactionId,
        str(payment.status || "completed"),
        Number(payment.amount ?? 0) || 0,
        str(payment.currency || "USD").slice(0, 8),
        raw.toString("utf8"),
      ],
    );

    await q(
      `UPDATE store_orders
       SET status = 'paid', tebex_transaction_id = ?
       WHERE id = ? AND status = 'pending'`,
      [transactionId, order.id],
    );

    await q(
      `INSERT IGNORE INTO store_deliveries
        (order_id, player_id, product_id, status)
       VALUES (?, ?, ?, 'pending')`,
      [order.id, order.player_id, order.product_id],
    );

    await q("UPDATE store_webhook_events SET processed = 1 WHERE id = ?", [saved.insertId]);

    res.status(200).json({ ok: true });
  });

  console.log("[store] tienda cargada");
};
