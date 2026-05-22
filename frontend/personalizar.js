// ============================================================
//  personalizar.js — editor 3D de uniformes
//  Cada prenda tiene su propio estado independiente:
//  sprites, textos, numeros, logo, color.
// ============================================================

const GLTF_LOADER_URL =
  "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js";
const ORBIT_URL =
  "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js";

function loadScript(url, cb) {
  const s = document.createElement("script");
  s.src = url; s.onload = cb; document.head.appendChild(s);
}

loadScript(GLTF_LOADER_URL, () =>
  loadScript(ORBIT_URL, iniciarApp)
);

// ── Three.js globals ──────────────────────────────────────────
let renderer, scene, camera, controls;
let capturandoVistas = false;  // pausa el loop durante la captura del PDF
const raycaster = new THREE.Raycaster();
const mouse2D   = new THREE.Vector2();

// ── Conjunto actual ───────────────────────────────────────────
let conjuntoTipo = "playera_short";
let prendaActual = "playera";

const MODELOS = {
  playera: "img/3d/playera.glb",
  short:   "img/3d/short.glb"
};

// ── Estado POR PRENDA ─────────────────────────────────────────
// Cada prenda tiene su propio objeto de estado independiente.
const estadoPrenda = {
  playera: {
    modelo:               null,   // THREE.Object3D cargado
    sprites:              [],     // [{ mesh }]
    meshTexto:            null,   // mesh del texto activo
    meshNumero:           null,   // mesh del numero activo
    textoColocado:        false,
    numeroColocado:       false,
    colorHex:             null,   // color aplicado (o null = original)
  },
  short: {
    modelo:               null,
    sprites:              [],
    meshTexto:            null,
    meshNumero:           null,
    textoColocado:        false,
    numeroColocado:       false,
    colorHex:             null,
  },
};

// Estado de interacción (compartido, siempre referido a la prenda activa)
let spriteSeleccionado = null;
let modoColocar        = null;
let pendingData        = null;
let modoMover          = false;
let moviendo           = false;

// ── Acceso rápido al estado activo ────────────────────────────
function estado() { return estadoPrenda[prendaActual]; }

// ── Init ──────────────────────────────────────────────────────
function iniciarApp() {
  const canvas = document.getElementById("threeCanvas");
  const left   = document.getElementById("editorLeft");

  renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true, preserveDrawingBuffer: true
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.outputEncoding = THREE.sRGBEncoding;
  ajustarTamano();

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f0f0);

  camera = new THREE.PerspectiveCamera(40, left.clientWidth / left.clientHeight, 0.01, 100);
  camera.position.set(0, 0.1, 2.2);

  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const dir1 = new THREE.DirectionalLight(0xffffff, 0.9);
  dir1.position.set(2, 4, 3); scene.add(dir1);
  const dir2 = new THREE.DirectionalLight(0xffffff, 0.4);
  dir2.position.set(-2, 1, -2); scene.add(dir2);

  controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping  = true;
  controls.dampingFactor  = 0.08;
  controls.minDistance    = 0.5;
  controls.maxDistance    = 6;

  configurarEditor();

  // Desktop: click simple rota/cierra, doble click abre panel
  canvas.addEventListener("click",     onCanvasClick);
  canvas.addEventListener("dblclick",  onCanvasDblClick);
  canvas.addEventListener("mousemove", onCanvasMouseMove);
  canvas.addEventListener("mouseup",   onCanvasMouseUp);
  window.addEventListener("resize",    ajustarTamano);

  // Desktop: cerrar panel al hacer click fuera (NO en móvil — lo maneja el overlay)
  document.addEventListener("mousedown", e => {
    const pf = document.getElementById("panelFlotante");
    if (pf.style.display === "none") return;
    if (!pf.contains(e.target)) deseleccionar();
  });

  // Móvil: overlay captura todos los toques
  const overlay = document.getElementById("touchOverlay");
  if (overlay) {
    overlay.addEventListener("touchstart", onOverlayTouchStart, { passive: false });
    overlay.addEventListener("touchmove",  onOverlayTouchMove,  { passive: false });
    overlay.addEventListener("touchend",   onOverlayTouchEnd,   { passive: false });
  }

  // Cerrar panel al tocar fuera en móvil — se registra en el panel flotante mismo
  // para no interferir con el overlay (ver _cerrarPanelConTouch al final del archivo)

  (function loop() {
    requestAnimationFrame(loop);
    if (capturandoVistas) return;
    controls.update();
    renderer.render(scene, camera);
  })();

  conectarUI();
}

function ajustarTamano() {
  const left = document.getElementById("editorLeft");
  renderer.setSize(left.clientWidth, left.clientHeight);
  if (camera) {
    camera.aspect = left.clientWidth / left.clientHeight;
    camera.updateProjectionMatrix();
  }
}

// ── Cargar modelo GLB ─────────────────────────────────────────
function cargarModelo(prenda) {
  const est = estadoPrenda[prenda];

  // Si ya está cargado solo ponerlo visible en la escena
  if (est.modelo) {
    scene.add(est.modelo);
    est.sprites.forEach(s => scene.add(s.mesh));
    return;
  }

  const loader = new THREE.GLTFLoader();
  loader.load(
    MODELOS[prenda],
    (gltf) => {
      const m = gltf.scene;
      const box    = new THREE.Box3().setFromObject(m);
      const center = box.getCenter(new THREE.Vector3());
      const size   = box.getSize(new THREE.Vector3());
      const scale  = 1.4 / Math.max(size.x, size.y, size.z);
      m.scale.setScalar(scale);
      m.position.sub(center.multiplyScalar(scale));

      m.userData.meshes = [];
      m.traverse(n => { if (n.isMesh) m.userData.meshes.push(n); });

      // Aplicar color guardado si existe
      if (est.colorHex) aplicarColorAlModelo(m, est.colorHex);

      est.modelo = m;
      scene.add(m);
      est.sprites.forEach(s => scene.add(s.mesh));
    },
    undefined,
    (err) => console.error("Error cargando GLB:", err)
  );
}

