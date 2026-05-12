// ============================================================
//  server.js — Backend Doxa Deportes
//  Las credenciales de Firebase NUNCA llegan al navegador.
// ============================================================
require("dotenv").config();

const express      = require("express");
const cors         = require("cors");
const admin        = require("firebase-admin");
const path         = require("path");
const nodemailer   = require("nodemailer");

// ── Transporter de correo (Gmail con contraseña de app) ──────
const mailer = nodemailer.createTransport({
  host:   process.env.MAIL_HOST || "smtp.gmail.com",
  port:   Number(process.env.MAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

// ── Inicializar Firebase Admin con variables de entorno ──────
admin.initializeApp({
  credential: admin.credential.cert(
    require("./serviceAccountKey.json")
  ),
  projectId: process.env.FIREBASE_PROJECT_ID,
});

const db = admin.firestore();

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ───────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || "*",
  methods: ["GET", "POST"],
}));
app.use(express.json({ limit: "15mb" }));

// Servir el frontend estático
app.use(express.static(path.join(__dirname, "../frontend")));

// ── Helpers ──────────────────────────────────────────────────
function snap2arr(snapshot) {
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Bloque HTML del encabezado rojo compartido ───────────────
const headerCorreo = `
  <div style="background:#c0392b;padding:20px;text-align:center">
    <h1 style="color:#fff;margin:0">Doxa Deportes</h1>
    <p style="color:#fff;margin:4px 0 0">Uniformes deportivos personalizados</p>
  </div>`;

const footerCorreo = `
  <div style="background:#f5f5f5;padding:12px;text-align:center;font-size:12px;color:#888">
    www.doxadeportes.com · @doxa.deportes · facebook.com/dep.DOXA
  </div>`;

// ── RUTAS API ────────────────────────────────────────────────

// GET /api/catalogo/:coleccion
app.get("/api/catalogo/:coleccion", async (req, res) => {
  try {
    const snap = await db.collection(req.params.coleccion).get();
    res.json(snap2arr(snap));
  } catch (err) {
    console.error("catalogo error:", err);
    res.status(500).json({ error: "Error al obtener catálogo" });
  }
});

// POST /api/precio
app.post("/api/precio", async (req, res) => {
  try {
    const { conjunto, talla, tela, trabajo, deporte } = req.body;
    if (!conjunto || !talla || !tela || !trabajo || !deporte) {
      return res.status(400).json({ error: "Faltan parámetros" });
    }

    let q = db.collection("precios")
      .where("conjunto_id", "==", conjunto)
      .where("talla",       "==", talla)
      .where("tela_id",     "==", tela)
      .where("trabajo_id",  "==", trabajo)
      .where("deporte_id",  "==", deporte);

    const snap = await q.get();
    if (snap.empty) return res.json(null);
    res.json({ id: snap.docs[0].id, ...snap.docs[0].data() });
  } catch (err) {
    console.error("precio error:", err);
    res.status(500).json({ error: "Error al consultar precio" });
  }
});

// POST /api/pedidos
app.post("/api/pedidos", async (req, res) => {
  try {
    const {
      conjunto, deporte, nombreConjunto,
      tela, trabajo, precioUnitario,
      tallas, totalPiezas, totalPrecio,
      nombre, email, telefono, nota,
      origen,
    } = req.body;

    // Validación básica
    if (!nombre || !email || !telefono) {
      return res.status(400).json({ error: "Faltan datos de contacto" });
    }
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return res.status(400).json({ error: "Email inválido" });
    }
    if (!String(telefono).replace(/[\s\-\(\)]/g, "").match(/^\d{10,}$/)) {
      return res.status(400).json({ error: "Teléfono inválido" });
    }

    const pedido = {
      conjunto:       conjunto       || "",
      deporte:        deporte        || "",
      nombreConjunto: nombreConjunto || "",
      tela:           tela           || "",
      trabajo:        trabajo        || "",
      precioUnitario: Number(precioUnitario) || 0,
      tallas:         tallas         || {},
      totalPiezas:    Number(totalPiezas) || 0,
      totalPrecio:    Number(totalPrecio) || 0,
      nombre,
      email,
      telefono,
      nota:           nota           || "",
      origen:         origen         || "cotizacion",
      estado:         "pendiente",
      creadoEn:       admin.firestore.FieldValue.serverTimestamp(),
    };

    const ref = await db.collection("pedidos").add(pedido);

    // ── Enviar correo automático ─────────────────────────────
    try {
      const { pdfBase64, logoBase64 } = req.body;
      let htmlCorreo, subject, subjectInterno;

      // ── Template según origen ──────────────────────────────
      if (origen === "formulario-contacto") {

        // Correo simple para el formulario general de contacto
        subject        = "Doxa Deportes — Recibimos tu mensaje";
        subjectInterno = `[Nuevo contacto] ${pedido.nombre}`;

        htmlCorreo = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
            ${headerCorreo}
            <div style="padding:28px 24px">
              <p style="font-size:15px">Hola <strong>${pedido.nombre}</strong>,</p>
              <p style="color:#444">Recibimos tu mensaje. En breve un asesor de Doxa se pondrá en contacto contigo.</p>

              <div style="background:#f9f9f9;border-left:4px solid #c0392b;padding:14px 18px;margin:20px 0;border-radius:4px">
                <p style="margin:0 0 6px;font-size:13px;color:#888;text-transform:uppercase;letter-spacing:.05em">Tu mensaje</p>
                <p style="margin:0;color:#222;font-size:15px">${pedido.nota}</p>
              </div>

              <table style="border-collapse:collapse;width:100%;margin-top:8px">
                <tr>
                  <td style="padding:6px 12px;border:1px solid #ddd;color:#666;width:40%"><strong>Teléfono</strong></td>
                  <td style="padding:6px 12px;border:1px solid #ddd">${pedido.telefono}</td>
                </tr>
                <tr>
                  <td style="padding:6px 12px;border:1px solid #ddd;color:#666"><strong>Correo</strong></td>
                  <td style="padding:6px 12px;border:1px solid #ddd">${pedido.email}</td>
                </tr>
              </table>

              <p style="margin-top:24px;color:#555">¡Gracias por contactarnos! Encontraremos la solución que tu equipo necesita.</p>
            </div>
            ${footerCorreo}
          </div>`;

      } else {

        // Correo completo de cotización (comportamiento original)
        subject        = `Doxa Deportes — Cotización recibida: ${pedido.nombreConjunto}`;
        subjectInterno = `[Nuevo pedido] ${pedido.nombreConjunto} — ${pedido.nombre}`;

        const tallasHTML = Object.entries(pedido.tallas)
          .map(([t, c]) => `<tr>
            <td style="padding:5px 12px;border:1px solid #ddd">Talla ${t}</td>
            <td style="padding:5px 12px;border:1px solid #ddd">${c} pieza${c > 1 ? "s" : ""}</td>
          </tr>`).join("");

        htmlCorreo = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
            ${headerCorreo}
            <div style="padding:24px">
              <p>Hola <strong>${pedido.nombre}</strong>,</p>
              <p>Recibimos tu cotización. Aquí está el resumen:</p>
              <table style="border-collapse:collapse;width:100%">
                <tr><td style="padding:5px 12px;border:1px solid #ddd"><strong>Conjunto</strong></td>
                    <td style="padding:5px 12px;border:1px solid #ddd">${pedido.nombreConjunto}</td></tr>
                <tr><td style="padding:5px 12px;border:1px solid #ddd"><strong>Tela</strong></td>
                    <td style="padding:5px 12px;border:1px solid #ddd">${pedido.tela}</td></tr>
                <tr><td style="padding:5px 12px;border:1px solid #ddd"><strong>Trabajo</strong></td>
                    <td style="padding:5px 12px;border:1px solid #ddd">${pedido.trabajo}</td></tr>
                ${tallasHTML}
                <tr><td style="padding:5px 12px;border:1px solid #ddd"><strong>Total piezas</strong></td>
                    <td style="padding:5px 12px;border:1px solid #ddd">${pedido.totalPiezas}</td></tr>
                ${pedido.precioUnitario > 0 ? `
                <tr><td style="padding:5px 12px;border:1px solid #ddd"><strong>Precio unitario</strong></td>
                    <td style="padding:5px 12px;border:1px solid #ddd">$${pedido.precioUnitario.toFixed(2)}</td></tr>
                <tr><td style="padding:5px 12px;border:1px solid #ddd"><strong>Total estimado</strong></td>
                    <td style="padding:5px 12px;border:1px solid #ddd"><strong>$${pedido.totalPrecio.toFixed(2)}</strong></td></tr>
                ` : ""}
                ${pedido.nota ? `
                <tr><td style="padding:5px 12px;border:1px solid #ddd"><strong>Nota</strong></td>
                    <td style="padding:5px 12px;border:1px solid #ddd">${pedido.nota}</td></tr>` : ""}
              </table>
              <p style="margin-top:20px">En breve nos pondremos en contacto al número <strong>${pedido.telefono}</strong>.</p>
              <p>¡Gracias por confiar en Doxa Deportes!</p>
            </div>
            ${footerCorreo}
          </div>`;
      }

      // Adjuntos (solo aplican para cotizaciones con diseño)
      const attachments = [];
      if (pdfBase64) {
        attachments.push({
          filename:    `Doxa_Diseño_${(pedido.nombreConjunto || "uniforme").replace(/\s+/g, "_")}.pdf`,
          content:     pdfBase64.replace(/^data:application\/pdf;base64,/, ""),
          encoding:    "base64",
          contentType: "application/pdf",
        });
      }
      if (logoBase64) {
        const ext = logoBase64.startsWith("data:image/png") ? "png" : "jpg";
        attachments.push({
          filename:    `logo_equipo.${ext}`,
          content:     logoBase64.replace(/^data:[^;]+;base64,/, ""),
          encoding:    "base64",
          contentType: ext === "png" ? "image/png" : "image/jpeg",
        });
      }

      // Correo al cliente
      await mailer.sendMail({
        from:        `"Doxa Deportes" <${process.env.MAIL_USER}>`,
        to:          pedido.email,
        subject,
        html:        htmlCorreo,
        attachments,
      });

      // Copia interna
      if (process.env.MAIL_INTERNO) {
        await mailer.sendMail({
          from:        `"Doxa Web" <${process.env.MAIL_USER}>`,
          to:          process.env.MAIL_INTERNO,
          subject:     subjectInterno,
          html:        `<p><strong>ID Firestore:</strong> ${ref.id}</p><p><strong>Teléfono:</strong> ${pedido.telefono}</p>` + htmlCorreo,
          attachments,
        });
      }

    } catch (mailErr) {
      console.error("⚠️  Error enviando correo:", mailErr.message);
    }
    // ── Fin correo ───────────────────────────────────────────

    res.json({ id: ref.id, ok: true });
  } catch (err) {
    console.error("pedidos error:", err);
    res.status(500).json({ error: "Error al guardar pedido" });
  }
});

// Cualquier ruta no-API → servir el index.html del frontend
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// ── Arrancar ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅  Servidor Doxa corriendo en http://localhost:${PORT}`);
  console.log(`   Firebase project: ${process.env.FIREBASE_PROJECT_ID}`);
});
