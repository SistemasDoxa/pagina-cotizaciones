# Doxa Deportes — Arquitectura Frontend / Backend

## ¿Por qué este cambio?

Antes el proyecto tenía las credenciales de Firebase directamente en
`firebase.js`, visible para cualquiera que abriera las DevTools.

Ahora:
- **Backend (Node.js/Express)** guarda las credenciales en `.env`
  y es el único que habla con Firebase.
- **Frontend** sólo hace `fetch()` a `/api/...` — sin claves expuestas.

---

## Estructura

```
doxa-project/
├── backend/
│   ├── server.js          ← Express + Firebase Admin
│   ├── package.json
│   ├── .env               ← ⚠️  NO subir a Git (en .gitignore)
│   └── .env.example       ← Plantilla vacía (sí se sube)
├── frontend/
│   ├── index.html
│   ├── soccer.html
│   ├── basquetbol.html
│   ├── voleibol.html
│   ├── personalizar.html
│   ├── cotizar.html
│   ├── doxa.js            ← Usa fetch() en lugar de Firebase SDK
│   ├── modelos.js
│   ├── styles.css
│   └── img/
└── .gitignore
```

---

## Instalación y arranque

### 1. Configurar credenciales

```bash
cd backend
cp .env.example .env
```

Edita `.env` y agrega tus credenciales de Firebase.

**Opción A — Service Account (recomendado para producción):**
1. Ve a Firebase Console → Configuración del proyecto → Cuentas de servicio
2. Genera una nueva clave privada → descarga el JSON
3. Guárdalo como `backend/serviceAccountKey.json`
4. En `server.js`, reemplaza el bloque `credential.cert({...})` por:
   ```js
   credential: admin.credential.cert(
     require("./serviceAccountKey.json")
   )
   ```

**Opción B — Variables de entorno individuales (desarrollo):**
Rellena `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` en `.env`.

### 2. Instalar dependencias

```bash
cd backend
npm install
```

### 3. Arrancar el servidor

```bash
npm start
# → http://localhost:3001
```

El servidor sirve el frontend estático **y** expone los endpoints `/api/`.

---

## Endpoints API

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/catalogo/:coleccion` | Obtiene todos los docs de una colección |
| POST | `/api/precio` | Consulta precio según filtros |
| POST | `/api/pedidos` | Guarda un nuevo pedido |

---

## Despliegue

- **Railway / Render / Fly.io**: sube sólo la carpeta `backend/`
  y define las variables de entorno en el panel del servicio.
- **VPS**: `node server.js` o usa `pm2 start server.js`.
- El frontend se sirve automáticamente como archivos estáticos desde Express.
