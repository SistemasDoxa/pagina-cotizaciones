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

document.querySelectorAll(".modelo-card").forEach(card => {
  card.addEventListener("click", () => {
    conjuntoActual = card.dataset.conjunto;
    deporteActual  = card.dataset.deporte;
    const nombre   = card.querySelector("h4").textContent;
    document.getElementById("modalTitulo").textContent = `Cotizar: ${nombre}`;
    document.getElementById("resultadoPrecio").style.display = "none";
    document.getElementById("precioError").style.display     = "none";
    document.getElementById("modalCotizador").style.display  = "flex";
  });
});

document.getElementById("btnCerrarModal").onclick = () => {
  document.getElementById("modalCotizador").style.display = "none";
};
document.getElementById("modalCotizador").addEventListener("click", e => {
  if (e.target.id === "modalCotizador")
    document.getElementById("modalCotizador").style.display = "none";
});

// ── Consultar precio ──────────────────────────────────────────
document.getElementById("btnConsultarPrecio").addEventListener("click", async () => {
  const tela    = document.getElementById("selTela").value;
  const trabajo = document.getElementById("selTrabajo").value;

  if (!tela || !trabajo) {
    alert("Selecciona el tipo de tela y el tipo de trabajo."); return;
  }

  const btn = document.getElementById("btnConsultarPrecio");
  btn.textContent = "Consultando...";
  btn.disabled    = true;

  try {
    const resultado = await getPrecio({
      conjunto: conjuntoActual,
      talla: "M", tela, trabajo,
      deporte: deporteActual
    });

    const errEl  = document.getElementById("precioError");
    const resEl  = document.getElementById("resultadoPrecio");

    if (!resultado) {
      errEl.style.display = "block";
      resEl.style.display = "none";
    } else {
      errEl.style.display = "none";
      resEl.style.display = "block";
      document.getElementById("precioUnitario").textContent =
        `Precio por pieza: $${resultado.precio.toFixed(2)}`;
      document.getElementById("precioNota").textContent =
        resultado.nota ? `* ${resultado.nota}` : "";

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
    alert("Error al consultar. Revisa tu conexión.");
  } finally {
    btn.textContent = "Consultar precio";
    btn.disabled    = false;
  }
});

// ── Redirigir a personalizar ──────────────────────────────────
document.getElementById("btnPersonalizar").addEventListener("click", () => {
  window.location.href = "personalizar.html";
});
