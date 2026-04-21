// ============================================================
//  modelos.js  — acordeón de categorías en páginas de deporte
// ============================================================
export function initModelos() {
  document.querySelectorAll(".model-trigger").forEach(card => {
    card.addEventListener("click", () => {
      const target = document.getElementById(card.dataset.model);
      if (!target) return;

      const estaAbierto = target.classList.contains("activo");

      // Cerrar todos
      document.querySelectorAll(".modelos").forEach(m => m.classList.remove("activo"));
      document.querySelectorAll(".model-trigger").forEach(c => c.classList.remove("activo"));

      // Abrir el seleccionado si estaba cerrado
      if (!estaAbierto) {
        target.classList.add("activo");
        card.classList.add("activo");
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });
}
