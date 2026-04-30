// ============================================================
//  server.js — Backend Doxa Deportes
//  Las credenciales de Firebase NUNCA llegan al navegador.
// ============================================================
require("dotenv").config();

const express   = require("express");
const cors      = require("cors");
const admin     = require("firebase-admin");
const path      = require("path");

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
  origin: process.env.FRONTEND_ORIGIN || "*",   // en producción limitar al dominio real
  methods: ["GET", "POST"],
}));
app.use(express.json({ limit: "2mb" }));

// Servir el frontend estático
app.use(express.static(path.join(__dirname, "../frontend")));

// ── Helpers ──────────────────────────────────────────────────
function snap2arr(snapshot) {
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── RUTAS API ────────────────────────────────────────────────

// GET /api/catalogo/:coleccion
// Devuelve todos los documentos de una colección.
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
// Body: { conjunto, talla, tela, trabajo, deporte }
// Devuelve el documento de precio que coincide.
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
// Guarda un nuevo pedido en Firestore.
app.post("/api/pedidos", async (req, res) => {
  try {
    const {
      conjunto, deporte, nombreConjunto,
      tela, trabajo, precioUnitario,
      tallas, totalPiezas, totalPrecio,
      nombre, email, telefono, nota,
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
      conjunto:      conjunto      || "",
      deporte:       deporte       || "",
      nombreConjunto: nombreConjunto || "",
      tela:          tela          || "",
      trabajo:       trabajo       || "",
      precioUnitario: Number(precioUnitario) || 0,
      tallas:        tallas        || {},
      totalPiezas:   Number(totalPiezas) || 0,
      totalPrecio:   Number(totalPrecio) || 0,
      nombre,
      email,
      telefono,
      nota:          nota          || "",
      estado:        "pendiente",
      creadoEn:      admin.firestore.FieldValue.serverTimestamp(),
    };

    const ref = await db.collection("pedidos").add(pedido);
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
