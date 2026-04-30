// ============================================================
//  cotizar.js — lógica de la página de cotización
// ============================================================
import { initNavbar, enviarPedido } from "./doxa.js";

initNavbar();

// ── Cargar datos del conjunto ──────────────────────────────
let conjuntoDatos = null;
const raw = sessionStorage.getItem("doxa_conjunto");
try {
  if (raw) conjuntoDatos = JSON.parse(raw);
} catch(e) {}

if (conjuntoDatos) {
  document.getElementById("resNombre").textContent = conjuntoDatos.nombre || "—";
  const summaryNombre = document.getElementById("summaryNombre");
  if (summaryNombre) summaryNombre.textContent = conjuntoDatos.nombre;
  const precio = parseFloat(conjuntoDatos.precio);
  if (!isNaN(precio)) {
    document.getElementById("resPrecio").textContent = "$" + precio.toFixed(2);
    document.getElementById("resTotalWrap").style.display = "flex";
  }
}

// ── Botones +/− tallas ────────────────────────────────────
const TALLAS = ["S","M","G","XG"];

function recalcular() {
  let total = 0;
  TALLAS.forEach(t => {
    total += parseInt(document.getElementById("t_" + t).value) || 0;
  });
  document.getElementById("totalPiezas").textContent = total;

  const precio = conjuntoDatos ? parseFloat(conjuntoDatos.precio) : 0;
  if (precio > 0 && total > 0) {
    const totalVal = (precio * total).toFixed(2);
    document.getElementById("totalPrecioRow").style.display = "flex";
    document.getElementById("totalPrecioVal").textContent = "$" + totalVal;
    document.getElementById("resTotal").textContent = "$" + totalVal;
    document.getElementById("resTotalWrap").style.display = "flex";
  } else {
    document.getElementById("totalPrecioRow").style.display = "none";
    document.getElementById("resTotal").textContent = "—";
  }
}

document.querySelectorAll(".talla-btn.plus").forEach(btn => {
  btn.addEventListener("click", () => {
    const inp = document.getElementById("t_" + btn.dataset.talla);
    inp.value = (parseInt(inp.value) || 0) + 1;
    recalcular();
  });
});

document.querySelectorAll(".talla-btn.minus").forEach(btn => {
  btn.addEventListener("click", () => {
    const inp = document.getElementById("t_" + btn.dataset.talla);
    const v = (parseInt(inp.value) || 0) - 1;
    inp.value = v < 0 ? 0 : v;
    recalcular();
  });
});

// ── Contador textarea nota ─────────────────────────────────
document.getElementById("cNota").addEventListener("input", () => {
  document.getElementById("notaCount").textContent =
    document.getElementById("cNota").value.length;
});

// ── Ir a contacto ─────────────────────────────────────────
window.irAContacto = function() {
  const total = parseInt(document.getElementById("totalPiezas").textContent);
  if (!total || total < 1) {
    alert("Agrega al menos 1 pieza para continuar.");
    return;
  }
  document.getElementById("seccionTallas").style.display   = "none";
  document.getElementById("seccionContacto").style.display = "block";
  document.getElementById("stepTallas").classList.remove("active");
  document.getElementById("stepTallas").classList.add("done");
  document.getElementById("stepContacto").classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
};

window.regresarATallas = function() {
  document.getElementById("seccionContacto").style.display = "none";
  document.getElementById("seccionTallas").style.display   = "block";
  document.getElementById("stepContacto").classList.remove("active");
  document.getElementById("stepTallas").classList.remove("done");
  document.getElementById("stepTallas").classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
};

// ── Enviar pedido ──────────────────────────────────────────
window.enviarPedidoForm = async function() {
  const nombre   = document.getElementById("cNombre").value.trim();
  const email    = document.getElementById("cEmail").value.trim();
  const telefono = document.getElementById("cTelefono").value.trim();
  const nota     = document.getElementById("cNota").value.trim();

  if (!nombre)   { alert("Por favor ingresa tu nombre completo."); return; }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    alert("Por favor ingresa un correo válido."); return;
  }
  if (!telefono || !/^\d{10,}$/.test(telefono.replace(/[\s\-\(\)]/g,""))) {
    alert("Por favor ingresa un teléfono de al menos 10 dígitos."); return;
  }

  const tallas = {};
  let totalPiezas = 0;
  TALLAS.forEach(t => {
    const v = parseInt(document.getElementById("t_" + t).value) || 0;
    if (v > 0) { tallas[t] = v; totalPiezas += v; }
  });

  const precio      = conjuntoDatos ? parseFloat(conjuntoDatos.precio) : 0;
  const totalPrecio = precio * totalPiezas;

  const pedido = {
    conjunto:       conjuntoDatos?.conjunto        || "",
    deporte:        conjuntoDatos?.deporte         || "",
    nombreConjunto: conjuntoDatos?.nombre          || "",
    tela:           conjuntoDatos?.tela            || "",
    trabajo:        conjuntoDatos?.trabajo         || "",
    precioUnitario: precio,
    tallas,
    totalPiezas,
    totalPrecio,
    nombre,
    email,
    telefono,
    nota,
    estado: "pendiente",
  };

  const btn = document.getElementById("btnEnviar");
  btn.disabled    = true;
  btn.textContent = "Enviando...";

  try {
    await enviarPedido(pedido);

    document.getElementById("seccionContacto").style.display = "none";
    document.getElementById("seccionListo").style.display    = "block";
    document.getElementById("stepContacto").classList.remove("active");
    document.getElementById("stepContacto").classList.add("done");
    document.getElementById("stepListo").classList.add("active");

    document.getElementById("listoNombre").textContent = nombre;
    document.getElementById("listoEmail").textContent  = email;
    document.getElementById("listoTel").textContent    = telefono;

    let resHtml = `<table class="listo-tabla">
      <tr><th>Conjunto</th><td>${conjuntoDatos?.nombre || "—"}</td></tr>
      <tr><th>Tela</th><td>${conjuntoDatos?.tela || "—"}</td></tr>
      <tr><th>Trabajo</th><td>${conjuntoDatos?.trabajo || "—"}</td></tr>`;
    Object.entries(tallas).forEach(([t, c]) => {
      resHtml += `<tr><th>Talla ${t}</th><td>${c} pieza${c>1?"s":""}</td></tr>`;
    });
    resHtml += `<tr><th>Total piezas</th><td><strong>${totalPiezas}</strong></td></tr>`;
    if (precio > 0) resHtml += `<tr><th>Total estimado</th><td><strong>$${totalPrecio.toFixed(2)}</strong></td></tr>`;
    if (nota) resHtml += `<tr><th>Nota</th><td>${nota}</td></tr>`;
    resHtml += `</table>`;
    document.getElementById("listoResumen").innerHTML = resHtml;

    sessionStorage.removeItem("doxa_conjunto");
    window.scrollTo({ top: 0, behavior: "smooth" });

  } catch(err) {
    console.error(err);
    alert("Error al enviar. Verifica tu conexión e intenta de nuevo.");
    btn.disabled    = false;
    btn.textContent = "Enviar cotización ✓";
  }
};