// Oculta el modelo y sprites de una prenda sin destruirlos
function ocultarPrenda(prenda) {
  const est = estadoPrenda[prenda];
  if (est.modelo) scene.remove(est.modelo);
  est.sprites.forEach(s => scene.remove(s.mesh));
}

// ── Cambio de prenda ──────────────────────────────────────────
function cambiarPrenda(prenda) {
  if (prenda === prendaActual) return;

  // Guardar estado de interacción de la prenda que se va
  deseleccionar();
  finalizarModoColocar();

  // Ocultar prenda anterior
  ocultarPrenda(prendaActual);

  // Cambiar
  prendaActual = prenda;

  // Mostrar/cargar la nueva
  cargarModelo(prenda);

  // Sincronizar UI de la nueva prenda
  sincronizarUIConPrenda(prenda);

  document.getElementById("btnPlayera").classList.toggle("activo", prenda === "playera");
  document.getElementById("btnShort").classList.toggle("activo",   prenda === "short");
}

// Refleja el estado de la prenda activa en todos los controles del panel
function sincronizarUIConPrenda(prenda) {
  const est = estadoPrenda[prenda];

  // Badges de texto y número
  actualizarBadge("texto",  est.textoColocado);
  actualizarBadge("numero", est.numeroColocado);

  // Indicador de prenda activa (solo en conjunto completo)
  const indEl    = document.getElementById("indicadorPrenda");
  const nombreEl = document.getElementById("nombrePrendaActiva");
  const labelEl  = document.getElementById("prendaLabelTexto");
  if (conjuntoTipo === "playera_short") {
    const nombre = prenda === "playera" ? "👕 Playera" : "🩳 Short";
    if (indEl)    { indEl.style.display = "flex"; }
    if (nombreEl) { nombreEl.textContent = nombre; }
    if (labelEl)  { labelEl.textContent  = "Prenda activa: " + nombre; }
  } else {
    if (indEl) indEl.style.display = "none";
    if (labelEl) labelEl.textContent = "";
  }

  // Restaurar color seleccionado visualmente
  document.querySelectorAll(".color").forEach(div => {
    div.classList.toggle("seleccionado", div.dataset.color === est.colorHex);
  });
}

function zoomCamara(dir) {
  const factor = 1.1; // Factor de zoom (1.1 = 10% de cambio por clic)
  
  if (dir < 0) {
    controls.dollyIn(factor);  // Acercar (Zoom In)
  } else {
    controls.dollyOut(factor); // Alejar (Zoom Out)
  }
  
  // Sincroniza OrbitControls para aplicar la nueva distancia de la cámara
  controls.update();
}

// ── Raycast ───────────────────────────────────────────────────
function raycastModelo(clientX, clientY) {
  const modelo = estado().modelo;
  if (!modelo) return null;
  const left = document.getElementById("editorLeft");
  const rect = left.getBoundingClientRect();
  mouse2D.x =  ((clientX - rect.left) / rect.width)  * 2 - 1;
  mouse2D.y = -((clientY - rect.top)  / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse2D, camera);
  const hits = raycaster.intersectObjects(modelo.userData.meshes || [], true);
  return hits.length ? hits[0] : null;
}

// ── Textura de texto ──────────────────────────────────────────
function canvasTextoTextura(texto, color) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 128;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, 512, 128);
  ctx.font         = "bold 72px Segoe UI, Arial";
  ctx.fillStyle    = color || "#ffffff";
  ctx.strokeStyle  = "rgba(0,0,0,0.7)";
  ctx.lineWidth    = 6;
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  ctx.strokeText(texto, 256, 64);
  ctx.fillText(texto,   256, 64);
  return new THREE.CanvasTexture(c);
}

// ── Crear plano (decal) ───────────────────────────────────────
function crearPlano(tex, anchura, altura, tipo, extraData) {
  const mat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true,
    depthTest: true, depthWrite: false,
    side: THREE.FrontSide, alphaTest: 0.05,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(anchura, altura), mat);
  mesh.userData = { tipo, escalaBase: 1, anchuraBase: anchura, alturaBase: altura, ...extraData };
  return mesh;
}

function crearMeshTexto(texto, color) {
  return crearPlano(canvasTextoTextura(texto, color), 0.35, 0.09, "texto", { texto, color });
}

function crearMeshImagen(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const tex = new THREE.Texture(img);
      tex.needsUpdate = true;
      resolve(crearPlano(tex, 0.18 * (img.width / img.height), 0.18, "logo", {}));
    };
    img.src = url;
  });
}

// ── Orientar plano a la normal ────────────────────────────────
function orientarPlano(mesh, hit) {
  const normal = hit.face.normal.clone()
    .transformDirection(hit.object.matrixWorld).normalize();
  const up = Math.abs(normal.y) < 0.99
    ? new THREE.Vector3(0, 1, 0)
    : new THREE.Vector3(0, 0, 1);
  const tangent   = new THREE.Vector3().crossVectors(up, normal).normalize();
  const bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize();
  mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(tangent, bitangent, normal));
  mesh.position.copy(hit.point).addScaledVector(normal, 0.005);
}

// ── Colocar decal en la prenda activa ─────────────────────────
function colocarSprite(mesh, hit) {
  orientarPlano(mesh, hit);
  mesh.scale.setScalar(1);
  scene.add(mesh);
  estado().sprites.push({ mesh });
}

