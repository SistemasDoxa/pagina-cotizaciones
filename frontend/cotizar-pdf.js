// ============================================================
//  cotizar-pdf.js — único archivo para generación del PDF de diseño
//  Carga jsPDF automáticamente si no está disponible
// ============================================================

(function cargarJsPDF() {
  if (window.jspdf) return;
  var s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  document.head.appendChild(s);
})();

// ── Mostrar logo del usuario ──────────────────────────────────
(function mostrarLogo() {
  const logoDataUrl = sessionStorage.getItem("doxa_logo");
  if (!logoDataUrl) return;
  const wrap = document.getElementById("logoUsuarioWrap");
  const img  = document.getElementById("logoUsuarioImg");
  if (!wrap || !img) return;
  img.src = logoDataUrl;
  wrap.style.display = "block";
})();

// ── Helpers de estilo ─────────────────────────────────────────
function dibujarEncabezado(doc, nombreConj, pageW, margin) {
  const fecha = new Date().toLocaleDateString("es-MX", {
    year: "numeric", month: "long", day: "numeric"
  });
  doc.setFillColor(192, 57, 43);
  doc.rect(0, 0, pageW, 24, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text("Doxa Deportes — Vista de diseño", margin, 10);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Conjunto: " + nombreConj, margin, 18);
  doc.text("Fecha: " + fecha, pageW - margin, 18, { align: "right" });
}

function dibujarPiePagina(doc, pageW, pageH, margin) {
  doc.setDrawColor(192, 57, 43);
  doc.setLineWidth(0.5);
  doc.line(margin, pageH - 14, pageW - margin, pageH - 14);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(140, 140, 140);
  doc.text(
    "www.doxadeportes.com  |  @doxa.deportes  |  facebook.com/dep.DOXA",
    pageW / 2, pageH - 8, { align: "center" }
  );
}

// Dibuja un grid 2x2 con las 4 vistas de una prenda.
// Devuelve la Y donde termina el grid.
function dibujarGrid(doc, vistas, subtitulo, startY, pageW, margin) {
  if (!vistas) {
    console.warn("No se encontraron vistas para:", subtitulo || "Prenda única");
    return startY;
  }

  const ORDEN = ["Frente", "Trasera", "Izquierda", "Derecha"];
  const LABEL_MAPA = {
    "Frente":    "FRENTE",
    "Trasera":   "TRASERA",
    "Izquierda": "LADO IZQUIERDO",
    "Derecha":   "LADO DERECHO"
  };

  const colW = (pageW - margin * 2 - 8) / 2;
  const colH = colW * 0.85;
  let y0 = startY;

  if (subtitulo) {
    doc.setFillColor(192, 57, 43);
    doc.rect(margin, y0, 3, 8, "F");
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(192, 57, 43);
    doc.text(subtitulo.toUpperCase(), margin + 6, y0 + 6.5);
    y0 += 13;
  }

  ORDEN.forEach(function(nombre, i) {
    var dataUrl = vistas[nombre];
    if (!dataUrl) return;

    var col = i % 2;
    var row = Math.floor(i / 2);
    var x   = margin + col * (colW + 8);
    var y   = y0 + row * (colH + 16);

    // Sombra
    doc.setFillColor(225, 225, 225);
    doc.roundedRect(x + 1.2, y + 1.2, colW, colH + 10, 2, 2, "F");
    // Fondo celda
    doc.setFillColor(252, 252, 252);
    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.4);
    doc.roundedRect(x, y, colW, colH + 10, 2, 2, "FD");
    // Franja etiqueta roja
    doc.setFillColor(192, 57, 43);
    doc.roundedRect(x, y, colW, 8, 2, 2, "F");
    doc.rect(x, y + 4, colW, 4, "F");
    // Texto etiqueta
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(LABEL_MAPA[nombre] || nombre.toUpperCase(), x + colW / 2, y + 5.5, { align: "center" });
    // Imagen
    try {
      doc.addImage(dataUrl, "JPEG", x + 2, y + 9, colW - 4, colH - 1);
    } catch(e) { console.warn("Error imagen", nombre, e); }
  });

  return y0 + 2 * (colH + 16);
}

