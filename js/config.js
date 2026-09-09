/* Configuración del portal C4V — editable sin tocar el código.
   Central de Postventa · A3 (plataforma v2: acceso por teléfono + agente de voz). */

window.C4V_CONFIG = {

  /* ---------- CeVi · asistente de la máquina (chat + voz) ----------
     Backend propio en Railway (repo cevi-backend): Claude Haiku con el cerebro de
     CeVi + voz es-MX Dalia (Edge TTS, gratis) + creación de tickets en Odoo.
     Se eligió sobre ElevenLabs porque ya está en producción, la voz SÍ es
     latinoamericana y no depende de un plan de pago. Vacío = botón oculto.      */
  ceviApi: 'https://cevi-backend-general.up.railway.app',
  ceviVoz: true,          // leer en voz alta las respuestas de CeVi

  /* ---------- Agente de voz alternativo (ElevenLabs) — NO activo ----------
     Cuando el agente esté creado (actividad A4), pega aquí su Agent ID.
     Con el ID puesto, el portal carga el widget de voz automáticamente.
     Mientras esté vacío, el botón "Habla con CeVi" explica que aún no está
     disponible y ofrece WhatsApp (nunca finge que funciona).
     Se obtiene en: elevenlabs.io → Agents → tu agente → Widget / Embed.   */
  elevenlabsAgentId: '',   // bloqueado: API key inválida y sin voz es-LATAM en plan gratis

  /* Nombre y descripción del agente (se muestran en el panel) */
  agente: {
    nombre: 'CeVi',
    descripcion: 'Tu asistente C4V. Pregúntale por voz o texto sobre tu máquina, tu certificado o cómo preparar tu espacio.'
  },

  /* ---------- Canal humano (fallback siempre disponible) ---------- */
  whatsapp: {
    numero: '51924662205',            // sin + ni espacios (formato wa.me)
    visible: '+51 924 662 205'
  },

  /* ---------- Países y documentos (login por documento) ----------
     persona → documento de identidad · empresa → registro tributario.
     El prefijo telefónico se mantiene para notificaciones WhatsApp.     */
  paises: [
    { code: 'PE', nombre: 'Perú',     prefijo: '51',  bandera: '🇵🇪', persona: { doc: 'DNI',          ej: '45678123' },     empresa: { doc: 'RUC', ej: '20123456789' } },
    { code: 'EC', nombre: 'Ecuador',  prefijo: '593', bandera: '🇪🇨', persona: { doc: 'Cédula (CI)',  ej: '0912345678' },   empresa: { doc: 'RUC', ej: '0912345678001' } },
    { code: 'BO', nombre: 'Bolivia',  prefijo: '591', bandera: '🇧🇴', persona: { doc: 'CI',           ej: '7894561' },      empresa: { doc: 'NIT', ej: '1023456028' } },
    { code: 'CL', nombre: 'Chile',    prefijo: '56',  bandera: '🇨🇱', persona: { doc: 'RUN',          ej: '12.345.678-9' }, empresa: { doc: 'RUT', ej: '76.543.210-5' } },
    { code: 'CO', nombre: 'Colombia', prefijo: '57',  bandera: '🇨🇴', persona: { doc: 'Cédula (CC)',  ej: '1023456789' },   empresa: { doc: 'NIT', ej: '901234567' } }
  ],

  /* ---------- Verificación de cliente (M1) ----------
     El login se valida contra NUESTRA base de datos (Postgres `c4v`, tabla
     c4v.portal_contacts), NO contra Odoo en vivo. Un job (portal/sync-contactos.js)
     copia periódicamente los contactos de Odoo a esa tabla. El portal solo
     consulta el endpoint del backend:

        GET {apiBase}{endpoint}?pais=PE&doc=45678123   (opcional &telefono=)
        → { existe:true, cliente:{...}, maquinas:[...] }   |   { existe:false }

     El `cliente` viene en la MISMA forma que `clientes` de data.js y `maquinas`
     en la forma de `maquinas` de data.js — el front no transforma nada.

     PASO DE DEMO → PRODUCCIÓN (ver INTEGRACION_ODOO.md):
       1) Hostea server.js (Railway/Render/VPS) con POSTGRES_URL en el entorno.
          El portal público es ESTÁTICO (GitHub Pages) y NO puede correr el
          endpoint por sí solo: necesita ese backend hosteado.
       2) Corre el sync para poblar la tabla:  node sync-contactos.js
       3) Pon `apiBase` con la URL pública del backend (o '' si el backend sirve
          también el HTML), `verificacion.activo = true` y `mostrarNumerosDemo = false`.
       4) app.js: cuando NO sea demo, llama al endpoint en lugar de validar
          contra los `clientes` de data.js (ver INTEGRACION_ODOO.md §Cambio en app.js). */
  /* CÓMO PASAR A PRODUCCIÓN (backend hosteado en Railway/Render):
       1) Despliega portal/server.js (ver portal/.env.example, Procfile,
          railway.json, nixpacks.toml). Anota la URL pública que te da el host,
          p. ej. https://c4v-postventa-production.up.railway.app
       2) Pon esa URL en `apiBase` (SIN barra final). El portal llamará:
             {apiBase}{endpoint}?pais=PE&doc=45678123
          → https://c4v-postventa-production.up.railway.app/api/cliente?...
          Deja `apiBase: ''` SOLO si el mismo backend sirve también el HTML.
       3) En el host define ALLOWED_ORIGIN con el origen de GitHub Pages
          (https://sebastianjcv97.github.io) para que el navegador permita la
          llamada cross-origin (CORS ya está implementado en server.js).
       4) Corre el sync para poblar la tabla:  node sync-contactos.js
       5) Pon `activo: true` y abajo `mostrarNumerosDemo: false`.
     Verifica el host antes de activar:
       - {apiBase}/health              → { ok:true }
       - {apiBase}/api/cliente/health  → { ok:true, contactos:N }
     ⚠️ Antes de `activo:true` en un backend público, resuelve la protección PII
        (documento + OTP por WhatsApp). Ver INTEGRACION_ODOO.md §SEGURIDAD. */
  verificacion: {
    endpoint: '/api/cliente',   // ruta del backend de verificación (POST)
    // En local (npm start) el mismo servidor sirve portal y API; en producción, Railway.
    /* Vacío solo en local, donde el mismo proceso sirve página y API. En
       app.c4vlaser.com y en GitHub Pages el front es estático y la API vive en
       su propio servicio. */
    apiBase: /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
      ? '' : 'https://portal-api-general.up.railway.app',
    /* ⚠️ INTERRUPTOR DE SALIDA A PRODUCCIÓN — hoy en false A PROPÓSITO.
       El backend, el código por WhatsApp y la base (232 contactos de Odoo) están
       listos y probados. Falta UN paso que solo se hace en el panel de ManyChat:
       que el bot responda el código cuando el cliente escribe "C4V PORTAL xxxxx"
       (instrucciones exactas en ../../ACTIVAR_ACCESO.md).
       Si se pone `true` ANTES de ese paso, los clientes verán la pantalla del
       código y NUNCA lo recibirán: nadie podría entrar. Por eso queda en false. */
    activo: false
  },

  /* En demo mostramos los documentos de ejemplo para poder entrar (validación
     local contra los `clientes` de data.js).
     En producción: false → el login verifica contra el endpoint (`verificacion`).
     Mantén `true` mientras el endpoint NO esté hosteado y poblado. */
  mostrarNumerosDemo: false,

  /* ---------- Proveedores (obligatorio mostrarlos al consumidor) --------------
     El Código de Protección y Defensa del Consumidor exige que el consumidor
     sepa CON QUIÉN contrató. En C4V venden TRES empresas peruanas distintas
     (dato verificado en Odoo: 150 · 92 · 46 pedidos), así que el portal muestra
     la que le vendió a CADA cliente, no una genérica.
     Los datos vienen de las fichas de empresa de Odoo (res.company).            */
  empresas: {
    'C4V INGENIERIA Y SERVICIOS SRL': {
      razon_social: 'C4V INGENIERÍA Y SERVICIOS S.R.L.',
      ruc: '20600582331',
      domicilio: 'Av. Los Abedules 179, Urb. Camacho, La Molina, Lima, Perú'
    },
    'C4V LASER S.C.R.L.': {
      razon_social: 'C4V LASER S.C.R.L.',
      ruc: '20609326540',
      domicilio: 'Av. Arequipa 2616, Local Comercial, Lince, Lima, Perú'
    },
    'KUY IMPORTACIONES S.A.C.': {
      razon_social: 'KUY IMPORTACIONES S.A.C.',
      ruc: '20613203878',
      domicilio: 'Calle Las Hormigas 150, Urb. Santa Felicia, La Molina, Lima, Perú'
    }
  },

  /* La que se muestra cuando no sabemos con cuál contrató (páginas públicas,
     visitantes sin sesión). Es la que más máquinas ha vendido. */
  empresaPorDefecto: 'C4V INGENIERIA Y SERVICIOS SRL',

  /* Canales de atención, comunes a las tres. */
  contacto: {
    email: 'jcontreras@c4vlaser.com',
    email_datos: 'jcontreras@c4vlaser.com',   // para ejercer derechos sobre datos personales
    telefono: '905474440',
    whatsapp_visible: '+51 924 662 205'
  },

  /* Versión de los documentos legales. Súbela cuando cambie el texto: obliga a
     volver a pedir la aceptación al cliente. */
  versionLegal: '2026-09-1'
};
