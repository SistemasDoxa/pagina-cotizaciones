// ============================================================
//  doxa.js  — helpers compartidos: navbar, footer, Firebase
// ============================================================

import { db } from "./firebase.js";
import {
  collection, getDocs, query, where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Navbar dropdown ──────────────────────────────────────────
export function initNavbar() {
  const btn = document.getElementById("menuPersonalizacion");
  const sub = document.getElementById("submenuPersonalizacion");
  if (!btn || !sub) return;
  btn.addEventListener("click", e => { e.preventDefault(); sub.classList.toggle("show"); });
  document.addEventListener("click", e => {
    if (!btn.contains(e.target) && !sub.contains(e.target))
      sub.classList.remove("show");
  });
}

// ── Catálogos desde Firestore ────────────────────────────────
export async function getCatalogo(coleccion) {
  const snap = await getDocs(collection(db, coleccion));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Consulta de precio ───────────────────────────────────────
export async function getPrecio({ conjunto, talla, tela, trabajo, deporte }) {
  const docId = `${conjunto}_${talla}_${tela}_${trabajo}_${deporte}`;
  const snap  = await getDocs(
    query(collection(db, "precios"),
      where("conjunto_id", "==", conjunto),
      where("talla",       "==", talla),
      where("tela_id",     "==", tela),
      where("trabajo_id",  "==", trabajo),
      where("deporte_id",  "==", deporte)
    )
  );
  if (snap.empty) return null;
  return snap.docs[0].data();
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