async function dibujarLogo(doc, logoDataUrl, afterY, pageW, margin) {
  if (!logoDataUrl) return afterY;
  var logoY = afterY + 4;
  doc.setDrawColor(210, 210, 210);
  doc.setLineWidth(0.3);
  doc.line(margin, logoY, pageW - margin, logoY);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(60, 60, 60);
  doc.text("Logo / Imagen del equipo", margin, logoY + 6);
  try {
    var tmpImg = new Image();
    await new Promise(function(res) { tmpImg.onload = res; tmpImg.src = logoDataUrl; });
    var asp  = tmpImg.naturalWidth / tmpImg.naturalHeight;
    var maxW = 55, maxH = 28;
    var lw = maxW, lh = maxW / asp;
    if (lh > maxH) { lh = maxH; lw = lh * asp; }
    var lx = margin, ly = logoY + 9;
    doc.setFillColor(250, 250, 250);
    doc.setDrawColor(210, 210, 210);
    doc.roundedRect(lx, ly, lw + 4, lh + 4, 2, 2, "FD");
    doc.addImage(logoDataUrl, lx + 2, ly + 2, lw, lh);
    return ly + lh + 8;
  } catch(e) {
    console.warn("Error logo:", e);
    return logoY + 40;
  }
}

// ── Construir PDF ─────────────────────────────────────────────
async function construirPDF() {
  var raw = sessionStorage.getItem("doxa_vistas");
  if (!raw) return null;

  // --- MEJORA: Parseo seguro de JSON ---
  var guardado;
  try {
    guardado = JSON.parse(raw);
  } catch(e) {
    console.error("Error al leer doxa_vistas:", e);
    return null;
  }

  // Compatibilidad con formato anterior (objeto plano Frente/Trasera/...)
  var tipo, prendas;
  if (guardado && guardado.prendas) {
    tipo    = guardado.tipo;
    prendas = guardado.prendas;
  } else if (guardado) {
    tipo    = "playera";
    prendas = { playera: guardado };
  } else {
    return null;
  }
  var rawConj = sessionStorage.getItem("doxa_conjunto");
  var nombreConj = "Diseño personalizado";
  try { if (rawConj) nombreConj = JSON.parse(rawConj).nombre || nombreConj; } catch(e) {}

  var logoDataUrl = sessionStorage.getItem("doxa_logo") || null;

  var jsPDFCls = window.jspdf.jsPDF;
  var pageW  = 210;
  var pageH  = 297;
  var margin = 14;
  var startY = 30;

  var doc = new jsPDFCls({ orientation: "portrait", unit: "mm", format: "a4" });
  dibujarEncabezado(doc, nombreConj, pageW, margin);

  var esConjunto   = tipo === "playera_short" || tipo === "playera_short_calceta";
  var tienePlayera = (tipo === "playera" || esConjunto) && !!prendas.playera;
  var tieneShort   = (tipo === "short"   || esConjunto) && !!prendas.short;
  var dosPrendas   = tienePlayera && tieneShort;

  var colW       = (pageW - margin * 2 - 8) / 2;
  var colH       = colW * 0.85;
  var alturaGrid = 13 + 2 * (colH + 16);
  var espacioLib = pageH - 20 - (startY + alturaGrid);

  if (!dosPrendas) {
    // Prenda única
    var vistaUnica = tienePlayera ? prendas.playera : prendas.short;
    var afterGrid  = dibujarGrid(doc, vistaUnica, null, startY, pageW, margin);
    await dibujarLogo(doc, logoDataUrl, afterGrid, pageW, margin);

  } else {
    // Página 1 — Playera
    if (tienePlayera) {
      var ag1 = dibujarGrid(doc, prendas.playera, "Playera", startY, pageW, margin);
      if (logoDataUrl && espacioLib > 40) {
        await dibujarLogo(doc, logoDataUrl, ag1, pageW, margin);
      }
    }
    // Página 2 — Short
    if (tieneShort) {
      doc.addPage();
      dibujarEncabezado(doc, nombreConj, pageW, margin);
      var ag2 = dibujarGrid(doc, prendas.short, "Short", startY, pageW, margin);
      if (logoDataUrl && !tienePlayera) {
        await dibujarLogo(doc, logoDataUrl, ag2, pageW, margin);
      }
    }
  }

  // Pie en todas las páginas
  var totalPages = doc.internal.getNumberOfPages();
  for (var p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    dibujarPiePagina(doc, pageW, pageH, margin);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(160, 160, 160);
    doc.text("Página " + p + " de " + totalPages, pageW - margin, pageH - 8, { align: "right" });
  }

  return doc;
}