// ── Eventos del canvas ────────────────────────────────────────
function onCanvasClick(e) {
  if (moviendo) { moviendo = false; return; }

  if (modoColocar) {
    const hit = raycastModelo(e.clientX, e.clientY);
    if (!hit) { mostrarIndicador("⚠ Haz clic sobre la prenda"); return; }
    if (modoColocar === "texto") {
      const mesh = crearMeshTexto(pendingData.texto, pendingData.color);
      mesh.userData.subtipo = pendingData.subtipo || "texto";
      colocarSprite(mesh, hit);
      if (pendingData.subtipo === "numero") {
        estado().numeroColocado = true; actualizarBadge("numero", true);
      } else {
        estado().textoColocado = true;  actualizarBadge("texto",  true);
      }
      finalizarModoColocar();
    } else {
      crearMeshImagen(pendingData.url).then(mesh => {
        colocarSprite(mesh, hit); finalizarModoColocar();
      });
    }
    return;
  }

  // Click simple: solo cierra el panel flotante si se hace click fuera de los sprites
  const left = document.getElementById("editorLeft");
  const rect = left.getBoundingClientRect();
  mouse2D.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
  mouse2D.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse2D, camera);
  const hits = raycaster.intersectObjects(estado().sprites.map(s => s.mesh));
  
  if (!hits.length) {
    deseleccionar(); // Cierra el panel flotante si hacemos click en el fondo
  }
}

// Doble click: abre el panel flotante sobre el sprite
function onCanvasDblClick(e) {
  if (moviendo) return;
  const left = document.getElementById("editorLeft");
  const rect = left.getBoundingClientRect();
  mouse2D.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
  mouse2D.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse2D, camera);
  const hits = raycaster.intersectObjects(estado().sprites.map(s => s.mesh));
  if (hits.length) {
    const clicked = hits[0].object;
    seleccionar(clicked, e.clientX, e.clientY);
  }
}

function onCanvasMouseMove(e) {
  if (!modoMover || !spriteSeleccionado) return;
  moviendo = true;
  const hit = raycastModelo(e.clientX, e.clientY);
  if (hit) {
    const normal = hit.face.normal.clone()
      .transformDirection(hit.object.matrixWorld).normalize();
    spriteSeleccionado.userData.surfaceNormal = normal.clone();
    const up = Math.abs(normal.y) < 0.99
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(0, 0, 1);
    const tangent   = new THREE.Vector3().crossVectors(up, normal).normalize();
    const bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize();
    spriteSeleccionado.quaternion.setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(tangent, bitangent, normal));
    spriteSeleccionado.position.copy(hit.point).addScaledVector(normal, 0.015);
  }
}

function onCanvasMouseUp() {
  if (modoMover) {
    modoMover = false;
    controls.enabled = true;
    document.getElementById("threeCanvas").style.cursor = "grab";
    ocultarIndicador();
  }
}

// ── Touch handlers (móvil) ───────────────────────────────────
// Lógica:
//   - 1 toque normal  → rota el modelo (OrbitControls)
//   - Doble tap sobre texto/número/logo → abre panel flotante
//   - Tap fuera del panel (o fuera de sprites) → cierra panel
//   - Panel abierto + botón ✥ Mover → arrastra el sprite

let _touchStartX = 0, _touchStartY = 0, _touchStartTime = 0, _touchMoved = false;
let _lastTapTime = 0, _lastTapX = 0, _lastTapY = 0;

// Reenvía el evento al canvas para que OrbitControls lo reciba
function _pasarTouchAOrbit(e, tipo) {
  try {
    document.getElementById("threeCanvas").dispatchEvent(new TouchEvent(tipo, {
      bubbles: true, cancelable: true,
      touches: e.touches, targetTouches: e.targetTouches, changedTouches: e.changedTouches,
    }));
  } catch(_) {}
}

// Raycast rápido desde coordenadas de toque
function _raycastSprites(clientX, clientY) {
  const left = document.getElementById("editorLeft");
  const rect = left.getBoundingClientRect();
  mouse2D.x =  ((clientX - rect.left) / rect.width)  * 2 - 1;
  mouse2D.y = -((clientY - rect.top)  / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse2D, camera);
  return raycaster.intersectObjects(estado().sprites.map(s => s.mesh));
}

// Devuelve true si (cx,cy) está sobre un elemento de UI que el overlay
// NO debe interceptar: panel flotante, botones de zoom, barra Playera/Short
function _tocaElementoUI(cx, cy) {
  const pf = document.getElementById("panelFlotante");
  if (pf && pf.style.display !== "none") {
    const r = pf.getBoundingClientRect();
    if (cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) return true;
  }
  for (const sel of [".zoom-controls", ".viewer-bottom-bar"]) {
    const el = document.querySelector(sel);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) return true;
  }
  return false;
}

function onOverlayTouchStart(e) {
  if (e.touches.length !== 1) return;
  const t = e.touches[0];
  // Si el toque es sobre UI (panel, zoom, barra) → no interceptar
  if (_tocaElementoUI(t.clientX, t.clientY)) return;
  
  _touchStartX    = t.clientX;
  _touchStartY    = t.clientY;
  _touchStartTime = Date.now();
  _touchMoved     = false;

  // Evita el comportamiento por defecto y los eventos fantasma de click/mousedown
  e.preventDefault();

  if (modoMover && spriteSeleccionado) {
    e.stopPropagation();
  } else {
    _pasarTouchAOrbit(e, "touchstart");
  }
}

function onOverlayTouchMove(e) {
  if (e.touches.length !== 1) return;
  const t = e.touches[0];
  if (_tocaElementoUI(t.clientX, t.clientY)) return;
  
  if (Math.abs(t.clientX - _touchStartX) > 8 ||
      Math.abs(t.clientY - _touchStartY) > 8) _touchMoved = true;

  // Evita que la pantalla haga scroll vertical al arrastrar el dedo en el canvas
  e.preventDefault();

  if (modoMover && spriteSeleccionado) {
    e.stopPropagation();
    const hit = raycastModelo(t.clientX, t.clientY);
    if (hit) {
      const normal = hit.face.normal.clone()
        .transformDirection(hit.object.matrixWorld).normalize();
      spriteSeleccionado.userData.surfaceNormal = normal.clone();
      const up = Math.abs(normal.y) < 0.99
        ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
      const tangent   = new THREE.Vector3().crossVectors(up, normal).normalize();
      const bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize();
      spriteSeleccionado.quaternion.setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(tangent, bitangent, normal));
      spriteSeleccionado.position.copy(hit.point).addScaledVector(normal, 0.015);
    }
  } else {
    _pasarTouchAOrbit(e, "touchmove");
  }
}

