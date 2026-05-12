// ============================================================
//  formulario.js — formulario general de contacto
// ============================================================
import { initNavbar, enviarPedido } from "./doxa.js";

initNavbar();

document.getElementById("cMensaje").addEventListener("input", () => {
  document.getElementById("mensajeCount").textContent =
    document.getElementById("cMensaje").value.length;
});

document.getElementById("btnEnviar").addEventListener("click", async () => {
  const nombre   = document.getElementById("cNombre").value.trim();
  const email    = document.getElementById("cEmail").value.trim();
  const telefono = document.getElementById("cTelefono").value.trim();
  const mensaje  = document.getElementById("cMensaje").value.trim();

  if (!nombre) { alert("Por favor ingresa tu nombre completo."); return; }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    alert("Por favor ingresa un correo válido."); return;
  }
  if (!telefono || !/^\d{10,}$/.test(telefono.replace(/[\s\-\(\)]/g, ""))) {
    alert("Por favor ingresa un teléfono de al menos 10 dígitos."); return;
  }
  if (!mensaje) { alert("Por favor escribe tu mensaje."); return; }

  const pedido = {
    nombre,
    email,
    telefono,
    nota: mensaje,
    estado: "pendiente",
    origen: "formulario-contacto",
  };

  const btn = document.getElementById("btnEnviar");
  btn.disabled    = true;
  btn.textContent = "Enviando...";

  try {
    await enviarPedido(pedido);

    document.getElementById("seccionForm").style.display  = "none";
    document.getElementById("seccionListo").style.display = "block";
    document.getElementById("listoNombre").textContent    = nombre;
    document.getElementById("listoEmail").textContent     = email;
    document.getElementById("listoTel").textContent       = telefono;
    window.scrollTo({ top: 0, behavior: "smooth" });

  } catch (err) {
    console.error(err);
    alert("Error al enviar. Verifica tu conexión e intenta de nuevo.");
    btn.disabled    = false;
    btn.textContent = "Enviar mensaje →";
  }
});