// ── Mostrar PDF en iframe ─────────────────────────────────────
async function mostrarPDFEnPagina() {
  if (!sessionStorage.getItem("doxa_vistas")) return;

  var vistasDiv = document.getElementById("vistasDiseno");
  if (vistasDiv) vistasDiv.style.display = "block";

  var t = 0;
  while (!window.jspdf && t < 50) { await new Promise(function(r) { setTimeout(r, 100); }); t++; }
  if (!window.jspdf) {
    var cargandoTxt = document.getElementById("pdfCargando");
    if (cargandoTxt) cargandoTxt.textContent = "No se pudo cargar el generador de PDF.";
    return;
  }

  try {
    var doc = await construirPDF();
    if (!doc) {
      document.getElementById("pdfCargando").textContent = "No hay vistas guardadas del diseño.";
      return;
    }
    var blob    = doc.output("blob");
    var blobUrl = URL.createObjectURL(blob);

    var visor = document.getElementById("pdfVisor");
    var cargando = document.getElementById("pdfCargando");
    
    if (visor) {
      visor.src = blobUrl;
      visor.style.display = "block";
    }
    if (cargando) cargando.style.display = "none";

    window._pdfBlobUrl = blobUrl;
    try {
      var c = JSON.parse(sessionStorage.getItem("doxa_conjunto"));
      window._pdfNombre = "Doxa_Diseño_" + (c.nombre || "uniforme").replace(/\s+/g, "_") + ".pdf";
    } catch(e) { window._pdfNombre = "Doxa_Diseño.pdf"; }

  } catch(e) {
    console.error("Error generando PDF:", e);
    var cargandoErr = document.getElementById("pdfCargando");
    if (cargandoErr) cargandoErr.textContent = "Error al generar la vista previa.";
  }
}

// ── Descargar PDF ─────────────────────────────────────────────
window.descargarPDFVistas = async function() {
  var btn = document.getElementById("btnDescargarPDF");
  if (!btn) return;
  
  btn.disabled    = true;
  btn.textContent = "Generando…";
  try {
    if (!window._pdfBlobUrl) await mostrarPDFEnPagina();
    if (window._pdfBlobUrl) {
      var a    = document.createElement("a");
      a.href     = window._pdfBlobUrl;
      a.download = window._pdfNombre || "Doxa_Diseño.pdf";
      a.click();
    }
  } catch(e) { alert("Error al descargar el PDF."); }
  btn.disabled    = false;
  btn.textContent = "⬇️ Descargar PDF";
};

// ── Disparar mostrarPDFEnPagina al llegar al paso de contacto ─
(function patchIrAContacto() {
  var tries = 0;
  var id = setInterval(function() {
    tries++;
    if (typeof window.irAContacto === "function") {
      clearInterval(id);
      var orig = window.irAContacto;
      window.irAContacto = function() {
        orig();
        setTimeout(mostrarPDFEnPagina, 150);
      };
    }
    if (tries > 60) clearInterval(id);
  }, 100);
})();