function onOverlayTouchEnd(e) {
  if (e.changedTouches.length !== 1) return;
  const t = e.changedTouches[0];

  // Si el toque terminó sobre UI → no interceptar, el elemento recibe el tap
  if (_tocaElementoUI(t.clientX, t.clientY)) return;

  // Evita que el navegador móvil dispare el evento mousedown/click emulado
  e.preventDefault();

  // Fin de arrastre de sprite
  if (modoMover) {
    modoMover = false;
    controls.enabled = true;
    ocultarIndicador();
    _pasarTouchAOrbit(e, "touchend");
    return;
  }

  _pasarTouchAOrbit(e, "touchend");

  const duracion = Date.now() - _touchStartTime;
  if (_touchMoved || duracion > 350) return;

  const ahora      = Date.now();
  const esDobleTap = (ahora - _lastTapTime) < 300 &&
                     Math.abs(t.clientX - _lastTapX) < 40 &&
                     Math.abs(t.clientY - _lastTapY) < 40;
  _lastTapTime = ahora;
  _lastTapX    = t.clientX;
  _lastTapY    = t.clientY;

  const pf   = document.getElementById("panelFlotante");
  const hits = _raycastSprites(t.clientX, t.clientY);

  if (esDobleTap && hits.length) {
    // Doble tap sobre sprite → abrir panel flotante
    seleccionar(hits[0].object, t.clientX, t.clientY);
  } else if (pf.style.display !== "none") {
    // Tap fuera del panel → cerrarlo
    deseleccionar();
  }
}


function seleccionar(sprite, cx, cy) {
  spriteSeleccionado = sprite;
  document.getElementById("pfSlider").value = sprite.userData.escalaBase || 1;
  mostrarPanel(cx, cy);
}
function deseleccionar() {
  spriteSeleccionado = null;
  ocultarPanel();
}

// ── Panel flotante ────────────────────────────────────────────
// Posiciona el panel al lado del sprite proyectando su centro 3D a pantalla.
// Se adapta para no salirse del visor en ningún tamaño de pantalla.
function _posicionarPanel(pf, rect, sx, sy) {
  const pw     = parseFloat(pf.style.width) || pf.offsetWidth || 150;
  const ph     = 115; // altura estimada (3 elementos)
  const margen = 10;

  // Derecha del sprite; si no cabe → izquierda; si tampoco → centrar
  let x = sx + 16;
  let y = sy - ph / 2;
  if (x + pw > rect.width  - margen) x = sx - pw - 16;
  if (x      < margen)               x = Math.max(margen, (rect.width - pw) / 2);
  y = Math.max(margen, Math.min(y, rect.height - ph - margen));

  if (window.innerWidth <= 768) {
    pf.style.left      = (rect.left + x) + "px";
    pf.style.top       = (rect.top  + y) + "px";
    pf.style.transform = "none";
  } else {
    pf.style.left      = x + "px";
    pf.style.top       = y + "px";
    pf.style.transform = "none";
  }
}

function mostrarPanel(cx, cy) {
  const pf   = document.getElementById("panelFlotante");
  const left = document.getElementById("editorLeft");
  const rect = left.getBoundingClientRect();
  pf.style.display = "flex";
  // Tamaño proporcional al visor
  const isMobile = window.innerWidth <= 768;
  const pw = isMobile
    ? Math.min(155, Math.max(110, window.innerWidth * 0.35))
    : Math.min(175, Math.max(130, rect.width * 0.22));
  pf.style.width = pw + "px";
  // Posicionar desde el centro 3D del sprite
  if (spriteSeleccionado) {
    const pos3d = spriteSeleccionado.position.clone().project(camera);
    const sx = (pos3d.x + 1) / 2 * rect.width;
    const sy = (-pos3d.y + 1) / 2 * rect.height;
    _posicionarPanel(pf, rect, sx, sy);
  } else {
    _posicionarPanel(pf, rect, cx - rect.left, cy - rect.top);
  }
  // Desactivar touch-action del overlay para que el panel reciba toques
  const ov = document.getElementById("touchOverlay");
  if (ov) ov.style.touchAction = "auto";
}

function ocultarPanel() {
  document.getElementById("panelFlotante").style.display = "none";
  // Restaurar touch-action del overlay
  const ov = document.getElementById("touchOverlay");
  if (ov) ov.style.touchAction = "none";
}

function actualizarPosPanel() {
  if (!spriteSeleccionado) return;
  const pf = document.getElementById("panelFlotante");
  if (pf.style.display === "none") return;
  const pos3d = spriteSeleccionado.position.clone().project(camera);
  const left  = document.getElementById("editorLeft");
  const rect  = left.getBoundingClientRect();
  const sx = (pos3d.x + 1) / 2 * rect.width;
  const sy = (-pos3d.y + 1) / 2 * rect.height;
  _posicionarPanel(pf, rect, sx, sy);
}

// ── Indicador ─────────────────────────────────────────────────
function mostrarIndicador(msg) {
  const ind = document.getElementById("indicador");
  ind.textContent = msg; ind.style.display = "block";
}
function ocultarIndicador() {
  document.getElementById("indicador").style.display = "none";
}

