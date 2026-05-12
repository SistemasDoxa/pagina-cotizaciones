// ============================================================
//  doxa.js  — helpers compartidos: navbar, API calls
//  ✅ Sin credenciales de Firebase. Todo pasa por el backend.
// ============================================================

const API = "/api";   // relativo al mismo servidor

// ── Navbar: dropdown desktop + hamburguesa móvil ─────────────
export function initNavbar() {
  // Dropdown desktop
  const btnDrop = document.getElementById("menuPersonalizacion");
  const sub     = document.getElementById("submenuPersonalizacion");
  if (btnDrop && sub) {
    btnDrop.addEventListener("click", e => { e.preventDefault(); sub.classList.toggle("show"); });
    document.addEventListener("click", e => {
      if (!btnDrop.contains(e.target) && !sub.contains(e.target))
        sub.classList.remove("show");
    });
  }

  // Hamburguesa móvil
  const btnHam   = document.getElementById("btnHamburguesa");
  const navMobile = document.getElementById("navMobile");
  if (!btnHam || !navMobile) return;

  btnHam.addEventListener("click", e => {
    e.stopPropagation();
    const abierto = navMobile.classList.toggle("abierto");
    btnHam.classList.toggle("abierto", abierto);
    btnHam.setAttribute("aria-expanded", abierto);
  });

  // Cerrar al hacer click fuera
  document.addEventListener("click", e => {
    if (!btnHam.contains(e.target) && !navMobile.contains(e.target)) {
      navMobile.classList.remove("abierto");
      btnHam.classList.remove("abierto");
      btnHam.setAttribute("aria-expanded", false);
    }
  });

  // Cerrar al navegar a un link
  navMobile.querySelectorAll("a").forEach(a => {
    a.addEventListener("click", () => {
      navMobile.classList.remove("abierto");
      btnHam.classList.remove("abierto");
    });
  });
}

// ── Catálogos desde la API ───────────────────────────────────
export async function getCatalogo(coleccion) {
  const res = await fetch(`${API}/catalogo/${encodeURIComponent(coleccion)}`);
  if (!res.ok) throw new Error(`Error al cargar catálogo: ${coleccion}`);
  return res.json();
}

// ── Consulta de precio ───────────────────────────────────────
export async function getPrecio({ conjunto, talla, tela, trabajo, deporte }) {
  const res = await fetch(`${API}/precio`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ conjunto, talla, tela, trabajo, deporte }),
  });
  if (!res.ok) throw new Error("Error al consultar precio");
  return res.json();   // null si no existe
}

// ── Enviar pedido ────────────────────────────────────────────
export async function enviarPedido(pedido) {
  const res = await fetch(`${API}/pedidos`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(pedido),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al guardar pedido");
  return data;
}

// ── Poblar un <select> ───────────────────────────────────────
export function llenarSelect(selectEl, items, campoTexto, placeholder = "Selecciona...") {
  selectEl.innerHTML = `<option value="">— ${placeholder} —</option>`;
  items.forEach(item => {
    const opt = document.createElement("option");
    opt.value       = item.id;
    opt.textContent = item[campoTexto];
    selectEl.appendChild(opt);
  });
}
