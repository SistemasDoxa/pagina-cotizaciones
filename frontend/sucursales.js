// ============================================================
//  sucursales.js — lógica del mapa de sucursales
// ============================================================
import { initNavbar } from "./doxa.js";

initNavbar();

const map = L.map('map').setView([19.2826, -99.6557], 13);

L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  attribution: 'Esri Satellite View'
}).addTo(map);

L.tileLayer('https://stamen-tiles.a.ssl.fastly.net/toner-labels/{z}/{x}/{y}.png', {
  opacity: 0.7
}).addTo(map);

// Icono personalizado rojo
const iconoDoxa = L.divIcon({
  className: '',
  html: `<div style="
    background:#c0392b;
    width:32px; height:32px;
    border-radius:50% 50% 50% 0;
    transform:rotate(-45deg);
    border:3px solid #fff;
    box-shadow:0 2px 8px rgba(0,0,0,.35);
  "></div>`,
  iconSize:   [32, 32],
  iconAnchor: [16, 32],
  popupAnchor:[0, -36],
});

const ubicaciones = [
  { id: "morelos",  nombre: "Doxa Morelos",   coords: [19.28799,  -99.655315] },
  { id: "villada",  nombre: "Doxa Villada",   coords: [19.287962, -99.658371] },
  { id: "plazamia", nombre: "Doxa Plaza Mia", coords: [19.292569, -99.735500] }
];

// Crear marcadores y guardar referencia por id
const marcadores = {};

ubicaciones.forEach(loc => {
  const marker = L.marker(loc.coords, { icon: iconoDoxa })
    .addTo(map)
    .bindPopup(`<strong style="color:#c0392b">${loc.nombre}</strong>`);
  marcadores[loc.id] = marker;
});

// Volar al pin al hacer click en una card
window.irAlPin = function(id) {
  const marker = marcadores[id];
  if (!marker) return;

  // Resaltar card activa
  document.querySelectorAll('.suc-card').forEach(c => c.classList.remove('activa'));
  document.querySelector(`.suc-card[data-id="${id}"]`)?.classList.add('activa');

  // Scroll suave al mapa
  document.getElementById('map').scrollIntoView({ behavior: 'smooth', block: 'center' });

  // Volar al marcador y abrir popup
  map.flyTo(marker.getLatLng(), 16, { animate: true, duration: 1 });
  marker.openPopup();
};