// ── Finalizar modo colocar ────────────────────────────────────
function finalizarModoColocar() {
  modoColocar = null; pendingData = null;
  controls.enabled = true;
  document.getElementById("threeCanvas").style.cursor = "grab";
  ocultarIndicador();
}

// ── Panel flotante — acciones ─────────────────────────────────
function activarModoMover() {
  if (!spriteSeleccionado) return;
  modoMover = true;
  controls.enabled = false;
  document.getElementById("threeCanvas").style.cursor = "grabbing";
  mostrarIndicador("🖐 Arrastra sobre la prenda — suelta para fijar");
  ocultarPanel();
}
// click funciona en desktop y móvil sin conflicto con touch-action
document.getElementById("pfBtnMover").addEventListener("click", activarModoMover);

document.getElementById("pfSlider").addEventListener("input", () => {
  if (!spriteSeleccionado) return;
  const escala = parseFloat(document.getElementById("pfSlider").value);
  spriteSeleccionado.userData.escalaBase = escala;
  spriteSeleccionado.scale.setScalar(escala);
});

document.getElementById("pfBtnEliminar").addEventListener("click", () => {
  if (!spriteSeleccionado) return;
  const subtipo = spriteSeleccionado.userData.subtipo;
  const est = estado();
  scene.remove(spriteSeleccionado);
  est.sprites = est.sprites.filter(s => s.mesh !== spriteSeleccionado);
  if (subtipo === "numero") { est.numeroColocado = false; actualizarBadge("numero", false); }
  else if (subtipo === "texto") { est.textoColocado  = false; actualizarBadge("texto",  false); }
  deseleccionar();
});

// ── Color de prenda ───────────────────────────────────────────
function aplicarColorAlModelo(modelo, hex) {
  const col = new THREE.Color(hex);
  (modelo.userData.meshes || []).forEach(mesh => {
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach(mat => { mat.color.set(col); mat.map = null; mat.needsUpdate = true; });
  });
}

document.querySelectorAll(".color").forEach(div => {
  div.addEventListener("click", () => {
    document.querySelectorAll(".color").forEach(c => c.classList.remove("seleccionado"));
    div.classList.add("seleccionado");
    const hex = div.dataset.color;
    // Guardar el color para esta prenda
    estado().colorHex = hex;
    if (estado().modelo) aplicarColorAlModelo(estado().modelo, hex);
  });
});

// ── Conectar UI ───────────────────────────────────────────────
function conectarUI() {
  const btn = document.getElementById("menuPersonalizacion");
  const sub = document.getElementById("submenuPersonalizacion");
  btn.addEventListener("click", e => { e.preventDefault(); sub.classList.toggle("show"); });
  document.addEventListener("click", e => {
    if (!btn.contains(e.target) && !sub.contains(e.target)) sub.classList.remove("show");
  });
  document.addEventListener("mousedown", e => {
    if (!e.target.closest("#panelFlotante") && !e.target.closest("#threeCanvas")) {
      deseleccionar();
    }
  });
}

// ── Badges ────────────────────────────────────────────────────
function actualizarBadge(tipo, colocado) {
  const badge = document.getElementById(tipo === "texto" ? "estadoTexto" : "estadoNumero");
  const btnEl = document.getElementById(tipo === "texto" ? "btnAgregarTexto" : "btnAgregarNumero");
  if (!badge || !btnEl) return;
  if (colocado) {
    badge.textContent = "\u25CF En uso"; badge.className = "estado-badge en-uso";
    btnEl.disabled = true; btnEl.style.opacity = "0.45"; btnEl.style.cursor = "not-allowed";
  } else {
    badge.textContent = "\u25CF Disponible"; badge.className = "estado-badge disponible";
    btnEl.disabled = false; btnEl.style.opacity = ""; btnEl.style.cursor = "";
  }
}

// ── Tabs del panel ────────────────────────────────────────────
const editorRight = document.querySelector(".editor-right");

document.querySelectorAll(".panel-tabs .tab").forEach(btn => {
  btn.addEventListener("click", () => {
    const tabId = btn.dataset.tab;
    document.querySelectorAll(".panel-tabs .tab").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("tab-" + tabId).classList.add("active");
    if (tabId === "texto")  onEntrarTabTexto();
    if (tabId === "numero") onEntrarTabNumero();
  });
});

document.getElementById("threeCanvas").addEventListener("click", () => {
  // En móvil el panel es fijo, no se colapsa al tocar el canvas
});

// ── Auto-colocacion: posiciones default (raycast frontal) ─────
const POS_DEFAULT_TEXTO  = { x: 0,    y: 0.12 };
const POS_DEFAULT_NUMERO = { x: 0,    y: -0.05 };

function colocarEnPosDefault(mesh, pos) {
  const origen = new THREE.Vector3(pos.x, pos.y, 2);
  const dir    = new THREE.Vector3(0, 0, -1);
  const rc     = new THREE.Raycaster(origen, dir);
  const modelo = estado().modelo;
  if (!modelo) return;
  const hits = rc.intersectObjects(modelo.userData.meshes || [], true);
  if (hits.length) {
    orientarPlano(mesh, hits[0]);
  } else {
    mesh.position.set(pos.x, pos.y, 0.5);
    mesh.lookAt(camera.position);
  }
  mesh.scale.setScalar(1);
  scene.add(mesh);
  estado().sprites.push({ mesh });
}

function onEntrarTabTexto() {
  const est = estado();
  if (est.meshTexto) { sincronizarUITexto(); return; }
  const texto = document.getElementById("textoInput2").value.trim();
  if (texto) colocarTextoAuto();
}

function onEntrarTabNumero() {
  const est = estado();
  if (est.meshNumero) { sincronizarUINumero(); return; }
  const num = document.getElementById("numeroInput").value.trim();
  if (num) colocarNumeroAuto();
}

