// ============================================================
//  deporte.js — lógica compartida de soccer, basquetbol, voleibol
// ============================================================
import { initNavbar, getCatalogo, getPrecio, llenarSelect } from "./doxa.js";
import { initModelos } from "./modelos.js";

initNavbar();
initModelos();

// ── Cargar catálogos en el modal ──────────────────────────────
async function cargarCatalogos() {
  const [telas, trabajos] = await Promise.all([
    getCatalogo("tipos_tela"),
    getCatalogo("tipos_trabajo"),
  ]);
  llenarSelect(document.getElementById("selTela"),    telas,    "nombre", "Tipo de tela");
  llenarSelect(document.getElementById("selTrabajo"), trabajos, "nombre", "Tipo de trabajo");
}
cargarCatalogos();

// ── Abrir modal al hacer clic en una modelo-card ──────────────
let conjuntoActual = "";
let deporteActual  = "";

// Delegación de eventos: captura clicks en cualquier .modelo-card
// aunque estén dentro de un acordeón que aún no existía al cargar
document.addEventListener("click", e => {
  const card = e.target.closest(".modelo-card");
  if (!card) return;

  conjuntoActual = card.dataset.conjunto;
  deporteActual  = card.dataset.deporte;
  const nombre   = card.querySelector("h4").textContent;
  document.getElementById("modalTitulo").textContent = `Cotizar: ${nombre}`;
  document.getElementById("precioError").style.display    = "none";
  document.getElementById("modalCotizador").style.display = "flex";
  // Deshabilitar "Personalizar" hasta que se elija tela y trabajo
  document.getElementById("btnPersonalizar").disabled = true;
  // Resetear selects para forzar nueva consulta
  document.getElementById("selTela").value    = "";
  document.getElementById("selTrabajo").value = "";
});

document.getElementById("btnCerrarModal").onclick = () => {
  document.getElementById("modalCotizador").style.display = "none";
};
document.getElementById("modalCotizador").addEventListener("click", e => {
  if (e.target.id === "modalCotizador")
    document.getElementById("modalCotizador").style.display = "none";
});

// ── Consultar precio automáticamente al cambiar selects ───────
async function consultarPrecioAuto() {
  const tela    = document.getElementById("selTela").value;
  const trabajo = document.getElementById("selTrabajo").value;

  const errEl = document.getElementById("precioError");

  // Si aún no se han seleccionado ambos valores, ocultar resultados
  if (!tela || !trabajo) {
    errEl.style.display = "none";
    document.getElementById("btnPersonalizar").disabled = true;
    return;
  }

  try {
    const resultado = await getPrecio({
      conjunto: conjuntoActual,
      talla: "M", tela, trabajo,
      deporte: deporteActual
    });

    if (!resultado) {
      errEl.style.display = "block";
      document.getElementById("btnPersonalizar").disabled = true;
    } else {
      errEl.style.display = "none";
      document.getElementById("btnPersonalizar").disabled = false;

      const nombreConjunto = document.getElementById("modalTitulo").textContent.replace("Cotizar: ", "");
      sessionStorage.setItem("doxa_conjunto", JSON.stringify({
        conjunto:  conjuntoActual,
        deporte:   deporteActual,
        nombre:    nombreConjunto,
        precio:    resultado.precio,
        tela:      document.getElementById("selTela").options[document.getElementById("selTela").selectedIndex].text,
        trabajo:   document.getElementById("selTrabajo").options[document.getElementById("selTrabajo").selectedIndex].text,
        nota:      resultado.nota || ""
      }));
    }
  } catch (err) {
    console.error(err);
    errEl.style.display = "block";
    document.getElementById("btnPersonalizar").disabled = true;
  }
}

document.getElementById("selTela").addEventListener("change", consultarPrecioAuto);
document.getElementById("selTrabajo").addEventListener("change", consultarPrecioAuto);

// ── Redirigir a personalizar ──────────────────────────────────
document.getElementById("btnPersonalizar").addEventListener("click", () => {
  window.location.href = "personalizar.html";
});