function colocarTextoAuto() {
  const est   = estado();
  const texto = document.getElementById("textoInput2").value.trim();
  const color = colorTextoActual();
  if (!texto) return;
  if (est.meshTexto) {
    scene.remove(est.meshTexto);
    est.sprites = est.sprites.filter(s => s.mesh !== est.meshTexto);
    est.meshTexto = null;
  }
  if (!est.modelo) { setTimeout(colocarTextoAuto, 150); return; }
  const mesh = crearMeshTexto(texto, color);
  mesh.userData.subtipo = "texto";
  colocarEnPosDefault(mesh, POS_DEFAULT_TEXTO);
  est.meshTexto     = mesh;
  est.textoColocado = true;
  sincronizarUITexto();
}

function colocarNumeroAuto() {
  const est   = estado();
  const num   = document.getElementById("numeroInput").value.trim();
  const color = colorNumeroActual();
  if (!num || !/^\d{1,2}$/.test(num)) return;
  if (est.meshNumero) {
    scene.remove(est.meshNumero);
    est.sprites = est.sprites.filter(s => s.mesh !== est.meshNumero);
    est.meshNumero = null;
  }
  if (!est.modelo) { setTimeout(colocarNumeroAuto, 150); return; }
  const mesh = crearMeshTexto(num, color);
  mesh.userData.subtipo = "numero";
  colocarEnPosDefault(mesh, POS_DEFAULT_NUMERO);
  est.meshNumero     = mesh;
  est.numeroColocado = true;
  sincronizarUINumero();
}

function actualizarTexturaMesh(mesh, texto, color) {
  const tex = canvasTextoTextura(texto, color);
  mesh.material.map = tex;
  mesh.material.needsUpdate = true;
}

function colorTextoActual() {
  const sw = document.querySelector("#paletteTexto .swatch.seleccionado");
  return sw ? sw.dataset.color : "#FFFFFF";
}
function colorNumeroActual() {
  const sw = document.querySelector("#paletteNumero .swatch.seleccionado");
  return sw ? sw.dataset.color : "#FFFFFF";
}

function sincronizarUITexto() {
  const est  = estado();
  const acc  = document.getElementById("texto-acciones");
  const help = document.getElementById("textoHelpText");
  if (acc) {
    acc.style.display = est.meshTexto ? "flex" : "none";
    if (est.meshTexto) acc.style.flexDirection = "column";
  }
  if (help) help.textContent = est.meshTexto
    ? "Edita el texto o color — se actualiza en tiempo real"
    : "Escribe un texto — aparecerá en la prenda automáticamente";
}
function sincronizarUINumero() {
  const est  = estado();
  const acc  = document.getElementById("numero-acciones");
  const help = document.getElementById("numeroHelpText");
  if (acc) {
    acc.style.display = est.meshNumero ? "flex" : "none";
    if (est.meshNumero) acc.style.flexDirection = "column";
  }
  if (help) help.textContent = est.meshNumero
    ? "Edita el número o color — se actualiza en tiempo real"
    : "Escribe un número — aparecerá en la prenda automáticamente";
}

document.getElementById("textoInput2").addEventListener("input", () => {
  const texto = document.getElementById("textoInput2").value;
  document.getElementById("charCount").textContent = texto.length;
  const est = estado();
  const tabActiva = document.querySelector(".tab[data-tab='texto']")?.classList.contains("active");
  if (!tabActiva) return;
  if (!texto.trim()) {
    if (est.meshTexto) {
      scene.remove(est.meshTexto);
      est.sprites = est.sprites.filter(s => s.mesh !== est.meshTexto);
      est.meshTexto = null; est.textoColocado = false;
      sincronizarUITexto();
    }
    return;
  }
  if (est.meshTexto) actualizarTexturaMesh(est.meshTexto, texto.trim(), colorTextoActual());
  else colocarTextoAuto();
});

document.getElementById("numeroInput").addEventListener("input", () => {
  const el = document.getElementById("numeroInput");
  el.value = el.value.replace(/\D/g, "").slice(0, 2);
  const num = el.value.trim();
  const est = estado();
  const tabActiva = document.querySelector(".tab[data-tab='numero']")?.classList.contains("active");
  if (!tabActiva) return;
  if (!num) {
    if (est.meshNumero) {
      scene.remove(est.meshNumero);
      est.sprites = est.sprites.filter(s => s.mesh !== est.meshNumero);
      est.meshNumero = null; est.numeroColocado = false;
      sincronizarUINumero();
    }
    return;
  }
  if (est.meshNumero) actualizarTexturaMesh(est.meshNumero, num, colorNumeroActual());
  else colocarNumeroAuto();
});

document.getElementById("paletteTexto").addEventListener("click", (e) => {
  const sw = e.target.closest(".swatch");
  if (!sw) return;
  document.querySelectorAll("#paletteTexto .swatch").forEach(s => s.classList.remove("seleccionado"));
  sw.classList.add("seleccionado");
  const est = estado();
  if (est.meshTexto) actualizarTexturaMesh(est.meshTexto, document.getElementById("textoInput2").value.trim(), sw.dataset.color);
});

document.getElementById("paletteNumero").addEventListener("click", (e) => {
  const sw = e.target.closest(".swatch");
  if (!sw) return;
  document.querySelectorAll("#paletteNumero .swatch").forEach(s => s.classList.remove("seleccionado"));
  sw.classList.add("seleccionado");
  const est = estado();
  if (est.meshNumero) actualizarTexturaMesh(est.meshNumero, document.getElementById("numeroInput").value.trim(), sw.dataset.color);
});

document.getElementById("btnMoverTexto")?.addEventListener("click", () => {
  const est = estado();
  if (!est.meshTexto) return;
  spriteSeleccionado = est.meshTexto;
  modoMover = true; controls.enabled = false;
  document.getElementById("threeCanvas").style.cursor = "crosshair";
  mostrarIndicador("👆 Toca la prenda para reubicar el texto");
  // panel siempre visible en móvil
});

document.getElementById("btnMoverNumero")?.addEventListener("click", () => {
  const est = estado();
  if (!est.meshNumero) return;
  spriteSeleccionado = est.meshNumero;
  modoMover = true; controls.enabled = false;
  document.getElementById("threeCanvas").style.cursor = "crosshair";
  mostrarIndicador("👆 Toca la prenda para reubicar el número");
  // panel siempre visible en móvil
});

document.getElementById("btnEliminarTexto")?.addEventListener("click", () => {
  const est = estado();
  if (!est.meshTexto) return;
  scene.remove(est.meshTexto);
  est.sprites = est.sprites.filter(s => s.mesh !== est.meshTexto);
  est.meshTexto = null; est.textoColocado = false;
  document.getElementById("textoInput2").value = "";
  document.getElementById("charCount").textContent = "0";
  sincronizarUITexto();
});

document.getElementById("btnEliminarNumero")?.addEventListener("click", () => {
  const est = estado();
  if (!est.meshNumero) return;
  scene.remove(est.meshNumero);
  est.sprites = est.sprites.filter(s => s.mesh !== est.meshNumero);
  est.meshNumero = null; est.numeroColocado = false;
  document.getElementById("numeroInput").value = "";
  sincronizarUINumero();
});

// ── Tab LOGO ──────────────────────────────────────────────────
document.getElementById("logoInput2").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const base64Url = ev.target.result;
    sessionStorage.setItem("doxa_logo", base64Url);
    if (window.innerWidth <= 768) {
      // En móvil: colocar logo automáticamente en posición frontal
      crearMeshImagen(base64Url).then(mesh => {
        mesh.userData.subtipo = "logo";
        if (!estado().modelo) { setTimeout(() => colocarEnPosDefault(mesh, { x: 0.15, y: 0.05 }), 150); }
        else { colocarEnPosDefault(mesh, { x: 0.15, y: 0.05 }); }
        // panel siempre visible en móvil
      });
    } else {
      // En desktop: modo clic para posicionar manualmente
      modoColocar = "logo"; pendingData = { url: base64Url };
      controls.enabled = false;
      document.getElementById("threeCanvas").style.cursor = "crosshair";
      mostrarIndicador("👆 Haz clic en la prenda para posicionar la imagen");
    }
  };
  reader.readAsDataURL(file);
});

// ── Cargar resumen del conjunto ───────────────────────────────
(function cargarResumen() {
  const btnSig = document.getElementById("btnSiguiente");
  const aviso  = document.getElementById("avisoConjunto");
  try {
    const raw = sessionStorage.getItem("doxa_conjunto");
    if (!raw) { if (aviso) aviso.style.display = "block"; return; }
    const datos = JSON.parse(raw);
    const elNombre = document.getElementById("summaryNombre");
    const elPrecio = document.getElementById("summaryPrecio");
    if (elNombre && datos.nombre) elNombre.textContent = datos.nombre;
    if (elPrecio && datos.precio) elPrecio.textContent = "$" + parseFloat(datos.precio).toFixed(2);
    if (datos.conjunto) conjuntoTipo = datos.conjunto;
    if (btnSig) btnSig.disabled = false;
  } catch(e) {
    console.warn("No hay datos de conjunto guardados.");
    if (aviso) aviso.style.display = "block";
  }
})();

// ── Configurar botones según tipo de conjunto ─────────────────
function configurarEditor() {
  const btnPlayera = document.getElementById("btnPlayera");
  const btnShort   = document.getElementById("btnShort");
  const bar        = document.getElementById("viewerBottomBar");

  if (conjuntoTipo === "playera") {
    btnShort.style.display = "none"; bar.style.display = "none";
    prendaActual = "playera"; btnPlayera.classList.add("activo");
    cargarModelo("playera");
  } else if (conjuntoTipo === "short") {
    btnPlayera.style.display = "none"; bar.style.display = "none";
    prendaActual = "short"; btnShort.classList.add("activo");
    cargarModelo("short");
  } else {
    // Conjunto completo (playera_short o playera_short_calceta): precargar ambas prendas
    btnPlayera.style.display = ""; btnShort.style.display = ""; bar.style.display = "";
    prendaActual = "playera";
    btnPlayera.classList.add("activo"); btnShort.classList.remove("activo");
    cargarModelo("playera");
    // Precargar short en segundo plano (queda oculto)
    cargarModeloEnSegundoPlano("short");
  }
  // Sincronizar panel con la prenda inicial
  sincronizarUIConPrenda(prendaActual);
}

// Carga un modelo sin mostrarlo en la escena (para tenerlo listo)
function cargarModeloEnSegundoPlano(prenda) {
  const est = estadoPrenda[prenda];
  if (est.modelo) return;
  const loader = new THREE.GLTFLoader();
  loader.load(
    MODELOS[prenda],
    (gltf) => {
      const m = gltf.scene;
      const box    = new THREE.Box3().setFromObject(m);
      const center = box.getCenter(new THREE.Vector3());
      const size   = box.getSize(new THREE.Vector3());
      const scale  = 1.4 / Math.max(size.x, size.y, size.z);
      m.scale.setScalar(scale);
      m.position.sub(center.multiplyScalar(scale));
      m.userData.meshes = [];
      m.traverse(n => { if (n.isMesh) m.userData.meshes.push(n); });
      if (est.colorHex) aplicarColorAlModelo(m, est.colorHex);
      est.modelo = m;
      // NO se agrega a la escena todavía
    },
    undefined,
    (err) => console.error("Error precargando GLB:", err)
  );
}

// ── Captura de vistas ─────────────────────────────────────────
async function capturarVistasPrenda(prenda) {
  // Pausar el loop de animación para tener control total del renderer
  capturandoVistas = true;

  const posOrig    = camera.position.clone();
  const targetOrig = controls.target.clone();

  // Calcular distancia óptima para encuadrar la prenda
  let distanciaCaptura = 2.2;
  const box = new THREE.Box3();
  // Usar la prenda que se pasa explícitamente, o la activa como fallback
  const nombrePrenda = prenda || prendaActual;
  const modeloActivo = estadoPrenda[nombrePrenda] && estadoPrenda[nombrePrenda].modelo;
  if (modeloActivo) {
    box.setFromObject(modeloActivo);
  } else {
    scene.traverse(obj => { if (obj.isMesh) box.expandByObject(obj); });
  }
  if (!box.isEmpty()) {
    const size   = box.getSize(new THREE.Vector3());
    const radio  = Math.max(size.x, size.y, size.z) * 0.5;
    const fovRad = (camera.fov * Math.PI) / 180 / 2;
    distanciaCaptura = (radio / Math.tan(fovRad)) / 0.90;
    if (camera.aspect < 1) distanciaCaptura /= camera.aspect;
  }

  const angulos = [
    { nombre: "Frente",    rotY: 0 },
    { nombre: "Trasera",   rotY: Math.PI },
    { nombre: "Izquierda", rotY:  Math.PI / 2 },
    { nombre: "Derecha",   rotY: -Math.PI / 2 }
  ];
  const vistas = {};

  for (const { nombre, rotY } of angulos) {
    camera.position.set(
      Math.sin(rotY) * distanciaCaptura,
      0,
      Math.cos(rotY) * distanciaCaptura
    );
    controls.target.set(0, 0, 0);
    controls.update();
    // Esperar 2 frames para que la GPU procese el cambio de cámara
    await new Promise(r => requestAnimationFrame(r));
    await new Promise(r => requestAnimationFrame(r));
    // Render explícito y captura
    renderer.render(scene, camera);
    vistas[nombre] = renderer.domElement.toDataURL("image/jpeg", 0.92);

  }

  // Restaurar cámara y reanudar loop
  camera.position.copy(posOrig);
  controls.target.copy(targetOrig);
  controls.update();
  renderer.render(scene, camera);
  capturandoVistas = false;

  return vistas;
}

function esperarModelo(prenda) {
  return new Promise((resolve) => {
    const check = () => estadoPrenda[prenda].modelo ? resolve() : setTimeout(check, 80);
    check();
  });
}

// Muestra la prenda en la escena temporalmente para capturarla
async function mostrarYCapturar(prenda) {
  // Ocultar lo que hay ahora
  ocultarPrenda(prendaActual);
  // Mostrar la prenda objetivo
  const est = estadoPrenda[prenda];
  scene.add(est.modelo);
  est.sprites.forEach(s => scene.add(s.mesh));

  // Esperar suficientes frames para que WebGL procese texturas y geometría
  for (let i = 0; i < 10; i++) {
    renderer.render(scene, camera);
    await new Promise(r => requestAnimationFrame(r));
  }

  // Pasar el nombre de la prenda explícitamente para el bounding box correcto
  const vistas = await capturarVistasPrenda(prenda);

  // Ocultar de nuevo
  scene.remove(est.modelo);
  est.sprites.forEach(s => scene.remove(s.mesh));
  return vistas;
}

async function capturarTodasLasVistas() {
  const resultado = {};
  const esConjunto = conjuntoTipo === "playera_short" || conjuntoTipo === "playera_short_calceta";

  // Helper: limpia la escena de ambas prendas y pone solo la pedida
  async function prepararEscena(prenda) {
    // Quitar ambas prendas de la escena
    ["playera", "short"].forEach(p => {
      const e = estadoPrenda[p];
      if (e.modelo) {
        scene.remove(e.modelo);
        e.sprites.forEach(s => scene.remove(s.mesh));
      }
    });
    // Poner solo la que queremos capturar
    const est = estadoPrenda[prenda];
    scene.add(est.modelo);
    est.sprites.forEach(s => scene.add(s.mesh));
    // Esperar que WebGL procese texturas
    for (let i = 0; i < 12; i++) {
      renderer.render(scene, camera);
      await new Promise(r => requestAnimationFrame(r));
    }
  }

  if (conjuntoTipo === "playera" || esConjunto) {
    await esperarModelo("playera");
    await prepararEscena("playera");
    resultado.playera = await capturarVistasPrenda("playera");
  }

  if (conjuntoTipo === "short" || esConjunto) {
    await esperarModelo("short");
    await prepararEscena("short");
    resultado.short = await capturarVistasPrenda("short");
  }

  // Restaurar la prenda activa en pantalla
  ["playera", "short"].forEach(p => {
    const e = estadoPrenda[p];
    if (e.modelo) {
      scene.remove(e.modelo);
      e.sprites.forEach(s => scene.remove(s.mesh));
    }
  });
  const estAct = estadoPrenda[prendaActual];
  if (estAct.modelo) {
    scene.add(estAct.modelo);
    estAct.sprites.forEach(s => scene.add(s.mesh));
  }

  return resultado;
}

async function irASiguiente() {
  if (!sessionStorage.getItem("doxa_conjunto")) {
    alert("⚠ Debes elegir un conjunto desde el catálogo antes de continuar.");
    return;
  }
  const btn = document.getElementById("btnSiguiente");
  btn.disabled = true; btn.textContent = "Capturando vistas…";
  try {
    const vistas = await capturarTodasLasVistas();
    sessionStorage.setItem("doxa_vistas", JSON.stringify({ tipo: conjuntoTipo, prendas: vistas }));
  } catch(e) {
    console.error("[Doxa] Error capturando vistas:", e);
  }
  window.location.href = "cotizar.html";
}

// ── Exponer para botones inline del HTML ──────────────────────
window.zoomCamara    = zoomCamara;
window.cambiarPrenda = cambiarPrenda;
window.irASiguiente  = irASiguiente;

