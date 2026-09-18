/* Central de Postventa C4V — SPA (vanilla JS). Sin login (modo local).
   Funciona con servidor (npm start) o en modo DEMO con datos embebidos (data.js). */

const state = { db: null, ctx: null, offline: false, telefono: null, guiaPorCorreo: null, empresaVendedora: null };
const CFG = window.C4V_CONFIG || {};
const SESION_DIAS = 90; // A5: sesión recordada 90 días en el dispositivo

// ---------- helpers ----------
const $ = (s, r = document) => r.querySelector(s);
const view = $('#view');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => new Date().toISOString().slice(0, 10);
/* Odoo guarda casi todos los nombres EN MAYÚSCULAS. Mostrarlos así se lee como
   un grito y delata el volcado de datos, así que se capitalizan para la pantalla
   (el dato original no se toca). Respeta partículas y siglas cortas. */
const MINUS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'da', 'do', 'dos', 'van', 'von']);
function nombrePropio(s) {
  const t = String(s ?? '').trim();
  if (!t) return '';
  if (t !== t.toUpperCase()) return t;            // ya viene bien escrito
  return t.toLowerCase().split(/\s+/).map((p, i) => {
    if (i > 0 && MINUS.has(p)) return p;
    if (/^(s\.?a\.?c?\.?|s\.?r\.?l\.?|e\.?i\.?r\.?l\.?|ruc|dni)$/i.test(p)) return p.toUpperCase();
    return p.replace(/^(\p{L})/u, (c) => c.toUpperCase());
  }).join(' ');
}
const primerNombre = (s) => nombrePropio(s).split(' ')[0];
const PAISES = { PE: '🇵🇪 Perú', EC: '🇪🇨 Ecuador', BO: '🇧🇴 Bolivia', CL: '🇨🇱 Chile', CO: '🇨🇴 Colombia' };

function toast(msg) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  // El tiempo crece con el largo: 2,6 s no alcanzan para leer quince palabras.
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), Math.max(4000, msg.length * 80));
}
async function apiGet(url) { const r = await fetch(url); if (!r.ok) throw new Error('http'); return r.json(); }

/* Los videos del curso y las guías en PDF ya no cuelgan de una URL pública:
   se piden firmados y con caducidad, y solo se entregan con sesión válida.
   Antes cualquiera con el enlace se los descargaba sin haber comprado nada. */
async function enlaceMedio(tipo, archivo) {
  const ses = leerSesion();
  if (!ses?.t) return null;
  try {
    const r = await apiPost('/api/media', { token: ses.t, archivos: [{ tipo, archivo }] });
    const ruta = r?.urls?.[`${tipo}/${archivo}`];
    return ruta ? (VERIF.apiBase || '') + ruta : null;
  } catch { return null; }
}
function currentClient() { return state.db.clientes.find(c => c.id === state.ctx) || null; }

/* Preparación del espacio: la puerta de entrada. El resto del portal se
   desbloquea cuando el checklist de "Preparar mi espacio" está completo. */
function prepEstado() {
  const lista = state.db.preparacion?.checklist || [];
  let n = 0;
  try { n = lista.filter(c => localStorage.getItem('c4v_prep_' + state.ctx + '_' + c.id) === '1').length; } catch {}
  return { n, total: lista.length, completo: lista.length > 0 && n === lista.length };
}
/* Rutas siempre abiertas. El resto (academia y bolsa) se abre cuando el cliente
   completa su guía: una máquina instalada sin pozo a tierra o sin extractor se
   daña o hace daño, y esa guía es lo que lo evita.
   Soporte y el certificado NUNCA se cierran: pedir ayuda no se condiciona.
   La revisión de experiencia advirtió de tres riesgos del candado, y por eso:
   - la guía es corta (7 pasos, no 12),
   - el motivo se explica en la propia pantalla, no con un aviso que se desvanece,
   - y el canal de ayuda queda siempre a la vista. */
/* Ya no hay rutas cerradas: nada se bloquea, todo está a un toque. */

// ---------- data layer ----------
async function loadDB() {
  /* El contenido fijo (cursos, guías, FAQ) sale de data.js; lo que cambia por
     cliente lo sirve el backend, y se le pregunta SIEMPRE que haya a dónde.
     La ruta iba sin `apiBase`, así que en app.c4vlaser.com pedía /api/bootstrap
     al servicio del front, recibía 404 y se quedaba con los datos de ejemplo:
     la Bolsa mostraba cuatro trabajos inventados como si fueran reales. */
  if (location.protocol === 'file:') { state.offline = true; return JSON.parse(JSON.stringify(window.__SEED__)); }
  try {
    const db = await apiGet(`${VERIF.apiBase || ''}/api/bootstrap`);
    state.offline = false;
    /* Mientras la verificación real sigue apagada, el portal está en modo
       demostración. El backend no devuelve clientes de ejemplo, y hace bien,
       así que aquí se añaden SOLO esos para poder entrar y probar.
       Los trabajos y los tickets NO se tocan: se quedan como los da el backend,
       vacíos, para que nadie vea un encargo inventado como si fuera real. */
    if (!VERIF.activo && !(db.clientes || []).length && window.__SEED__) {
      db.clientes = JSON.parse(JSON.stringify(window.__SEED__.clientes || []));
      db.maquinas = JSON.parse(JSON.stringify(window.__SEED__.maquinas || []));
    }
    return db;
  } catch { state.offline = true; return JSON.parse(JSON.stringify(window.__SEED__)); }
}

/* Con la verificación real activa, los trabajos de la Bolsa y los tickets TIENEN
   que venir del backend. Los de data.js son ejemplos con nombres y teléfonos
   inventados: enseñárselos a un cliente real sería ofrecerle trabajo que no
   existe. Si el backend no responde, se muestra vacío, nunca los de ejemplo. */
async function cargarDatosVivos() {
  if (modoDemo()) return;
  const base = VERIF.apiBase || '';
  state.db.leads = [];
  state.db.tickets = [];
  state.leadsCargados = false;
  try {
    const r = await fetch(`${base}/api/leads`);
    if (r.ok) { const j = await r.json(); if (Array.isArray(j)) { state.db.leads = j; state.leadsCargados = true; } }
  } catch { /* sin conexión: la Bolsa se muestra vacía y lo explica */ }
}
async function mutate(onlineCall, offlineFn) {
  if (!state.offline) { await onlineCall(); state.db = await loadDB(); } else { offlineFn(state.db); }
}
const post = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => { if (!r.ok) throw new Error('err'); });
// Id = max existente + 1 (length+1 repetiría ids si se borra un registro).
const nextId = (prefix, list, base) => prefix + '-' + (list.reduce((m, x) => { const n = parseInt(String(x.id || '').replace(/^\D+/, ''), 10); return n > m ? n : m; }, base) + 1);
const actions = {
  crearLead: (p) => mutate(() => post('/api/leads', p),
    (db) => db.leads.unshift({ id: nextId('lead', db.leads, 1000), titulo: p.titulo, descripcion: p.descripcion || '', material: p.material || '', cantidad: p.cantidad || '', pais: p.pais || 'PE', ciudad: p.ciudad || '', contacto: p.contacto, telefono: p.telefono || '', estado: 'nuevo', tomado_por: null, fecha: today() })),
  tomarLead: (id, cliente_id) => mutate(() => post(`/api/leads/${id}/tomar`, { cliente_id }),
    (db) => { const l = db.leads.find(x => x.id === id); if (l) { l.estado = 'tomado'; l.tomado_por = cliente_id; } })
};

// ---------- Ruta de inicio (onboarding en 4 pasos, en el inicio) ----------
// Cada paso se marca hecho con señales reales: preparación completa, certificado
// visitado, quiz del curso de bienvenida aprobado (≥70%), soporte visitado.
// Cuando los 4 están hechos, la ruta desaparece: el inicio queda limpio.


// Sello del Certificado de Calidad C4V (de P2/COMUNICACION.md)
const CANDADO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" style="width:14px;height:14px"><rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"/></svg>`;
const SEAL = `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Certificado de Calidad C4V"><circle cx="100" cy="100" r="96" fill="#fdeeee" stroke="#F9020B" stroke-width="5"/><circle cx="100" cy="100" r="84" fill="none" stroke="#F9020B" stroke-width="1.5" stroke-dasharray="2 4"/><text x="100" y="54" text-anchor="middle" font-family="'Roboto Slab', serif" font-size="12" font-weight="700" letter-spacing="2" fill="#c40309">CERTIFICADO</text><text x="100" y="70" text-anchor="middle" font-family="'Roboto Slab', serif" font-size="10" letter-spacing="4" fill="#141414">DE CALIDAD</text><text x="100" y="121" text-anchor="middle" font-family="'Roboto Slab', serif" font-size="38" font-weight="800" fill="#F9020B">C4V</text><text x="100" y="150" text-anchor="middle" font-family="'Roboto', sans-serif" font-size="8.5" font-weight="700" letter-spacing="1.5" fill="#141414">PROBADA · CALIBRADA · LISTA</text></svg>`;

// Íconos de línea (profesional, sin emojis)
/* Iconos de línea, trazo grueso, pensados para leerse de un vistazo en un
   teléfono. Cada uno dibuja la cosa, no una metáfora: un globo de conversación
   para pedir ayuda, un maletín para los encargos, tres figuras para los diseños. */
const ICONS = {
  /* Un icono por curso: se reconoce antes de leer el título, que es de lo que
     se trata cuando alguien abre la Academia sin saber por dónde empezar. */
  bienvenida: '<path d="M4 5.5h16v13H4z"/><path d="M4 9.5h16"/><path d="M8 5.5v4"/>',
  laser: '<path d="M12 3v5"/><path d="M8.5 8.5h7l1.5 4h-10z"/><path d="M12 12.5V21"/><path d="M7 21h10"/>',
  llave: '<path d="M14.5 6.5a3.5 3.5 0 1 0 3.2 4.9l2.8 2.8-2.1 2.1-2.8-2.8a3.5 3.5 0 0 1-4.9-3.2"/><path d="M11.7 10.3 4 18v2h2l7.7-7.7"/>',
  monitor: '<rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M9 20.5h6"/><path d="M12 16.5v4"/>',
  alerta: '<path d="M12 4 2.5 20h19z"/><path d="M12 10v5"/><path d="M12 17.5v.5"/>',
  descarga: '<path d="M12 3v11"/><path d="M8 10.5 12 14.5l4-4"/><path d="M4.5 18.5h15"/>',
  play: '<circle cx="12" cy="12" r="8.5"/><path d="M10.2 8.8 15.5 12l-5.3 3.2z"/>',
  /* Iconos de módulo: se eligen por palabra clave del título (ver iconoModulo). */
  caja: '<path d="M3.5 8 12 4l8.5 4v8L12 20l-8.5-4z"/><path d="M3.5 8 12 12l8.5-4"/><path d="M12 12v8"/>',
  sello: '<circle cx="12" cy="10" r="6"/><path d="M9 15.5 8 21l4-2 4 2-1-5.5"/>',
  espacio: '<rect x="3.5" y="5.5" width="17" height="13" rx="1.5"/><path d="M3.5 10.5h17"/><path d="M8 5.5v13"/>',
  encendido: '<path d="M12 4v8"/><path d="M7 7.5a7 7 0 1 0 10 0"/>',
  corte: '<circle cx="7" cy="7" r="2.5"/><circle cx="7" cy="17" r="2.5"/><path d="M9 8.5 19 18"/><path d="M9 15.5 19 6"/>',
  lupa: '<circle cx="10.5" cy="10.5" r="5.5"/><path d="M14.5 14.5 20 20"/>',
  gota: '<path d="M12 3.5c3 4 6 7 6 10.5a6 6 0 0 1-12 0c0-3.5 3-6.5 6-10.5z"/>',
  aceite: '<path d="M6 20V11l4-3h5l3 3v9z"/><path d="M15 8V5.5h-3"/><path d="M11 20v-4"/>',
  enchufe: '<path d="M9 3.5v4"/><path d="M15 3.5v4"/><path d="M6 7.5h12v3a6 6 0 0 1-12 0z"/><path d="M12 16.5v4"/>',
  pantalla: '<rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M7 9h6"/><path d="M7 12.5h10"/><path d="M9 20.5h6"/>',
  texto: '<path d="M5 6h14"/><path d="M12 6v13"/><path d="M8.5 19h7"/>',
  estrella: '<path d="M12 3.8l2.5 5.2 5.7.7-4.2 3.9 1.1 5.6L12 16.4l-5.1 2.8 1.1-5.6-4.2-3.9 5.7-.7z"/>',
  visto: '<circle cx="12" cy="12" r="8.5"/><path d="M8.4 12.2 11 14.8l4.6-5"/>',
  prueba: '<path d="M6.5 3.5h11v17h-11z"/><path d="M9.5 9h5"/><path d="M9.5 13h5"/><path d="M9.5 17h3"/>',
  tabla: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17"/><path d="M9.5 9.5v10"/>',
  // Globo de conversación con tres puntos: se habla con una persona.
  soporte: '<path d="M20 12.5a7.5 7.5 0 0 1-11 6.6L4 20.5l1.5-4.5A7.5 7.5 0 1 1 20 12.5z"/><path d="M8.5 12.5h.01M12 12.5h.01M15.5 12.5h.01"/>',
  // Maletín: encargos de trabajo.
  bolsa: '<rect x="3" y="7.5" width="18" height="12.5" rx="2.5"/><path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5"/><path d="M3 12.5h18"/>',
  // Tres figuras: un cuadrado, un círculo y un triángulo. Eso es un diseño.
  disenos: '<rect x="3.5" y="3.5" width="8" height="8" rx="1.5"/><circle cx="17" cy="7.5" r="4"/><path d="M7.5 13.5l4.5 7h-9z"/>',
  // Libro abierto: aprender.
  academia: '<path d="M12 7c0-1.7-2.2-3-5-3s-4 .7-4 .7v13s1.2-.7 4-.7 5 1.3 5 1.3"/><path d="M12 7c0-1.7 2.2-3 5-3s4 .7 4 .7v13s-1.2-.7-4-.7-5 1.3-5 1.3"/>',
  // Casilla marcada: los primeros pasos.
  prep: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M8 12.2l2.8 2.8L16.5 9.3"/>',
  // Casa: el inicio.
  // Un toro de línea para el asistente: es CeVi, no un globo de chat genérico.
  cevi: '<path d="M5 7.5C5 5 3.5 4 3.5 4s3 0 4.5 2"/><path d="M19 7.5c0-2.5 1.5-3.5 1.5-3.5s-3 0-4.5 2"/><path d="M7.5 8.5h9a3 3 0 0 1 3 3v1a7.5 7.5 0 0 1-15 0v-1a3 3 0 0 1 3-3z"/><path d="M9.5 12.5h.01M14.5 12.5h.01"/><path d="M9.5 16.5c1.6 1.2 3.4 1.2 5 0"/>',
  // Libro abierto con una marca: el Libro de Reclamaciones.
  reclamo: '<path d="M4 5.5h6a2 2 0 0 1 2 2v11a2 2 0 0 0-2-2H4z"/><path d="M20 5.5h-6a2 2 0 0 0-2 2v11a2 2 0 0 1 2-2h6z"/><path d="M15 9.5h3M15 12.5h3"/>',
  inicio: '<path d="M3.5 10.5L12 3.5l8.5 7"/><path d="M5.5 9.5v10h13v-10"/><path d="M9.5 19.5v-6h5v6"/>',
  // Signo de pregunta: dudas.
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.3a2.5 2.5 0 1 1 3.3 2.4c-.8.3-1.2.9-1.2 1.7"/><path d="M11.6 16.6h.8"/>',
  // Candado: un curso que todavía no se puede abrir.
  candado: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>',
  // Flechita hacia abajo: abre/cierra un módulo (gira 180° cuando está abierto).
  chevron: '<path d="M6 9.5 12 15.5 18 9.5"/>'
};

const icon = (n) => `<svg class="ic" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[n] || ''}</svg>`;

// Diagramas simples para la guía de preparación (accentos en currentColor = rojo de marca)
const DIAG = {
  electrico: '<rect x="72" y="34" width="76" height="58" rx="12" fill="#fff" stroke="#333" stroke-width="3"/><line x1="98" y1="50" x2="98" y2="68" stroke="#333" stroke-width="4"/><line x1="122" y1="50" x2="122" y2="68" stroke="#333" stroke-width="4"/><circle cx="110" cy="80" r="4" fill="#333"/><path d="M150 12 l-14 22 h11 l-7 18 20 -25 h-11 z" fill="currentColor"/><text x="110" y="110" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="700" fill="currentColor">220V dedicado</text>',
  tierra: '<rect x="92" y="16" width="36" height="24" rx="4" fill="#fff" stroke="#333" stroke-width="3"/><line x1="110" y1="40" x2="110" y2="62" stroke="#333" stroke-width="3"/><line x1="84" y1="62" x2="136" y2="62" stroke="currentColor" stroke-width="4"/><line x1="92" y1="72" x2="128" y2="72" stroke="currentColor" stroke-width="4"/><line x1="100" y1="82" x2="120" y2="82" stroke="currentColor" stroke-width="4"/><text x="110" y="108" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="700" fill="currentColor">Pozo a tierra</text>',
  extraccion: '<rect x="34" y="46" width="72" height="46" rx="6" fill="#fff" stroke="#333" stroke-width="3"/><path d="M52 40 q6 -9 12 0 q6 9 12 0" fill="none" stroke="#999" stroke-width="2.5"/><path d="M106 60 H150 V38" fill="none" stroke="#333" stroke-width="3"/><path d="M150 30 l-7 12 h14 z" fill="currentColor"/><line x1="158" y1="30" x2="188" y2="30" stroke="#333" stroke-width="3"/><text x="120" y="110" text-anchor="middle" font-family="sans-serif" font-size="12.5" font-weight="700" fill="currentColor">Extractor al exterior</text>',
  chiller: '<rect x="80" y="30" width="60" height="52" rx="8" fill="#fff" stroke="#333" stroke-width="3"/><path d="M110 40 c-11 13 -15 19 -15 25 a15 15 0 0 0 30 0 c0 -6 -4 -12 -15 -25 z" fill="currentColor"/><text x="110" y="106" text-anchor="middle" font-family="sans-serif" font-size="12" font-weight="700" fill="currentColor">Agua destilada · 15–25°C</text>',
  secuencia: '<g font-family="sans-serif"><rect x="4" y="38" width="58" height="42" rx="6" fill="#fff" stroke="#333" stroke-width="2.5"/><text x="33" y="57" text-anchor="middle" font-size="13" font-weight="800" fill="#333">1</text><text x="33" y="71" text-anchor="middle" font-size="8" fill="#333">Estabiliz.</text><path d="M66 59 h14" stroke="currentColor" stroke-width="3"/><path d="M80 59 l-7 -4 v8 z" fill="currentColor"/><rect x="84" y="38" width="52" height="42" rx="6" fill="#fff" stroke="#333" stroke-width="2.5"/><text x="110" y="57" text-anchor="middle" font-size="13" font-weight="800" fill="#333">2</text><text x="110" y="71" text-anchor="middle" font-size="8" fill="#333">Chiller</text><path d="M140 59 h14" stroke="currentColor" stroke-width="3"/><path d="M154 59 l-7 -4 v8 z" fill="currentColor"/><rect x="158" y="38" width="58" height="42" rx="6" fill="#fff" stroke="#333" stroke-width="2.5"/><text x="187" y="57" text-anchor="middle" font-size="13" font-weight="800" fill="#333">3</text><text x="187" y="71" text-anchor="middle" font-size="8" fill="#333">Máquina</text></g>',
  seguridad: '<path d="M110 28 L152 92 H68 Z" fill="#fff" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><line x1="110" y1="50" x2="110" y2="72" stroke="currentColor" stroke-width="4"/><circle cx="110" cy="82" r="2.8" fill="currentColor"/><text x="110" y="110" text-anchor="middle" font-family="sans-serif" font-size="12.5" font-weight="700" fill="currentColor">Nunca cortes PVC</text>'
};
const diag = (k) => `<svg class="diag" aria-hidden="true" viewBox="0 0 220 120" fill="none">${DIAG[k] || ''}</svg>`;

// ---------- vistas ----------
/* ---------- Las pantallas de la Academia ----------
   La portada son los cursos y nada más. Las guías en PDF y la tabla de
   parámetros dejaron de ser secciones sueltas: viven dentro del curso al que
   pertenecen, que es donde alguien las va a buscar. */

/* Un icono por módulo, elegido por lo que dice el título. Si nada encaja, el
   del curso. Así cada fila tiene una pista visual sin tocar los datos. */
function iconoModulo(titulo, porDefecto) {
  const t = String(titulo || '').toLowerCase();
  const reglas = [
    [/compra|accesos|kit/, 'caja'], [/certificado/, 'sello'], [/espacio|prep[aá]rate/, 'espacio'],
    [/capacitaci[oó]n|primer corte|proyecto/, 'corte'], [/encendido|encender/, 'encendido'],
    [/revisi[oó]n/, 'lupa'], [/lente|espejo|limpieza/, 'lupa'], [/agua|enfriador|chiller/, 'gota'],
    [/lubric|riel|aceite/, 'aceite'], [/error|destruy|seguridad/, 'alerta'],
    [/instalaci[oó]n|conexi[oó]n/, 'enchufe'], [/interfaz|herramienta/, 'pantalla'],
    [/texto|vector/, 'texto'], [/evaluaci[oó]n/, 'prueba']
  ];
  const r = reglas.find(([re]) => re.test(t));
  return r ? r[1] : (porDefecto || 'academia');
}

function cursoIcono(clave) {
  return `<span class="destino-ico" aria-hidden="true">${icon(clave || 'academia')}</span>`;
}

/* ---------- El curso como secuencia de pantallas ----------
   Misma dinámica que Primeros pasos: una lección por pantalla, visto ✓ al
   avanzar, y la evaluación del módulo justo cuando termina el módulo. */
function secuenciaCurso(c) {
  const seq = [];
  const esExamen = (m) => !(m.lecciones || []).length && (m.preguntas || []).length;
  c.modulos.forEach((m, mi) => {
    if (esExamen(m)) return;
    (m.lecciones || []).forEach((l, li) => seq.push({ tipo: 'leccion', mi, li, l, m }));
    if ((m.preguntas || []).length) seq.push({ tipo: 'quiz', mi, m });
  });
  c.modulos.forEach((m, mi) => { if (esExamen(m)) seq.push({ tipo: 'quiz', mi, m, examen: true }); });
  return seq;
}

const claveLec = (cid, mi, li) => 'c4v_lec_' + state.ctx + '_' + cid + '_' + mi + '_' + li;
const lecVista = (cid, mi, li) => { try { return localStorage.getItem(claveLec(cid, mi, li)) === '1'; } catch { return false; } };
const quizAprobado = (cid, mi) => { try { return ((JSON.parse(localStorage.getItem('c4v_quiz_' + state.ctx + '_' + cid + '-' + mi) || 'null') || {}).p || 0) >= 70; } catch { return false; } };

// Primer paso que falta: por ahí se retoma.
function primerPendiente(c) {
  const seq = secuenciaCurso(c);
  const i = seq.findIndex(p => p.tipo === 'leccion' ? !lecVista(c.id, p.mi, p.li) : !quizAprobado(c.id, p.mi));
  return i === -1 ? seq.length : i;
}

function vistaLeccion(a, c, idx) {
  const seq = secuenciaCurso(c);
  const total = seq.length;
  if (idx >= total) {
    return `<div class="paso-fin">
        <h2>Terminaste el curso</h2>
        <p>${esc(c.titulo)}</p>
        <a class="btn primary" href="#/academia">Volver a la Academia</a>
        <a class="paso-link" href="#/academia/curso/${esc(c.id)}/p/0">Verlo otra vez</a>
      </div>`;
  }
  const p = seq[idx];
  const base = `#/academia/curso/${esc(c.id)}`;
  const nLec = seq.filter(x => x.tipo === 'leccion').length;
  const nAqui = seq.slice(0, idx + 1).filter(x => x.tipo === 'leccion').length;
  /* Barra segmentada tipo Duolingo, por MÓDULO y no por curso entero: con un
     curso de 30-40 pantallas, una barra de todo el curso son puntitos
     ilegibles. Por módulo son 3-8 tramos, se lee de un vistazo — así se
     siente una lección de Duolingo, no un índice completo. El conteo se
     conserva como aria-label para lector de pantalla. */
  const enModulo = seq.filter(x => x.mi === p.mi);
  const idxModulo = enModulo.indexOf(p);
  const cabecera = (label) => `<div aria-label="${esc(label)}">${segbar(enModulo.length, idxModulo)}</div>`;
  const pie = (siguiente) => `
    <div class="paso-pie paso-nav">
      ${siguiente}
      ${idx > 0 ? `<a class="paso-link" href="${base}/p/${idx - 1}">Atrás</a>` : `<a class="paso-link" href="${base}">Volver al curso</a>`}
    </div>`;

  if (p.tipo === 'quiz') {
    /* Si ya la aprobaste, no se relanza sola: antes mostraba a la vez un
       "Siguiente" arriba Y una pregunta nueva abajo, como si una cosa no
       tuviera nada que ver con la otra. Ahora, si ya pasaste, se ve el
       resultado y un solo camino claro: seguir, o volver a intentarla. */
    const mejor = (() => { try { return JSON.parse(localStorage.getItem('c4v_quiz_' + state.ctx + '_' + c.id + '-' + p.mi) || 'null'); } catch { return null; } })();
    const yaAprobado = quizAprobado(c.id, p.mi);
    // Sin barra aquí arriba: el quiz pinta la suya propia (pregunta N de M)
    // dentro de qz-area. Mostrar las dos a la vez era ruido, no información.
    return `<section class="paso paso-quiz">
      <p class="lec-modulo">${esc(p.examen ? 'Evaluación final' : `${p.mi + 1}. ${p.m.titulo}`)}</p>
      <div class="quiz-hecho" data-siguiente="${base}/p/${idx + 1}"${yaAprobado ? '' : ' hidden'}>
        <p class="quiz-hecho-nota">Ya aprobaste esta evaluación${mejor ? `: ${mejor.b} de ${mejor.n}` : ''}.</p>
        <a class="btn primary" href="${base}/p/${idx + 1}">Siguiente</a>
        <button type="button" class="paso-link quiz-reintentar">Volver a intentarla</button>
      </div>
      <div class="quiz-box auto" data-key="${esc(c.id + '-' + p.mi)}" data-curso="${esc(c.id)}" data-mod="${p.mi}" data-siguiente="${base}/p/${idx + 1}"${yaAprobado ? ' hidden' : ''}>
        <button type="button" class="qz-start" hidden></button>
        <div class="qz-area"></div>
      </div>
      ${pie('')}
    </section>`;
  }

  const l = p.l;
  const esVideo = typeof l !== 'string' && l.v;
  const esImagen = typeof l !== 'string' && l.img;
  const texto = typeof l === 'string' ? l : (l.t || '');
  let cuerpo = '';
  if (esImagen && c.laminas) {
    // Lámina ilustrada: el título va dentro, así que no se repite encima.
    cuerpo = `<figure class="lec-lamina"><img src="assets/academia/${esc(c.id)}/${esc(l.img)}" alt="${esc(texto)}" onerror="this.closest('.lec-lamina').remove()"></figure>
      ${texto ? `<p class="lec-pie">${esc(texto)}</p>` : ''}`;
  } else if (esImagen) {
    // Foto real de un procedimiento: la instrucción va arriba, como título.
    cuerpo = `<h2 class="paso-titulo lec-instruccion">${esc(texto)}</h2>
      <figure class="lec-foto"><img src="assets/academia/${esc(c.id)}/${esc(l.img)}" alt="" onerror="this.closest('.lec-foto').remove()"></figure>`;
  } else if (esVideo) {
    cuerpo = `<h2 class="paso-titulo">${esc(texto)}</h2>
      <div class="lec-video-caja" data-video="${esc(l.v)}"><div class="lv-player"></div></div>`;
  } else {
    cuerpo = `<h2 class="paso-titulo">${esc(texto)}</h2>`;
  }
  return `<section class="paso">
    ${cabecera(`Lección ${nAqui} de ${nLec}`)}
    <p class="lec-modulo">${p.mi + 1}. ${esc(p.m.titulo)}</p>
    ${cuerpo}
    ${pie(`<a class="btn primary lec-siguiente" href="${base}/p/${idx + 1}" data-vista="${claveLec(c.id, p.mi, p.li)}">Siguiente</a>`)}
  </section>`;
}

function vistaCurso(a, id) {
  const c = (a.cursos || []).find(x => x.id === id);
  if (!c) return '<p class="bajada">Ese curso ya no está.</p>';
  const base = `#/academia/curso/${esc(c.id)}`;
  const seq = secuenciaCurso(c);
  const pend = primerPendiente(c);
  const nLec = seq.filter(x => x.tipo === 'leccion').length;
  const vistas = seq.filter(x => x.tipo === 'leccion' && lecVista(c.id, x.mi, x.li)).length;
  const terminado = pend >= seq.length;

  const cabecera = c.img ? `<figure class="curso-dibujo"><img src="assets/academia/${esc(c.img)}" alt="" onerror="this.closest('.curso-dibujo').remove()"></figure>` : '';

  const boton = terminado
    ? `<a class="btn primary paso-listo" href="${base}/p/0">Verlo otra vez</a>`
    : `<a class="btn primary paso-listo" href="${base}/p/${pend}">${vistas ? 'Continuar' : 'Empezar'}</a>`;

  /* Cada módulo es un <details> cerrado, no una lista que se ve entera de
     entrada: con 9 módulos y 32 lecciones, mostrar cada renglón de texto de
     una vez eran ~9000px de scroll antes de poder tocar "Empezar" — el
     curso se sentía como un índice, no como un camino de Duolingo. Abierto
     por default: solo el módulo donde retoma la persona; el resto, cerrado,
     con su cuenta de avance a la vista para saber qué falta sin desplegarlo. */
  const pendEntry = seq[pend];
  const moduloActivo = pendEntry ? pendEntry.mi : -1;
  let k = -1;
  const modulos = c.modulos.map((m, mi) => {
    const esExamen = !(m.lecciones || []).length && (m.preguntas || []).length;
    if (esExamen) return '';
    const filas = (m.lecciones || []).map((l, li) => {
      k++;
      const idx = seq.findIndex(x => x.tipo === 'leccion' && x.mi === mi && x.li === li);
      const t = typeof l === 'string' ? l : (l.t || '');
      const v = lecVista(c.id, mi, li);
      return `<a class="lec-fila${v ? ' vista' : ''}" href="${base}/p/${idx}">
        <span class="lec-check" aria-hidden="true">${v ? icon('visto') : (typeof l !== 'string' && l.v ? icon('play') : '')}</span>
        <span class="lec-txt">${esc(t)}</span>
        <span class="destino-flecha" aria-hidden="true">›</span>
      </a>`;
    }).join('');
    const q = (m.preguntas || []).length;
    const qi = seq.findIndex(x => x.tipo === 'quiz' && x.mi === mi);
    const modAprobado = q ? quizAprobado(c.id, mi) : false;
    const evalFila = q ? `<a class="lec-fila lec-eval${modAprobado ? ' vista' : ''}" href="${base}/p/${qi}">
        <span class="lec-check" aria-hidden="true">${modAprobado ? icon('visto') : icon('prueba')}</span>
        <span class="lec-txt">Evaluación del módulo</span>
        <span class="destino-flecha" aria-hidden="true">›</span>
      </a>` : '';
    const nLecMod = (m.lecciones || []).length;
    const vistasMod = (m.lecciones || []).reduce((n, l, li) => n + (lecVista(c.id, mi, li) ? 1 : 0), 0);
    const modCompleto = vistasMod === nLecMod && (!q || modAprobado);
    return `<details class="modulo"${mi === moduloActivo ? ' open' : ''}>
      <summary class="modulo-tit">
        <span class="modulo-ico" aria-hidden="true">${icon(iconoModulo(m.titulo, c.icono))}</span>
        <span class="modulo-n">${mi + 1}</span>
        <span class="modulo-txt">${esc(m.titulo)}</span>
        <span class="modulo-avance${modCompleto ? ' completo' : ''}" aria-hidden="true">${modCompleto ? icon('visto') : `${vistasMod}/${nLecMod}`}</span>
        <span class="modulo-chevron" aria-hidden="true">${icon('chevron')}</span>
      </summary>
      <div class="lec-lista">${filas}${evalFila}</div>
    </details>`;
  }).join('');

  const examen = c.modulos.some(m => !(m.lecciones || []).length && (m.preguntas || []).length)
    ? (() => { const qi = seq.findIndex(x => x.examen); const mi = seq[qi].mi; return `
      <section class="examen">
        <a class="lec-fila lec-eval${quizAprobado(c.id, mi) ? ' vista' : ''}" href="${base}/p/${qi}">
          <span class="lec-check" aria-hidden="true">${quizAprobado(c.id, mi) ? icon('visto') : icon('prueba')}</span>
          <span class="lec-txt"><strong>Evaluación final</strong></span>
          <span class="destino-flecha" aria-hidden="true">›</span>
        </a>
      </section>`; })()
    : '';

  const guias = (a.guiasPdf || []).filter(g => g.curso === c.id);
  const bloqueGuias = guias.length ? `
    <h2 class="section-h">Para descargar</h2>
    <div class="destinos">
      ${guias.map(g => `<button type="button" class="destino" data-guia="${esc(g.archivo)}">
        <span class="destino-ico" aria-hidden="true">${icon('descarga')}</span>
        <span class="destino-txt"><strong>${esc(g.titulo)}</strong><small>${esc(g.tam)}</small></span>
      </button>`).join('')}
    </div>` : '';

  const pr = a.parametros;
  const bloqueParams = (c.id === 'c1' && pr) ? `
    <h2 class="section-h">Potencia y velocidad por material</h2>
    <div class="tabla-scroll">
      <table class="tabla-params"><thead><tr>
        <th>Material</th><th>Grosor</th><th>Corte</th><th>Marcado</th><th>Grabado</th>
      </tr></thead>
      <tbody>${pr.filas.map(f => `<tr><td><strong>${esc(f.m)}</strong></td><td>${esc(f.g)}</td><td>${esc(f.corte)}</td><td>${esc(f.marcado)}</td><td>${esc(f.grabado)}</td></tr>`).join('')}</tbody></table>
    </div>
    <p class="bajada">${esc(pr.nota)}</p>` : '';

  return `${cabecera}
    <div class="curso-avance">
      <p class="paso-cuenta">${vistas} de ${nLec} lecciones vistas</p>
      <div class="paso-barra"><i style="width:${nLec ? Math.round(vistas / nLec * 100) : 0}%"></i></div>
      ${boton}
    </div>
    ${modulos}${examen}${bloqueParams}${bloqueGuias}`;
}

const views = {
  /* Pantalla única: saludo + tu máquina + 5 botones grandes. Nada más.
     Todo lo demás vive DENTRO de esos botones. */
  /* Mi cuenta. Antes la tarjeta de la máquina ocupaba el inicio, donde nadie la
     busca. Aquí sí: se llega tocando tu nombre, que es lo que uno hace cuando
     quiere ver "lo mío". */
  cuenta(sub) {
    // El certificado se veía desde el nombre, pero como ruta independiente: no
    // tenía cómo volver a Mi cuenta salvo con el botón atrás del navegador. Al
    // pasar a ser una subruta de cuenta, el "← Mi cuenta" sale solo (mismo
    // mecanismo que ya usa Academia para sus cursos).
    if (sub === 'certificado') return views.certificado();
    const d = state.db, cli = currentClient();
    if (!cli) return '<p class="muted">Entra con tu documento para ver tus datos.</p>';
    const maqs = d.maquinas.filter(m => m.cliente_id === cli.id);
    const info = docInfo(cli.pais, cli.tipo);
    return `
      <div class="cuenta-datos">
        <p class="cuenta-nombre">${esc(nombrePropio(cli.nombre))}</p>
        <p class="muted">${esc(info.doc)} ${esc(cli.documento)}${cli.ciudad ? ' · ' + esc(cli.ciudad) : ''}</p>
      </div>

      <h2 class="section-h">${maqs.length > 1 ? 'Tus máquinas' : 'Tu máquina'}</h2>
      ${maqs.length ? maqs.map(m => `
        <a class="maq" href="#/cuenta/certificado">
          <div class="maq-seal">${SEAL}</div>
          <div class="maq-txt">
            <strong>Láser ${esc(m.modelo)}</strong>
            <span>${m.certificado?.estado === 'certificada' ? 'Probada y calibrada. Ver tu certificado'
                 : ['en_revision','en_proceso'].includes(m.certificado?.estado) ? 'La estamos probando'
                 : 'Ver tu certificado'}</span>
          </div>
          <div class="big-arrow" aria-hidden="true">›</div>
        </a>`).join('') : '<p class="muted">Todavía no vemos una máquina a tu nombre. Escríbenos y lo revisamos.</p>'}

      <button type="button" class="btn ghost cuenta-salir" id="salirCuenta">Cerrar sesión</button>`;
  },

  inicio() {
    const cli = currentClient();
    const prep = prepEstado();

    /* El inicio ya no repite lo que está en el menú de arriba. Solo tres cosas:
       tu máquina, lo único que toca hacer ahora, y dónde pedir ayuda. Antes eran
       seis botones grandes, tres de ellos duplicando el menú, y dos "cerrados"
       que decían cuánto te faltaba en vez de dejarte pasar. */
    const bigBtn = (href, ic, t, desc) => `<a class="big" href="${href}">
        <div class="big-ico">${icon(ic)}</div>
        <div class="big-txt"><strong>${t}</strong><span>${desc}</span></div>
        <div class="big-arrow" aria-hidden="true">›</div></a>`;

    return `
      <div class="saludo-fila">
        <img class="saludo-toro" src="assets/cevi/saluda.png" width="124" height="160" loading="lazy" alt="" aria-hidden="true" decoding="async">
        <h1 class="saludo">${cli ? `Hola, ${esc(primerNombre(cli.nombre))}` : 'Hola'}</h1>
      </div>

      ${prep.completo ? `
      <a class="prep-cta lista" href="#/academia">
        <div class="prep-cta-top"><strong>Ya tienes todo listo</strong><span>${prep.total} de ${prep.total}</span></div>
        <p>Ahora aprende a usar tu máquina.</p>
        <span class="prep-cta-btn">Ir a la Academia</span>
      </a>` : `
      <a class="prep-cta" href="#/academia/prep">
        <div class="prep-cta-top"><strong>Empieza por aquí</strong><span>${prep.n} de ${prep.total}</span></div>
        <div class="bar"><i style="width:${prep.total ? Math.round(prep.n / prep.total * 100) : 0}%"></i></div>
        <p>Cinco pasos para dejar tu espacio listo. Es el primer curso de tu Academia.</p>
        <span class="prep-cta-btn">Empezar en la Academia</span>
      </a>`}

      <div class="bigs">
        <!-- CeVi no va aquí: vive en el menú, junto a las demás secciones. -->
        ${bigBtn('#/soporte', 'soporte', 'Necesito ayuda', 'Escríbenos por WhatsApp')}
        ${bigBtn('#/bolsa', 'bolsa', 'Trabajos para ti', 'Encargos de corte, gratis')}
        ${bigBtn('#/plantillas', 'disenos', 'Diseños para cortar', 'Incluidos con tu máquina')}
      </div>`;
  },

  /* ---------- La Academia: los cursos, y ya ----------
     Tenía cinco destinos: seguridad, cursos, parámetros, guías y preguntas.
     Los parámetros y las guías eran secciones sueltas que nadie relacionaba con
     nada, así que se metieron dentro del curso al que pertenecen. Las preguntas
     se fueron a «Necesito ayuda», que es donde se buscan. Aquí quedan los
     cursos: cuatro botones con su icono, más el candado del primero. */
  academia(ruta) {
    const a = state.db.academia;
    const [sec, id, modo, n] = String(ruta || '').split('/');
    // «Prepara tu espacio» es el primer curso, siempre abierto: es el candado.
    if (sec === 'prep') return views.preparacion();
    if (sec === 'curso' && id) {
      const c = (a.cursos || []).find(x => x.id === id);
      if (c && modo === 'p') return vistaLeccion(a, c, Math.max(0, parseInt(n, 10) || 0));
      return vistaCurso(a, id);
    }

    const nLec = (c) => c.modulos.reduce((t, m) => t + m.lecciones.length, 0);
    const nGuias = (c) => (a.guiasPdf || []).filter(g => g.curso === c.id).length;
    /* Evaluaciones aprobadas de cada curso: es lo que dice de verdad por dónde
       va, mejor que el número de lecciones. */
    const avance = (c) => {
      const conQ = c.modulos.filter(m => (m.preguntas || []).length);
      if (!conQ.length) return null;
      const ok = conQ.filter((m, i) => {
        const mi = c.modulos.indexOf(m);
        try { return (JSON.parse(localStorage.getItem('c4v_quiz_' + state.ctx + '_' + c.id + '-' + mi) || 'null') || {}).p >= 70; }
        catch { return false; }
      }).length;
      return { ok, total: conQ.length };
    };
    const disponibles = (a.cursos || []).filter(c => c.estado === 'disponible');
    const pronto = (a.cursos || []).filter(c => c.estado !== 'disponible');
    const pe = prepEstado();

    // La tarjeta de «Prepara tu espacio»: nunca tiene candado, es el candado.
    const tarjetaPrep = `
      <a class="destino destino-curso destino-prep" href="#/academia/prep">
        ${cursoIcono('prep')}
        <span class="destino-txt"><strong>Prepara tu espacio</strong>
          <small>${pe.total} pasos antes de que llegue tu máquina</small>
          <small class="destino-avance${pe.completo ? ' completo' : ''}">${pe.n} de ${pe.total} hechos</small></span>
        <span class="destino-flecha" aria-hidden="true">›</span>
      </a>`;

    return `
      <div class="destinos">
        ${tarjetaPrep}
        ${disponibles.map(c => {
          const g = nGuias(c);
          if (!pe.completo) {
            // Bloqueado: se ve el curso (para que sepas que existe y qué trae),
            // pero no se puede tocar hasta terminar el primero.
            return `<div class="destino destino-curso bloqueado" aria-disabled="true">
              ${c.img ? `<span class="destino-dibujo" aria-hidden="true"><img src="assets/academia/${esc(c.img)}" alt="" loading="lazy" onerror="this.parentElement.remove()"></span>` : cursoIcono(c.icono)}
              <span class="destino-txt"><strong>${esc(c.titulo)}</strong>
                <small>${nLec(c)} lecciones${g ? ` · ${g} guía${g > 1 ? 's' : ''}` : ''}</small>
                <small class="destino-candado-nota">Termina «Prepara tu espacio» primero</small></span>
              <span class="destino-candado" aria-hidden="true">${icon('candado')}</span>
            </div>`;
          }
          return `<a class="destino destino-curso" href="#/academia/curso/${esc(c.id)}">
            ${c.img ? `<span class="destino-dibujo" aria-hidden="true"><img src="assets/academia/${esc(c.img)}" alt="" loading="lazy" onerror="this.parentElement.remove()"></span>` : cursoIcono(c.icono)}
            <span class="destino-txt"><strong>${esc(c.titulo)}</strong>
              <small>${nLec(c)} lecciones${g ? ` · ${g} guía${g > 1 ? 's' : ''}` : ''}</small>
              ${(() => { const v = avance(c); return v ? `<small class="destino-avance${v.ok === v.total ? ' completo' : ''}">${v.ok} de ${v.total} evaluaciones aprobadas</small>` : ''; })()}</span>
            <span class="destino-flecha" aria-hidden="true">›</span>
          </a>`;
        }).join('')}
      </div>
      ${pronto.length ? `<ul class="proximo">${pronto.map(c => `<li>${esc(c.titulo)}</li>`).join('')}</ul>` : ''}`;
  },

  /* ---------- La guía, una pantalla por paso ----------
     Antes era una sola página larga con todo a la vez y un «¿Cómo lo hago?» que
     había que pulsar en cada paso. Ahora se ve UN paso, con lo que hay que hacer
     escrito delante, y un solo botón para avanzar. */
  preparacion() {
    const d = state.db, p = d.preparacion, cli = currentClient();
    const done = (id) => { try { return localStorage.getItem('c4v_prep_' + state.ctx + '_' + id) === '1'; } catch { return false; } };
    const total = p.checklist.length;
    const hechos = p.checklist.filter(c => done(c.id)).length;

    if (hechos === total && !state.revisando) {
      return `
        <div class="paso-fin">
          <img class="fin-toro" src="assets/cevi/gracias.png" width="200" height="186" loading="lazy" alt="" aria-hidden="true" decoding="async">
          <h2>Tu espacio está listo</h2>
          <p>Ya puedes recibir tu máquina con confianza. El resto de la Academia ya está destrabado.</p>
          <a class="btn primary" href="#/academia">Ver los cursos de la Academia</a>
          <button type="button" class="paso-link" id="verGuia">Volver a ver la guía</button>
          ${modoDemo() ? '<button type="button" class="paso-link" id="reiniciarPasos">Empezar la guía de cero (demostración)</button>' : ''}
        </div>`;
    }

    // Se abre por el primer paso sin marcar, salvo que el cliente navegue a otro.
    if (state.paso == null || state.paso < 0 || state.paso >= total) {
      const i = p.checklist.findIndex(c => !done(c.id));
      state.paso = i === -1 ? 0 : i;
    }
    const n = state.paso, c = p.checklist[n], hecho = done(c.id);

    const compras = c.lista ? `
      <div class="lista paso-compras">
        ${p.compras.map((x, k) => `
          <article class="lista-fila">
            <div class="lista-num" aria-hidden="true">${k + 1}</div>
            <div class="lista-dibujo">
              ${x.img ? `<img src="assets/compras/${esc(x.img)}" alt="Dibujo de ${esc(x.item)}" loading="lazy" onerror="this.remove()">` : ''}
            </div>
            <div class="lista-txt">
              <h3>${esc(x.item)}</h3>
              <p class="spec">${esc(x.spec)}</p>
              <p class="donde">Se consigue en ${esc((x.donde || '').toLowerCase() || 'ferreterías')}</p>
            </div>
          </article>`).join('')}
      </div>` : '';

    return `
      <section class="paso">
        <p class="paso-cuenta">Paso ${n + 1} de ${total}</p>
        <div class="paso-barra"><i style="width:${Math.round((n + 1) / total * 100)}%"></i></div>

        <h2 class="paso-titulo">${esc(c.t)}</h2>

        ${c.img ? `<figure class="paso-dibujo"><img src="assets/prep/${esc(c.img)}" alt="Dibujo: ${esc(c.t)}" onerror="this.closest('.paso-dibujo').remove()"></figure>` : ''}

        <ul class="paso-detalle">${(c.detalle || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul>

        ${compras}

        <!-- Flechas grandes a los lados y la marca en medio: se pasa de paso con
             el pulgar y se puede marcar y desmarcar sin salir de la pantalla. -->
        <div class="paso-nav">
          <button type="button" class="paso-flecha" data-ir="${n - 1}" ${n === 0 ? 'disabled' : ''} aria-label="Paso anterior">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>
          </button>
          <button type="button" class="paso-marca${hecho ? ' hecho' : ''}" data-paso="${esc(c.id)}" aria-pressed="${hecho}">
            <span class="paso-marca-ic" aria-hidden="true">${hecho ? '✓' : ''}</span>
            <span>${hecho ? 'Hecho' : 'Marcar como hecho'}</span>
          </button>
          <button type="button" class="paso-flecha" data-ir="${n + 1}" ${n === total - 1 ? 'disabled' : ''} aria-label="Paso siguiente">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>
          </button>
        </div>
      </section>`;
  },

  /* Página propia de CeVi. Es el mismo asistente que el botón flotante, con los
     mismos ids, así que todo lo que ya funciona sirve tal cual. Aquí el orbe se
     lleva la pantalla, que es lo que pidió el modo voz. */
  /* ---------- El asistente ----------
     Antes era una pantalla dispersa: un orbe enorme en medio, el estado suelto,
     tres enlaces para cambiar de modo y los mensajes perdidos abajo. En un
     teléfono no cabía nada. Ahora es lo que la gente ya sabe usar: la
     conversación ocupa la pantalla y abajo hay una sola barra con el micrófono
     y el campo de texto. */
  cevi() {
    const cli = currentClient();
    const nombre = primerNombre(cli?.nombre);
    return `
      <section class="chat" id="ceviPagina" data-cevi-estado="reposo">
        <div class="chat-hilo" id="ceviMsgs" role="log" aria-live="polite" aria-label="Conversación con CeVi"></div>

        <p class="chat-aviso" id="ceviAviso" role="status" hidden></p>

        <div class="chat-abajo">
          <div class="chat-sug" id="ceviSug">
            ${['¿Con qué potencia corto MDF de 3 mm?', '¿Cada cuánto cambio el agua del chiller?', 'Mi láser dejó de cortar bien']
              .map(q => `<button type="button" class="chip" data-q="${esc(q)}">${esc(q)}</button>`).join('')}
          </div>

          <p class="chat-estado" id="ceviEstadoTxt" aria-live="polite"></p>

          <form class="chat-barra" id="ceviForm">
            <button type="button" class="chat-mic" id="ceviMic" aria-label="Hablar con CeVi">
              ${CEVI_ICONOS.mic}
            </button>
            <input id="ceviInput" type="text" autocomplete="off" enterkeyhint="send"
                   placeholder="${nombre ? `Escribe o toca el micrófono, ${esc(nombre)}` : 'Escribe o toca el micrófono'}"
                   aria-label="Tu pregunta para CeVi">
            <button type="submit" class="chat-enviar" aria-label="Enviar">${CEVI_ICONOS.enviar}</button>
          </form>

          <p class="chat-pie">CeVi responde con inteligencia artificial. Si el tema es serio, te pasamos con una persona.</p>
        </div>

        <!-- Modo voz: solo el toro, como los asistentes de voz que la gente ya
             conoce. Se abre al tocar el micrófono y se cierra con la equis; la
             conversación queda escrita detrás, en el chat. -->
        <div class="voz" id="ceviModoVoz" hidden>
          <button type="button" class="voz-orbe" id="ceviVozOrbe" aria-label="Hablar con CeVi">${orbeHTML('gigante')}</button>
          <p class="voz-txt" id="ceviVozTxt" aria-live="polite"></p>
          <div class="voz-botones">
            <button type="button" class="voz-btn voz-mic" id="ceviVozMic" aria-label="Hablar">${CEVI_ICONOS.mic}</button>
            <button type="button" class="voz-btn voz-cerrar" id="ceviVozCerrar" aria-label="Salir del modo voz">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
            </button>
          </div>
        </div>
      </section>`;
  },

  soporte() {
    const d = state.db, cli = currentClient(), sop = d.soporte, faqs = d.faqs || [];
    const maq = cli ? d.maquinas.find(x => x.cliente_id === cli.id) : null;
    const wa = () => `<svg class="wa-ic" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.5 14.4c-.3-.2-1.7-.9-2-1-.3-.1-.5-.1-.6.2-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1-.3-.2-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.5-.5c.1-.2.2-.3.3-.5v-.5c-.1-.2-.6-1.6-.9-2.2-.2-.5-.4-.4-.6-.5h-.5c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1.1 2.8 1.2 3c.2.2 2.1 3.2 5.1 4.4 1.9.8 2.6.9 3.5.7.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3z"/><path d="M12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.4 1.3 4.9L2 22l5.3-1.4c1.4.8 3 1.2 4.7 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3.1.8.8-3-.2-.3c-.9-1.4-1.3-3-1.3-4.6C3.5 7.3 7.3 3.5 12 3.5S20.5 7.3 20.5 12 16.7 20.2 12 20.2z"/></svg>`;
    // Identifica al cliente y su máquina con lo que EXISTE (hoy Odoo no guarda la serie).
    const refMaq = maq?.serie || (maq?.modelo ? `modelo ${maq.modelo}` : '');
    const contexto = [cli ? `Soy ${nombrePropio(cli.nombre)}` : null, refMaq ? `máquina ${refMaq}` : null].filter(Boolean).join(', ');
    const waSoporte = (motivo) => waLink(`Hola equipo C4V${contexto ? `. ${contexto}` : ''}. ${motivo}`);

    return `
      <!-- Una sola puerta, bien grande: hablar con una persona por WhatsApp -->
      <a class="wa-big" href="${waSoporte('Necesito ayuda con mi máquina.')}" target="_blank" rel="noopener">
        ${wa()}
        <div class="wa-txt"><strong>Escríbenos por WhatsApp</strong><span>${esc(sop.whatsapp)}, ${esc(sop.horario.toLowerCase())}</span></div>
      </a>

      <h2 class="section-h">Problemas más comunes</h2>
      <div id="guiaList">
        ${d.soporte_guia.map(g => `<div class="faq-item guia"><button type="button" class="faq-q" aria-expanded="false"><span>${esc(g.titulo)}</span><span class="chev" aria-hidden="true">+</span></button>
          <div class="faq-a"><p style="margin:0 0 6px"><strong>Qué pasa:</strong> ${esc(g.sintoma)}</p>
          <p style="margin:0 0 6px"><strong>Por qué:</strong> ${esc(g.causas)}</p>
          <p style="margin:0 0 12px"><strong>Qué hacer:</strong> ${esc(g.accion)}</p>
          <a class="wa-inline" href="${waSoporte(`Sigo con este problema: «${g.titulo}».`)}" target="_blank" rel="noopener">${wa()}<span>Sigo igual, quiero escribir por WhatsApp</span></a></div></div>`).join('')}
      </div>

      ${faqs.length ? `
      <!-- Las 32 preguntas dejaban la pantalla con 40 botones. Ahora van
           detrás de uno solo: quien las necesita las abre.
           Y ya adentro, sueltas eran 32 títulos parecidos en fila — imposible
           de escanear. Se agrupan por tema (dato que ya traían y no se usaba).
           "Instalación"/"Envío e instalación" y "Garantía"/"Garantía y soporte"
           son el mismo tema con dos nombres en los datos: se fusionan aquí,
           en la vista, sin tocar la fuente. -->

      <h2 class="section-h">Preguntas frecuentes</h2>
      <button type="button" class="btn ghost" id="verFaqs" aria-expanded="false" aria-controls="faqTodas">Ver las ${faqs.length} preguntas</button>
      <div id="faqTodas" hidden>
        ${(() => {
          const ALIAS_TEMA = { 'Instalación': 'Envío e instalación', 'Garantía': 'Garantía y soporte' };
          const grupos = [];
          faqs.forEach(f => {
            const tema = ALIAS_TEMA[f.categoria] || f.categoria || 'Otras preguntas';
            let g = grupos.find(x => x.tema === tema);
            if (!g) { g = { tema, items: [] }; grupos.push(g); }
            g.items.push(f);
          });
          return grupos.map(g => `
            <h3 class="faq-tema">${esc(g.tema)}</h3>
            ${g.items.map(f => `<div class="faq-item">
              <button type="button" class="faq-q" aria-expanded="false"><span>${esc(f.pregunta)}</span><span class="chev" aria-hidden="true">+</span></button>
              <div class="faq-a">${esc(f.respuesta)}</div>
            </div>`).join('')}`).join('');
        })()}
      </div>` : ''}
`;
  },

  bolsa() {
    return `
      <!-- Sin filtros por país ni botón de publicar: eran ocho controles para
           una lista que casi siempre está vacía. Cuando haya muchos encargos,
           el filtro vuelve. -->
      <div class="page-head">
        <p>Nos escriben personas buscando quién les corte algo. Sus encargos se publican aquí. Toma el que quieras y verás su contacto.</p></div>
      ${state.db.leads.length
        ? `<div class="list" id="leadList">${leadRows(state.db.leads)}</div>`
        : `<div class="card vacio" id="leadList">
             <h3>Todavía no hay trabajos publicados</h3>
             <p>${state.leadsCargados === false && !modoDemo()
                 ? 'No pudimos cargar los trabajos en este momento. Vuelve a intentarlo en un rato.'
                 : 'Cuando alguien nos pida un servicio de corte, lo publicamos aquí y podrás tomarlo. Vuelve a mirar en unos días.'}</p>
             <a class="btn ghost sm" href="${waLink('Hola, quiero que me avisen cuando publiquen trabajos en la Bolsa de C4V.')}" target="_blank" rel="noopener">Avísenme cuando haya trabajos</a>
           </div>`}
`;
  },

  /* Era una página de 3264px con siete tarjetas que decían "Muy pronto" y ni un
     botón: se entraba desde el inicio y no se podía hacer nada. Ahora es una
     pantalla honesta, corta, con una sola acción: avisarnos de que lo quieres. */
  plantillas() {
    const cli = currentClient();
    const cats = (state.db.plantillas?.categorias || []).map(c => c.categoria);
    const wa = waLink(`Hola, soy ${cli ? nombrePropio(cli.nombre) : 'cliente C4V'}. Avísenme cuando esté listo el Banco de Diseños.`);
    return `
      <div class="page-head">
        <p>Diseños listos para cortar, incluidos con tu máquina. Todavía los estamos preparando.</p>
      </div>
      ${cats.length ? `
      <h2 class="section-h">Lo que vas a encontrar</h2>
      <ul class="proximo">${cats.map(c => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
      <div class="help-card" style="margin-top:24px">
        <div class="grow"><h3>Te avisamos en cuanto estén</h3>
          <p>Escríbenos y te escribimos el día que los publiquemos.</p></div>
        <a class="btn primary sm" href="${wa}" target="_blank" rel="noopener">Avísame por WhatsApp</a>
      </div>`;
  },

  certificado() {
    const ci = state.db.certificado_info;
    const cli = currentClient();
    const maqs = cli ? state.db.maquinas.filter(x => x.cliente_id === cli.id) : (state.db.maquinas[0] ? [state.db.maquinas[0]] : []);

    // Verificación por Nº de serie: la serie es la llave del certificado.
    // Si algún día el certificado tiene una URL pública (certificado.url), se enlaza.
    const certMaq = (m) => {
      const cert = m.certificado || {};
      const ok = cert.estado === 'certificada';
      // 'desconocido' NO es lo mismo que "en revisión": significa que el dato aún
      // no vive en Odoo. Decir "la estamos calibrando" sería inventar un estado.
      const enRevision = cert.estado === 'en_revision' || cert.estado === 'en_proceso';
      const insignia = ok ? '<span class="badge ok">Certificada ✓</span>'
        : enRevision ? '<span class="badge warn">En revisión y calibración</span>'
        : '<span class="badge grey">Estado por confirmar</span>';
      const meta = ok
        ? (cert.fecha ? `<p class="cert-maq-meta">Certificada el ${esc(cert.fecha)}${cert.tecnico ? ` por ${esc(nombrePropio(cert.tecnico))}` : ''}</p>` : '')
        : enRevision ? '<p class="cert-maq-meta">La estamos probando y calibrando antes de entregártela.</p>'
        : `<p class="cert-maq-meta">Todavía no tenemos el estado de esta máquina. <a href="${waLink(`Hola, quiero saber el estado del Certificado de Calidad de mi máquina${m.modelo ? ' ' + m.modelo : ''}${m.pedido ? ' (pedido ' + m.pedido + ')' : ''}.`)}" target="_blank" rel="noopener">Pregúntanos por WhatsApp</a> y te lo confirmamos.</p>`;
      const publico = cert.url
        ? `<a class="cert-verif-link" href="${esc(cert.url)}" target="_blank" rel="noopener">Ver el certificado público</a>` : '';
      // La serie es la llave del certificado. Hoy Odoo no la guarda para la
      // mayoría: en vez de una caja vacía con un botón que no copia nada, se
      // muestra la referencia que SÍ existe (el número de pedido).
      const bloqueSerie = m.serie
        ? `<div class="cert-serie">
             <span class="cert-serie-lbl">Nº de serie (el código de tu máquina)</span>
             <div class="cert-serie-row">
               <code class="cert-serie-num">${esc(m.serie)}</code>
               <button type="button" class="cert-copy btn ghost sm" data-copy="${esc(m.serie)}" aria-label="Copiar Nº de serie">Copiar</button>
             </div>
           </div>`
        : `<div class="cert-serie sin-serie">
             <span class="cert-serie-lbl">Nº de serie</span>
             <p class="muted" style="margin:4px 0 0;font-size:14px">Todavía no lo tenemos registrado.${m.pedido ? ` Mientras tanto, tu referencia es el pedido <code>${esc(m.pedido)}</code>.` : ''}</p>
           </div>`;
      return `<div class="card cert-maq">
        <div class="cert-maq-top">
          <h3>Láser ${esc(m.modelo || 'C4V')}</h3>
          ${insignia}
        </div>
        ${bloqueSerie}
        ${meta}
        ${publico || (ok && m.serie ? '<p class="cert-verif-note muted">Verifica tu máquina con este Nº de serie ante nuestro equipo por WhatsApp cuando lo necesites.</p>' : '')}
      </div>`;
    };

    return `
      <div class="cert-hero">
        <div class="cert-seal">${SEAL}</div>
        <div><h2 class="cert-hero-t">${esc(ci.nombre)}</h2>
          <p class="cert-lema">«${esc(ci.lema)}»</p></div>
      </div>

      ${maqs.length ? `<h2 class="section-h">${maqs.length > 1 ? 'Tus máquinas' : 'Tu máquina'}</h2>
      <div class="cert-maq-grid">${maqs.map(certMaq).join('')}</div>` : ''}

      <h2 class="section-h">Qué garantiza</h2>
      <div class="card"><ul class="ulist">${ci.promesa.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>

      <h2 class="section-h">Preguntas frecuentes</h2>
      ${ci.faq.map(f => `<div class="faq-item"><button type="button" class="faq-q" aria-expanded="false"><span>${esc(f.q)}</span><span class="chev" aria-hidden="true">+</span></button><div class="faq-a">${esc(f.a)}</div></div>`).join('')}`;
  }
};

function leadRows(leads) {
  if (!leads.length) return '<div class="empty">No hay solicitudes con ese filtro.</div>';
  const cli = currentClient();
  return leads.map(l => {
    // Privacidad: el contacto solo lo ve el cliente que tomó el trabajo
    const puedeVer = l.estado === 'tomado' && cli && l.tomado_por === cli.id;
    const contacto = puedeVer
      ? `<div class="contact-box"><span class="lbl">Contacto</span><strong>${esc(l.contacto)}</strong>${l.telefono ? `<div class="muted">${esc(l.telefono)}</div>` : ''}</div>`
      : (l.estado === 'nuevo' ? `<div class="contact-box"><span class="lbl">Contacto</span><span class="muted" style="font-size:12.5px">Se muestra al tomar el trabajo</span></div>` : '');
    return `<div class="row-card">
    <div class="grow"><h4>${esc(l.titulo)} ${l.estado === 'nuevo' ? '<span class="badge ok">Disponible</span>' : '<span class="badge grey">Tomado</span>'}</h4>
      <p style="margin:4px 0;color:var(--muted);font-size:14px">${esc(l.descripcion)}</p>
      <div class="meta"><span class="pill-pais">${l.pais}</span><span>${esc(l.ciudad)}</span><span>${esc(l.material)}</span><span>${esc(l.cantidad)}</span></div></div>
    <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end">
      ${contacto}
      ${l.estado === 'nuevo' ? `<button class="btn primary sm" data-take="${esc(l.id)}">Tomar trabajo</button>` : ''}
    </div></div>`;
  }).join('');
}
function bindTake() {
  view.querySelectorAll('[data-take]').forEach(b => b.onclick = async () => {
    const cli = currentClient();
    if (!cli) { toast('Entra con tu documento para tomar este trabajo'); return; }
    try { await actions.tomarLead(b.dataset.take, cli.id); toast(state.offline ? 'Trabajo tomado (demostración: el contacto es de ejemplo)' : '🎉 ¡Trabajo tomado! Contacta al cliente'); render('bolsa'); } catch { toast('⚠️ Ese trabajo ya fue tomado'); }
  });
}

// ---------- interacciones ----------
function bindAccordions(sel) { view.querySelectorAll(sel).forEach(it => { const q = it.querySelector('.faq-q, .course-head'); if (q) q.onclick = () => { const open = it.classList.toggle('open'); q.setAttribute('aria-expanded', open); }; }); }
function bind(route) {
  view.querySelectorAll('[data-cevi]').forEach(b => b.onclick = () => { location.hash = '#/cevi'; });
  /* En el asistente la conversación se queda con la pantalla entera: sin pie
     ni títulos que empujen la barra de escribir fuera de la vista. */
  document.body.classList.toggle('ruta-cevi', route === 'cevi');
  // El alto real de la barra superior, medido: así el chat encaja exacto sea
  // cual sea el teléfono, en vez de restar un número escrito a mano.
  const barra = document.querySelector('.topbar');
  if (barra) document.documentElement.style.setProperty('--alto-menu', barra.offsetHeight + 40 + 'px');
  if (route === 'cevi') { ceviPaginaIniciar(); }
  else {
    // Al salir de la página, CeVi deja de escuchar y de hablar.
    cevi.manosLibres = false; cevi.abierto = false;
    ceviVozCerrar(); ceviCallar(); ceviParaVoz(); orbeParar();
  }
  if (route === 'academia' && state.sub.startsWith('curso/')) {
    bindGuias(); bindQuizzes(); bindLeccion();
  }
  const salir = $('#salirCuenta');
  if (salir) salir.onclick = () => { const b = $('#logoutBtn'); if (b) b.click(); };
  /* "Prepara tu espacio" vive en dos sitios con el mismo HTML y el mismo
     cableado: la ruta vieja `#/preparacion` (por si alguien la tiene guardada)
     y la nueva, dentro de Academia (`#/academia/prep`, primer curso). */
  if (route === 'preparacion' || (route === 'academia' && state.sub === 'prep')) {
    // `route` aquí ya viene sin su subruta (render() lo recorta a la base):
    // hay que reconstruir la ruta completa o el siguiente render() pierde el "prep".
    const rutaProp = route === 'academia' ? 'academia/prep' : 'preparacion';
    /* La marca se puede poner y quitar: alguien que se equivocó tiene que poder
       corregirlo sin empezar de cero. Al marcar el último que faltaba, se cierra
       la guía; en cualquier otro caso avanza al siguiente. */
    view.querySelectorAll('.paso-marca').forEach(b => b.onclick = () => {
      const id = b.dataset.paso;
      const clave = 'c4v_prep_' + state.ctx + '_' + id;
      let estaba = false;
      try { estaba = localStorage.getItem(clave) === '1'; } catch {}
      try { estaba ? localStorage.removeItem(clave) : localStorage.setItem(clave, '1'); } catch {}

      const lista = state.db.preparacion.checklist, total = lista.length;
      const hechos = lista.filter(c => { try { return localStorage.getItem('c4v_prep_' + state.ctx + '_' + c.id) === '1'; } catch { return false; } }).length;
      if (!estaba) {
        if (hechos === total) { state.paso = null; state.revisando = false; }
        else state.paso = Math.min(state.paso + 1, total - 1);
      }
      render(rutaProp); window.scrollTo(0, 0);
    });
    view.querySelectorAll('[data-ir]').forEach(b => b.onclick = () => {
      state.paso = Number(b.dataset.ir);
      render(rutaProp); window.scrollTo(0, 0);
    });
    /* Repasar la guía después de terminarla: se entra en modo revisión, que es
       lo único que permite ver los pasos con todo marcado. Antes el enlace no
       hacía nada visible y parecía roto. */
    const ver = $('#verGuia');
    if (ver) ver.onclick = () => { state.revisando = true; state.paso = 0; render(rutaProp); window.scrollTo(0, 0); };
    // Solo en demostración: deja la cuenta como recién llegada, para poder probar.
    const cero = $('#reiniciarPasos');
    if (cero) cero.onclick = () => {
      state.db.preparacion.checklist.forEach(c => { try { localStorage.removeItem('c4v_prep_' + state.ctx + '_' + c.id); } catch {} });
      state.revisando = false; state.paso = 0;
      render(rutaProp); window.scrollTo(0, 0);
      toast('Avance borrado. La guía vuelve a empezar.');
    };
  }
  if (route === 'certificado' || (route === 'cuenta' && state.sub === 'certificado')) {
    bindAccordions('.faq-item');
    // Copiar el Nº de serie (llave de verificación del certificado)
    view.querySelectorAll('[data-copy]').forEach(b => b.onclick = async () => {
      const txt = b.dataset.copy;
      try {
        if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(txt);
        else { const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
        toast('Nº de serie copiado');
      } catch { toast('No se pudo copiar — cópialo manualmente'); }
    });
  }
  if (route === 'soporte') {
    bindAccordions('.faq-item');
    const ver = $('#verFaqs'), todas = $('#faqTodas');
    if (ver && todas) ver.onclick = () => {
      const abierto = todas.hidden;
      todas.hidden = !abierto;
      ver.setAttribute('aria-expanded', abierto);
      ver.textContent = abierto ? 'Ocultar las preguntas' : `Ver las ${(state.db.faqs || []).length} preguntas`;
    };
  }
  if (route === 'bolsa') {
    // Sin filtros ni formulario de publicar: la pantalla solo lista y deja tomar.
    bindTake();
  }
}

// ---------- lecciones en video (Academia) ----------
/* Las guías en PDF también son contenido pagado: se piden firmadas en el
   momento, no cuelgan de una URL pública. */
function bindGuias() {
  view.querySelectorAll('[data-guia]').forEach(b => {
    b.onclick = async () => {
      const etiqueta = b.querySelector('.destino-txt small');
      const original = etiqueta.textContent;
      etiqueta.textContent = 'Preparando…';
      /* Con sesión real, la guía sale firmada y caduca desde la API. Mientras el
         portal siga en demo no hay sesión que firmar, así que se abre la copia
         pública. Al activar la verificación real, esto se cierra solo. */
      const url = await enlaceMedio('guias', b.dataset.guia) || `guias/${b.dataset.guia}`;
      etiqueta.textContent = original;
      window.open(url, '_blank', 'noopener');
    };
  });
}

function bindLeccion() {
  // «Siguiente» marca la lección como vista y avanza.
  view.querySelectorAll('.lec-siguiente[data-vista]').forEach(b => b.addEventListener('click', () => {
    try { localStorage.setItem(b.dataset.vista, '1'); } catch {}
  }));
  // El video se monta de una vez: en una pantalla que ES el video no hay nada que plegar.
  view.querySelectorAll('.lec-video-caja').forEach(caja => {
    const archivo = caja.dataset.video, box = caja.querySelector('.lv-player');
    box.hidden = false;
    box.innerHTML = `<video controls playsinline preload="metadata" controlsList="nodownload">
        <source src="videos/c4vtech/${esc(archivo)}" type="video/mp4">
        Tu navegador no puede reproducir este video.
      </video>`;
    const vid = box.querySelector('video');
    vid.ontimeupdate = () => {
      if (vid.duration && vid.currentTime / vid.duration > 0.8) {
        try { localStorage.setItem('c4v_video_' + state.ctx + '_' + archivo, '1'); } catch {}
      }
    };
  });
  // La evaluación en su propia pantalla arranca sola, sin botón previo.
  // Si ya la aprobaste, se queda escondida: no tiene sentido gastar trabajo
  // preparando una pregunta que nadie va a ver.
  view.querySelectorAll('.quiz-box.auto').forEach(box => {
    if (box.hidden) return;
    const start = box.querySelector('.qz-start');
    if (start && start.onclick) start.onclick();
  });
  // «Volver a intentarla»: cambia el resumen por la evaluación de verdad.
  view.querySelectorAll('.quiz-reintentar').forEach(b => b.onclick = () => {
    const hecho = b.closest('.quiz-hecho'), box = hecho.nextElementSibling;
    hecho.hidden = true;
    box.hidden = false;
    const start = box.querySelector('.qz-start');
    if (start && start.onclick) start.onclick();
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

// ---------- quizzes interactivos (Academia) ----------
// Fisher-Yates: el orden de las opciones cambia en cada intento, así la respuesta
// correcta no queda siempre en la misma posición (varios módulos la tenían fija).
function barajar(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
// Barra segmentada tipo Duolingo: un tramo por pantalla, no una barra continua.
// `hechos` es cuántos tramos ya se pasaron (se pintan llenos junto con el actual).
function segbar(total, hechos) {
  let out = '<div class="paso-segbar">';
  for (let i = 0; i < total; i++) out += `<i${i < hechos ? ' class="hecho"' : ''}></i>`;
  return out + '</div>';
}
// Sube el scroll al tope del contenido del paso, no de toda la ventana: en el
// quiz cada pregunta reemplaza el DOM en el mismo lugar (no hay cambio de ruta
// que dispare el reset normal de render()), así que si no se hace a mano la
// pantalla se queda donde estaba con la pregunta nueva fuera de vista.
function subirAlPaso() {
  const s = view.querySelector('.paso') || view;
  s.scrollIntoView({ block: 'start' });
}
function bindQuizzes() {
  view.querySelectorAll('.quiz-box').forEach(box => {
    const curso = state.db.academia.cursos.find(c => c.id === box.dataset.curso);
    const mod = curso?.modulos[Number(box.dataset.mod)];
    if (!mod) return;
    // Mismo filtro de robustez que en el render: funciona para c0, c3 y cualquier curso nuevo.
    const preguntas = (mod.preguntas || []).filter(p => p && p.q && Array.isArray(p.opciones) && p.opciones.length);
    if (!preguntas.length) return;
    const area = box.querySelector('.qz-area'), start = box.querySelector('.qz-start');
    const total = preguntas.length;
    let idx = 0, puntos = 0, fallas = [];

    const preguntar = () => {
      const p = preguntas[idx];
      area.innerHTML = `
        ${segbar(total, idx)}
        <div class="qz-q">${esc(p.q)}</div>
        <div class="qz-opts">${barajar(p.opciones.map((_, i) => i)).map(i => `<button type="button" class="qz-opt" data-i="${i}">${esc(p.opciones[i])}</button>`).join('')}</div>
        <div class="qz-ex" hidden></div>`;
      area.querySelectorAll('.qz-opt').forEach(b => b.onclick = () => {
        const elegido = Number(b.dataset.i), acierto = elegido === p.ok;
        if (acierto) puntos++;
        else fallas.push({ q: p.q, tuya: p.opciones[elegido], correcta: p.opciones[p.ok], ex: p.ex });
        area.querySelectorAll('.qz-opt').forEach(x => {
          x.disabled = true;
          if (Number(x.dataset.i) === p.ok) x.classList.add('ok');
          else if (Number(x.dataset.i) === elegido) x.classList.add('bad');
        });
        const ex = area.querySelector('.qz-ex');
        ex.hidden = false;
        ex.className = 'qz-ex ' + (acierto ? 'bien' : 'mal');
        ex.innerHTML = `<strong>${acierto ? 'Correcto' : 'No era esa'}</strong><span>${esc(p.ex)}</span>
          <div class="paso-nav qz-nav"><button type="button" class="btn primary qz-next">${idx + 1 < total ? 'Siguiente pregunta' : 'Ver mi resultado'}</button></div>`;
        ex.querySelector('.qz-next').onclick = () => { idx++; idx < total ? preguntar() : terminar(); subirAlPaso(); };
        ex.querySelector('.qz-next').focus();
      });
      subirAlPaso();
    };

    const terminar = () => {
      const pct = Math.round(puntos / total * 100), paso = pct >= 70;
      try {
        const k = 'c4v_quiz_' + state.ctx + '_' + box.dataset.key;
        const prev = JSON.parse(localStorage.getItem(k) || 'null');
        if (!prev || puntos > prev.b) localStorage.setItem(k, JSON.stringify({ b: puntos, n: total, p: pct }));
      } catch {}
      // Sin el detalle de qué se falló, repasar es adivinar. Se muestra tu
      // respuesta junto a la correcta y la explicación, una por una.
      const repaso = fallas.length ? `
        <div class="qz-repaso">
          <p class="qz-repaso-tit">Repasa lo que fallaste:</p>
          ${fallas.map(f => `
            <div class="qz-repaso-item">
              <p class="qz-repaso-q">${esc(f.q)}</p>
              <p class="qz-repaso-tuya">Marcaste: ${esc(f.tuya)}</p>
              <p class="qz-repaso-ok">Era: ${esc(f.correcta)}</p>
              <p class="qz-repaso-ex">${esc(f.ex)}</p>
            </div>`).join('')}
        </div>` : '';
      area.innerHTML = `
        <div class="qz-fin ${paso ? 'ok' : ''}">
          <div class="qz-nota">${puntos} de ${total}</div>
          <p>${paso ? 'Dominas este módulo.' : 'Repasa las lecciones de arriba y vuelve a probar.'}</p>
        </div>
        ${repaso}
        <div class="paso-nav qz-nav">
          ${box.dataset.siguiente
            ? (paso ? `<a class="btn primary" href="${esc(box.dataset.siguiente)}">Siguiente</a><button type="button" class="paso-link qz-retry">Intentar de nuevo</button>`
                    : `<button type="button" class="btn primary qz-retry">Intentar de nuevo</button><a class="paso-link" href="${esc(box.dataset.siguiente)}">Seguir sin aprobar</a>`)
            : `<button type="button" class="btn primary qz-retry">Intentar de nuevo</button><button type="button" class="paso-link qz-cerrar">Cerrar</button>`}
        </div>`;
      const cerrar = area.querySelector('.qz-cerrar');
      if (cerrar) cerrar.onclick = () => { area.hidden = true; render('academia'); location.hash = '#/academia/curso/' + box.dataset.curso; };
      area.querySelector('.qz-retry').onclick = () => { idx = 0; puntos = 0; fallas = []; preguntar(); };
      subirAlPaso();
    };

    start.onclick = () => {
      const abierto = box.classList.contains('auto') ? false : !area.hidden;
      area.hidden = abierto;
      start.setAttribute('aria-expanded', String(!abierto));
      if (!abierto) {
        idx = 0; puntos = 0; preguntar();
        area.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
  });
}

// ---------- router ----------
/* Títulos cortos: los largos ("Aprender a usar mi máquina") no cabían en el
   menú ni en la cabecera del móvil. */
const TITLES = { inicio: 'Inicio', cuenta: 'Mi cuenta', cevi: 'Asistente', academia: 'Academia', preparacion: 'Primeros pasos', soporte: 'Necesito ayuda', bolsa: 'Trabajos para ti', plantillas: 'Diseños para cortar', certificado: 'Tu Certificado de Calidad' };
function render(route) {
  /* Las secciones pueden tener subpáginas: `#/academia/cursos`. Así cada una es
     una pantalla propia, con su título y su botón de atrás, y el botón «volver»
     del navegador funciona como la gente espera. */
  const [base, ...resto] = String(route).split('/');
  route = views[base] ? base : 'inicio';
  state.sub = route === base ? resto.join('/') : '';
  /* Candado de Academia: mientras «Prepara tu espacio» no esté al 100%, los
     demás cursos no se abren aunque se llegue por un enlace directo o el
     historial del navegador — se cae de vuelta a la lista, con la tarjeta
     bloqueada explicando por qué. El curso de preparación en sí nunca se
     bloquea: es el candado, no puede depender de sí mismo. */
  if (route === 'academia' && state.sub.startsWith('curso/') && !prepEstado().completo) {
    toast('Primero termina «Prepara tu espacio»');
    state.sub = '';
    if (location.hash !== '#/academia') location.hash = '#/academia';
  }
  document.querySelectorAll('.menu a').forEach(a => a.setAttribute('aria-current', a.dataset.nav === route ? 'page' : 'false'));
  // El título ya lo dice el menú; dentro solo hace falta el nombre de la página.
  let titulo = TITLES[route];
  if (route === 'academia' && state.sub.startsWith('curso/')) {
    const c = (state.db.academia.cursos || []).find(x => x.id === state.sub.split('/')[1]);
    if (c) titulo = c.titulo;
  }
  if (route === 'academia' && state.sub === 'prep') titulo = 'Prepara tu espacio';
  if (route === 'cuenta' && state.sub === 'certificado') titulo = TITLES.certificado;
  // Dentro de una lección la cabecera sobra: la pantalla ya dice dónde estás.
  const enLeccion = route === 'academia' && /^curso\/[^/]+\/p\//.test(state.sub);
  // Toda subpágina vuelve a la portada de su sección: un solo camino de vuelta.
  const atras = state.sub
    ? `<a class="volver" href="#/${route}"><span aria-hidden="true">←</span> ${esc(TITLES[route])}</a>`
    : '';
  const cabecera = route === 'inicio' ? '' : enLeccion ? atras : atras + `<h1 class="pag-title">${esc(titulo)}</h1>`;
  /* La ruta queda en el DOM: el CSS la necesita para subir el botón de CeVi
     cuando la barra del paso se pega abajo. */
  document.getElementById('app')?.setAttribute('data-ruta', route);
  view.innerHTML = cabecera + views[route](state.sub);
  const rutaVisto = (route === 'cuenta' && state.sub === 'certificado') ? 'certificado' : route;
  if (rutaVisto === 'certificado' || rutaVisto === 'soporte') { try { localStorage.setItem('c4v_visto_' + rutaVisto + '_' + state.ctx, '1'); } catch {} }
  bind(route); window.scrollTo(0, 0);
}
const currentRoute = () => (location.hash.replace('#/', '') || 'inicio');
window.addEventListener('hashchange', () => render(currentRoute()));
window.toast = toast;

// ---------- identidad: tu documento es tu llave ----------
/* persona → DNI / Cédula (CI) / RUN / Cédula (CC) según país.
   empresa → RUC / NIT / RUT según país.
   En Chile el documento de la persona es la Cédula de Identidad y su número es
   el RUN; el RUT es el tributario y es el de la empresa. El número coincide,
   pero el nombre no, y al cliente hay que pedirle el que dice su documento.
   Normalización: mayúsculas, solo dígitos y la K del dígito verificador. */
function normalizarDoc(raw) {
  return String(raw || '').toUpperCase().replace(/[^0-9K]/g, '');
}
function buscarClientePorDocumento(doc) {
  // Modo demo: busca en los datos locales (data.js). En producción se usa el
  // endpoint de verificación (ver verificarCliente).
  return state.db.clientes.find(c => normalizarDoc(c.documento) === doc) || null;
}

/* ---------- Verificación de cliente (demo local ↔ endpoint real) ----------
   Config en config.js → `verificacion` { activo, apiBase, endpoint } y
   `mostrarNumerosDemo`. Contrato del backend descrito en INTEGRACION_ODOO.md:
     GET {apiBase}{endpoint}?pais=PE&doc=45678123
       → { existe:true, cliente:{…}, maquinas:[…] }  |  { existe:false }
   El `cliente` y las `maquinas` vienen en la MISMA forma que data.js: no se
   transforma nada, solo se inyectan en state.db para que el resto del portal
   (currentClient, maquinas, tickets…) funcione igual que en demo. */
const VERIF = CFG.verificacion || {};
// Demo cuando la verificación NO está activa: se valida contra data.js.
const modoDemo = () => !VERIF.activo;

// Inserta/actualiza el cliente verificado y sus máquinas en la base en memoria.
function inyectarCliente(cliente, maquinas) {
  if (!cliente) return null;
  if (cliente.empresa_vendedora) state.empresaVendedora = cliente.empresa_vendedora;
  state.db.clientes = state.db.clientes || [];
  const i = state.db.clientes.findIndex(c => c.id === cliente.id);
  if (i >= 0) state.db.clientes[i] = cliente; else state.db.clientes.push(cliente);
  state.db.maquinas = state.db.maquinas || [];
  (maquinas || []).forEach(m => {
    const j = state.db.maquinas.findIndex(x => x.serie === m.serie);
    if (j >= 0) state.db.maquinas[j] = m; else state.db.maquinas.push(m);
  });
  return cliente;
}

/* Devuelve { estado:'ok', cliente } · { estado:'no_encontrado' } · { estado:'limite' } · { estado:'error' }.
   - modoDemo → valida contra data.js (comportamiento actual).
   - producción → llama al endpoint; existe:false = no_encontrado; red/503 = error. */
async function verificarCliente({ pais, doc }) {
  if (modoDemo()) {
    const cli = buscarClientePorDocumento(doc);
    return cli ? { estado: 'ok', cliente: cli } : { estado: 'no_encontrado' };
  }
  // Documento de ejemplo: ni siquiera en producción real llama al backend.
  // Sale de window.__SEED__ (data.js) directo, no de state.db: en producción
  // real el backend NO manda clientes de ejemplo mezclados con los reales.
  if (doc === DOC_DEMO) {
    const cli = (window.__SEED__?.clientes || []).find(c => normalizarDoc(c.documento) === doc) || null;
    if (cli && !state.db.clientes.some(c => c.id === cli.id)) {
      inyectarCliente(cli, (window.__SEED__?.maquinas || []).filter(m => m.cliente_id === cli.id));
    }
    return cli ? { estado: 'ok', cliente: cli, demo: true } : { estado: 'no_encontrado' };
  }
  // PII: el documento viaja en el BODY de un POST (no en la URL → no queda en
  // logs/proxies/historial). El backend rate-limita por IP; la decisión sobre
  // OTP (INTEGRACION_ODOO.md §9 SEGURIDAD) es de producto, previa a producción.
  const base = VERIF.apiBase || '';
  const ep = VERIF.endpoint || '/api/cliente';
  let r;
  try {
    r = await fetch(`${base}${ep}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pais: pais || '', doc }) });
  } catch { return { estado: 'error' }; }
  if (r.status === 429) return { estado: 'limite' };
  if (!r.ok) return { estado: 'error' };          // 400/503/… → no distinguir para el usuario
  let j;
  try { j = await r.json(); } catch { return { estado: 'error' }; }
  if (!j || !j.existe) return { estado: 'no_encontrado' };
  if (j.requiere_otp) return { estado: 'otp' };   // hace falta el código de WhatsApp
  return { estado: 'ok', cliente: inyectarCliente(j.cliente, j.maquinas) };
}

/* ---------- Sesión ----------
   Tras verificar el código se guarda un TOKEN firmado por el servidor, no el
   documento: si alguien lee el almacenamiento del navegador no obtiene el DNI, y
   el token vence solo. Se conserva `pais` únicamente para la ayuda en pantalla. */
function guardarSesion({ token, pais }) {
  try { localStorage.setItem('c4v_sesion', JSON.stringify({ t: token, pais: pais || null, exp: Date.now() + SESION_DIAS * 864e5 })); } catch {}
}
function leerSesion() {
  try {
    const s = JSON.parse(localStorage.getItem('c4v_sesion') || 'null');
    if (s && s.exp > Date.now() && s.t) return s;
    localStorage.removeItem('c4v_sesion');
  } catch {}
  return null;
}
function borrarSesion() { try { localStorage.removeItem('c4v_sesion'); } catch {} }

// Entra con un token ya emitido (visitas siguientes: sin volver a pedir código).
async function entrarConToken(token) {
  const base = VERIF.apiBase || '', ep = VERIF.endpoint || '/api/cliente';
  try {
    const r = await fetch(`${base}${ep}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    if (!r.ok) { if (r.status === 401) borrarSesion(); return { estado: 'error' }; }
    const j = await r.json();
    if (!j || !j.existe) { borrarSesion(); return { estado: 'no_encontrado' }; }
    return { estado: 'ok', cliente: inyectarCliente(j.cliente, j.maquinas) };
  } catch { return { estado: 'error' }; }
}

const waLink = (texto) => `https://wa.me/${CFG.whatsapp?.numero || ''}?text=${encodeURIComponent(texto || '')}`;
const docInfo = (paisCode, tipo) => {
  const p = (CFG.paises || []).find(x => x.code === paisCode) || (CFG.paises || [])[0];
  return (p && p[tipo]) || { doc: 'Documento', ej: '' };
};

async function entrar(cliente) {
  state.ctx = cliente.id;
  await cargarDatosVivos();
  pedirEstadoGuia();   // sin await: no debe retrasar la entrada
  $('#gate').hidden = true; $('#app').hidden = false;
  pintarPieLegal();   // ahora sabemos con qué empresa contrató
  const info = docInfo(cliente.pais, cliente.tipo || 'persona');
  $('#me').innerHTML = `<a class="me-link" href="#/cuenta"><span class="me-txt"><strong>${esc(nombrePropio(cliente.nombre))}</strong><span>${esc(info.doc)} ${esc(cliente.documento)}</span></span></a>`;
  // El cliente nuevo aterriza en «Prepara tu espacio», el primer curso de la
  // Academia: es lo que necesita hoy, y es el candado que abre el resto.
  let primeraVez = false;
  try {
    if (!localStorage.getItem('c4v_hola_' + cliente.id)) { localStorage.setItem('c4v_hola_' + cliente.id, '1'); primeraVez = true; }
  } catch {}
  const pe = prepEstado();
  // Mientras la guía no esté completa, siempre se entra por ella: es lo que el
  // cliente necesita hoy y lo que abre el resto de la Academia.
  if (!pe.completo) {
    location.hash = '#/academia/prep';
    setTimeout(() => toast(primeraVez
      ? `👋 ¡Hola${cliente.nombre ? ', ' + primerNombre(cliente.nombre) : ''}! Empieza por dejar tu espacio listo`
      : `📋 Vas ${pe.n} de ${pe.total} en tu preparación`), 500);
    render('academia/prep');
    return;
  }
  render(currentRoute());
}

/* ---------- Acceso en dos pasos ----------
   Paso A: documento + país + consentimiento.
   Paso B: el cliente nos escribe por WhatsApp (así demuestra que el número es
   suyo) y el bot le responde su código fijo (3 letras + 4 números) que teclea aquí.
   Si el servidor no exige código (OTP apagado), el paso A entra directo. */
const otpEstado = { solicitud: null, pais: null, sondeo: null, directo: false, faltan: 0 };

/* Estado del acceso, que ahora ocurre entero en una sola pantalla.
   En modo demostración no hay backend ni WhatsApp, pero el recorrido se ve
   igual; el código sale en pantalla y se dice que es una prueba. */
const acceso = { fase: 'doc', solicitud: null, pais: null, cliente: null, codigo: null };

/* Mientras el portal esté en demostración no hay WhatsApp que enviar, así que el
   código es fijo y conocido. La pantalla se ve exactamente igual que la final:
   nadie ajeno puede llegar aquí, porque en demostración solo existen los cinco
   clientes de ejemplo. Con `verificacion.activo: true` este valor no se usa
   nunca: el código lo genera el servidor y viaja por WhatsApp. */
const CODIGO_DEMO = 'DEM1234';   // mismo formato que el real: 3 letras + 4 números

/* Documento de ejemplo: aunque el portal esté en producción real, si alguien
   escribe este DNI entra por el recorrido de siempre pero SIN backend ni
   WhatsApp — para mostrar el flujo sin depender de que llegue un mensaje
   real. Inventado a propósito (no existe en Odoo ni en la base real), para
   no ocupar el documento de ningún cliente de verdad. Vive también como
   cliente en data.js (cli-006), con el mismo documento y teléfono. */
const DOC_DEMO = '00000000';

const PISTA_DIGITOS = 3;
const PREFIJOS_PAIS = { PE: '51', EC: '593', BO: '591', CL: '56', CO: '57' };

const digitosDe = (s) => String(s || '').replace(/\D/g, '');

// Número sin el prefijo del país: es el que la persona conoce de memoria.
function numeroNacional(tel, pais) {
  const d = digitosDe(tel);
  const p = PREFIJOS_PAIS[String(pais || '').toUpperCase()];
  return p && d.length > p.length && d.startsWith(p) ? d.slice(p.length) : d;
}

async function apiPost(ruta, cuerpo) {
  const base = VERIF.apiBase || '';
  const r = await fetch(`${base}${ruta}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo)
  });
  let j = null;
  try { j = await r.json(); } catch {}
  return { ok: r.ok, status: r.status, json: j || {} };
}

function mostrarPaso(cual) {
  $('#gatePasoDoc').hidden = cual !== 'doc';
  $('#gatePasoOtp').hidden = cual !== 'otp';
  if (cual === 'otp') setTimeout(() => $('#otpCodigo')?.focus(), 80);
}

/* ── El acceso, todo en una sola pantalla ───────────────────────────────────
   El formulario crece: primero el documento, después el WhatsApp completo,
   después el código. Lo ya escrito se queda a la vista pero bloqueado, para que
   la persona no pierda de vista dónde está. Sin pantallas nuevas. */
/* La pista se ve dentro del campo, como marca de agua: ••••••321. Mostrar un
   número de ejemplo completo confundía, porque parecía el suyo ya escrito. */
function pistaEnCampo(cola) {
  const el = $('#gateTel');
  if (el) el.placeholder = '•'.repeat(6) + (cola || '');
}

function faseAcceso(fase) {
  acceso.fase = fase;
  const tel = $('#gateTelBloque'), cod = $('#gateCodBloque'), btn = $('#gateForm .gate-btn');
  tel.hidden = fase === 'doc';
  cod.hidden = fase !== 'cod';
  if (fase === 'tel') {
    const cod2 = $('#gateTelCod');
    if (cod2) cod2.textContent = '+' + (PREFIJOS_PAIS[String(acceso.pais || '').toUpperCase()] || '');
  }

  // Lo anterior se bloquea: ya cumplió su parte.
  $('#gateDoc').disabled = fase !== 'doc';
  $('#gateTel').disabled = fase !== 'tel';
  $('#gateTipos').classList.toggle('bloqueado', fase !== 'doc');
  $('#gatePaises').classList.toggle('bloqueado', fase !== 'doc');
  // Ya aceptó: las casillas dejan de ocupar sitio en las pantallas siguientes.
  $('#gateConsentimiento').hidden = fase !== 'doc';

  btn.textContent = { doc: 'Ingresar', tel: 'Enviarme el código', cod: 'Entrar' }[fase];
  const foco = { tel: '#gateTel', cod: '#gateCod' }[fase];
  if (foco) setTimeout(() => $(foco)?.focus(), 80);
}

function detenerSondeo() {
  if (otpEstado.sondeo) { clearInterval(otpEstado.sondeo); otpEstado.sondeo = null; }
}

// Pregunta al servidor si el bot ya respondió con el código (para guiar al cliente).
function sondearEstado() {
  detenerSondeo();
  const base = VERIF.apiBase || '';
  let intentos = 0;
  otpEstado.sondeo = setInterval(async () => {
    intentos++;
    if (!otpEstado.solicitud || intentos > 60) return detenerSondeo();   // ~3 minutos
    try {
      const r = await fetch(`${base}/api/otp/estado?solicitud=${encodeURIComponent(otpEstado.solicitud)}`);
      const j = await r.json();
      const el = $('#otpEstado');
      if (!el) return detenerSondeo();
      if (j.estado === 'enviado') {
        el.textContent = '✅ Ya te enviamos el código por WhatsApp. Escríbelo aquí.';
        el.classList.add('ok');
        detenerSondeo();
      } else if (j.estado === 'vencida') {
        el.textContent = '⌛ Pasaron más de 3 minutos. Pide un código nuevo.';
        detenerSondeo();
      }
    } catch { /* reintenta en el siguiente tic */ }
  }, 3000);
}

function pintarPasoOtp(datos, pais) {
  otpEstado.solicitud = datos.solicitud;
  otpEstado.pais = pais;
  $('#otpPista').textContent = datos.telefono_pista || '';
  $('#otpWa').href = datos.wa_link;
  $('#otpTextoManual').textContent = datos.texto || '';
  $('#otpNumero').textContent = CFG.whatsapp?.visible || '';
  $('#otpCodigo').value = '';
  $('#otpError').hidden = true;
  const est = $('#otpEstado');
  est.textContent = 'Esperando tu mensaje…'; est.classList.remove('ok');
  mostrarPaso('otp');
  sondearEstado();
}

// Marca el campo como erróneo y lo enlaza con el mensaje, para que un lector de
// pantalla lo anuncie al volver al campo (no solo una vez al aparecer).
function marcarError(campo, caja) {
  if (!campo || !caja) return;
  campo.setAttribute('aria-invalid', 'true');
  campo.setAttribute('aria-describedby', caja.id);
  campo.focus();
}
function limpiarError(campo, caja) {
  if (caja) caja.hidden = true;
  if (campo) campo.removeAttribute('aria-invalid');
}

function initGate() {
  const gate = $('#gate'), form = $('#gateForm'), inp = $('#gateDoc'), err = $('#gateError');
  const tiposBox = $('#gateTipos'), paisesBox = $('#gatePaises'), docLabel = $('#gateDocLabel');
  const acepta = $('#gateAcepta');
  const paises = CFG.paises || [];
  let tipo = 'persona', pais = paises[0]?.code || 'PE';

  tiposBox.innerHTML = `
    <button type="button" role="radio" aria-checked="true" data-tipo="persona"><span class="bandera" aria-hidden="true">👤</span>Persona</button>
    <button type="button" role="radio" aria-checked="false" data-tipo="empresa"><span class="bandera" aria-hidden="true">🏢</span>Empresa</button>`;

  paisesBox.innerHTML = paises.map(p =>
    `<button type="button" role="radio" aria-checked="${p.code === pais}" data-pais="${p.code}">
       <span class="bandera" aria-hidden="true">${p.bandera}</span>${esc(p.nombre)}
     </button>`).join('');

  const actualizar = (enfocar) => {
    const info = docInfo(pais, tipo);
    docLabel.textContent = info.doc;
    inp.placeholder = info.ej;
      tiposBox.querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', b.dataset.tipo === tipo));
    paisesBox.querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', b.dataset.pais === pais));
    if (enfocar) inp.focus();
  };
  // Navegación con flechas dentro de cada grupo (patrón ARIA de radiogroup).
  const flechas = (caja, aplicar) => {
    caja.querySelectorAll('button').forEach((b, i, todos) => {
      b.tabIndex = b.getAttribute('aria-checked') === 'true' ? 0 : -1;
      b.onkeydown = (e) => {
        const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (!dir) return;
        e.preventDefault();
        const sig = todos[(i + dir + todos.length) % todos.length];
        aplicar(sig); sig.focus();
      };
    });
  };
  const aplicarTipo = (b) => { tipo = b.dataset.tipo; actualizar(false); flechas(tiposBox, aplicarTipo); flechas(paisesBox, aplicarPais); };
  const aplicarPais = (b) => { pais = b.dataset.pais; actualizar(false); flechas(tiposBox, aplicarTipo); flechas(paisesBox, aplicarPais); };
  tiposBox.querySelectorAll('button').forEach(b => b.onclick = () => aplicarTipo(b));
  paisesBox.querySelectorAll('button').forEach(b => b.onclick = () => { aplicarPais(b); inp.focus(); });
  actualizar(false);
  flechas(tiposBox, aplicarTipo); flechas(paisesBox, aplicarPais);

  $('#gateWa').href = waLink('Hola, quiero acceder a mi Central de Postventa C4V pero no puedo entrar.');

  if (CFG.mostrarNumerosDemo) {
    const box = $('#gateDemo'); box.hidden = false;
    box.innerHTML = '<h2>Documentos de ejemplo (demostración)</h2>' + state.db.clientes.map(c => {
      const info = docInfo(c.pais, c.tipo || 'persona');
      return `<button type="button" data-doc="${esc(c.documento)}">${esc(info.doc)} ${esc(c.documento)}<span>${esc(c.nombre)} · ${c.tipo === 'empresa' ? '🏢 Empresa' : '👤 Persona'} · ${PAISES[c.pais] || c.pais}</span></button>`;
    }).join('');
    box.querySelectorAll('button').forEach(b => b.onclick = () => {
      const cli = buscarClientePorDocumento(normalizarDoc(b.dataset.doc));
      if (cli) entrar(cli);
    });
  }

  const btn = form.querySelector('.gate-btn');
  const btnLabel = btn ? btn.textContent : '';
  const setCargando = (on, texto) => {
    if (!btn) return;
    btn.disabled = on;
    btn.textContent = on ? (texto || 'Verificando…') : btnLabel;
    btn.setAttribute('aria-busy', on ? 'true' : 'false');
  };

  /* ── Un solo formulario, tres momentos ──────────────────────────────────
     doc → identificamos y pedimos el WhatsApp completo
     tel → lo comparamos con Odoo y sale el código
     cod → lo validamos y entra
     Todo en la misma pantalla; el botón dice en cada momento lo que hace. */
  const telInp = $('#gateTel'), codInp = $('#gateCod');
  telInp.oninput = () => { telInp.value = telInp.value.replace(/[^\d+ ]/g, ''); };
  codInp.oninput = () => { codInp.value = codInp.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8); };

  const fallo = (campo, html) => {
    setCargando(false);
    err.hidden = false; err.innerHTML = html;
    marcarError(campo, err);
  };

  async function pasoDocumento() {
    const doc = normalizarDoc(inp.value);
    const info = docInfo(pais, tipo);
    if (!acepta.checked) return fallo(acepta, 'Marca la casilla para aceptar los Términos y la Política de Privacidad.');
    if (doc.length < 5) return fallo(inp, `Ese ${esc(info.doc)} está incompleto. Escríbelo completo, así: ${esc(info.ej)}.`);

    setCargando(true);
    let res;
    try { res = await verificarCliente({ pais, doc }); }
    catch { res = { estado: 'error' }; }

    const noAparece = `Ese ${esc(info.doc)} no nos aparece. Revisa que sea el mismo con el que compraste tu máquina. Si está bien, <a href="${waLink('Hola, mi documento no aparece en la Central de Postventa C4V. ¿Me ayudan?')}" target="_blank" rel="noopener">escríbenos por WhatsApp</a>.`;
    const sinTelefono = `No tenemos tu WhatsApp registrado, así que no podemos enviarte el código. <a href="${waLink('Hola, quiero entrar a mi Central de Postventa C4V pero no tienen mi WhatsApp registrado. ¿Me ayudan?')}" target="_blank" rel="noopener">Escríbenos y lo actualizamos</a> en un minuto.`;

    // Demostración: el mismo recorrido, sin backend ni WhatsApp.
    if (res.estado === 'ok' && (modoDemo() || res.demo) && res.cliente?.telefono) {
      acceso.cliente = res.cliente; acceso.codigo = null; acceso.solicitud = 'DEMO'; acceso.pais = pais;
      pistaEnCampo(numeroNacional(res.cliente.telefono, pais).slice(-PISTA_DIGITOS));
      setCargando(false); faseAcceso('tel');
      apiPost('/api/consentimiento', { doc, pais, acepta_datos: true, acepta_marketing: false }).catch(() => {});
      return;
    }
    if (res.estado === 'ok') { setCargando(false); entrar(res.cliente); return; }

    if (res.estado === 'otp') {
      const d = await apiPost('/api/acceso/identificar', { pais, doc });
      if (d.status === 429) return fallo(inp, 'Probaste demasiadas veces seguidas. Espera cinco minutos y vuelve a intentar.');
      if (d.json.ok && d.json.canal === 'whatsapp') {
        acceso.solicitud = d.json.solicitud; acceso.pais = pais; acceso.cliente = null; acceso.codigo = null;
        pistaEnCampo(d.json.pista || '');
        setCargando(false); faseAcceso('tel');
        apiPost('/api/consentimiento', { doc, pais, acepta_datos: true, acepta_marketing: false }).catch(() => {});
        return;
      }
      if (d.json.ok === false && d.json.motivo === 'sin_telefono') return fallo(inp, sinTelefono);

      // El canal de envío no está listo: se usa el camino de siempre.
      const r = await apiPost('/api/otp/solicitar', { pais, doc });
      setCargando(false);
      if (r.status === 429) return fallo(inp, 'Pediste muchos códigos seguidos. Espera 5 minutos y vuelve a intentar.');
      if (r.json.ok) {
        apiPost('/api/consentimiento', { doc, pais, acepta_datos: true, acepta_marketing: false }).catch(() => {});
        pintarPasoOtp(r.json, pais);
        return;
      }
      return fallo(inp, r.json.motivo === 'sin_telefono' ? sinTelefono : noAparece);
    }

    if (res.estado === 'limite') return fallo(inp, `Demasiados intentos. Espera 5 minutos y vuelve a probar, o <a href="${waLink('Hola, no puedo entrar a mi Central de Postventa C4V. ¿Me ayudan?')}" target="_blank" rel="noopener">escríbenos por WhatsApp</a>.`);
    if (res.estado === 'error') return fallo(inp, `No pudimos conectarnos. Revisa tu internet y vuelve a intentar. Si sigue igual, <a href="${waLink('Hola, no puedo entrar a mi Central de Postventa C4V (error al verificar). ¿Me ayudan?')}" target="_blank" rel="noopener">escríbenos por WhatsApp</a>.`);
    return fallo(inp, noAparece);
  }

  async function pasoTelefono() {
    const escrito = digitosDe(telInp.value);
    if (escrito.length < 7) return fallo(telInp, 'Escribe tu número de WhatsApp completo.');

    // Demostración: se compara aquí mismo y el código sale en pantalla.
    if (acceso.solicitud === 'DEMO') {
      const suyo = numeroNacional(acceso.cliente?.telefono, acceso.pais);
      if (escrito.slice(-8) !== suyo.slice(-8)) return fallo(telInp, 'Ese número no coincide con el que tenemos.');
      acceso.codigo = CODIGO_DEMO;
      $('#gateCodAviso').textContent = `Te lo mandamos por WhatsApp al número que termina en ${suyo.slice(-PISTA_DIGITOS)}. Llega en unos segundos.`;
      faseAcceso('cod'); return;
    }

    setCargando(true, 'Enviando…');
    const r = await apiPost('/api/acceso/enviar', { solicitud: acceso.solicitud, telefono: escrito });
    setCargando(false);
    if (r.json.ok) {
      const via = r.json.canal === 'sms' ? 'un SMS' : 'WhatsApp';
      $('#gateCodAviso').textContent = `Te lo mandamos por ${via} al número que termina en ${r.json.pista || ''}. Llega en unos segundos.`;
      faseAcceso('cod'); return;
    }
    const motivos = {
      telefono_no_coincide: `Ese número no coincide con el que tenemos.${r.json.restantes ? ` Te queda${r.json.restantes === 1 ? '' : 'n'} ${r.json.restantes} intento${r.json.restantes === 1 ? '' : 's'}.` : ''}`,
      demasiados_intentos: 'Se acabaron los intentos. Recarga la página y empieza otra vez.',
      solicitud_vencida: 'Pasó demasiado tiempo. Recarga la página y empieza otra vez.',
      no_configurado: 'Todavía no podemos enviarte el código por WhatsApp. Escríbenos y te ayudamos a entrar.',
      fallo_envio: 'No pudimos enviarte el código ahora. Prueba otra vez en un minuto.'
    };
    return fallo(telInp, motivos[r.json.motivo] || (r.status === 429 ? 'Probaste demasiadas veces. Espera unos minutos.' : 'No pudimos enviarte el código. Inténtalo de nuevo.'));
  }

  async function pasoCodigo() {
    const codigo = codInp.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    // Sin largo fijo: el código de WhatsApp tiene 7 caracteres, el de SMS
    // (Twilio Verify) suele ser más corto — el backend valida cuál toca.
    if (codigo.length < 4) return fallo(codInp, 'Escribe tu código completo, como en el mensaje.');

    if (acceso.solicitud === 'DEMO') {
      if (codigo === acceso.codigo) { entrar(acceso.cliente); return; }
      return fallo(codInp, 'Ese código no es el correcto.');
    }

    setCargando(true, 'Entrando…');
    const r = await apiPost('/api/otp/verificar', { solicitud: acceso.solicitud, codigo });
    setCargando(false);
    if (r.json.ok && r.json.token) {
      guardarSesion({ token: r.json.token, pais: acceso.pais });
      entrar(inyectarCliente(r.json.cliente, r.json.maquinas));
      return;
    }
    const motivos = {
      incorrecto: `Ese código no es el correcto.${r.json.intentos_restantes ? ` Te queda${r.json.intentos_restantes === 1 ? '' : 'n'} ${r.json.intentos_restantes}.` : ''}`,
      vencido: 'Tu código venció. Recarga la página y pide uno nuevo.',
      usado: 'Ese código ya se usó. Recarga la página y pide uno nuevo.',
      bloqueado: 'Demasiados intentos. Recarga la página y empieza otra vez.'
    };
    return fallo(codInp, motivos[r.json.motivo] || 'No pudimos revisar tu código. Inténtalo otra vez.');
  }

  form.onsubmit = (e) => {
    e.preventDefault(); limpiarError(inp, err); limpiarError(telInp, err); limpiarError(codInp, err);
    if (acceso.fase === 'tel') return pasoTelefono();
    if (acceso.fase === 'cod') return pasoCodigo();
    return pasoDocumento();
  };

  // ---- Camino de siempre (el cliente escribe primero por WhatsApp) ----
  const otpForm = $('#otpForm'), otpErr = $('#otpError'), otpInp = $('#otpCodigo');
  otpInp.oninput = () => { otpInp.value = otpInp.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7); };
  otpForm.onsubmit = async (e) => {
    e.preventDefault(); limpiarError(otpInp, otpErr);
    const codigo = otpInp.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (codigo.length !== 7) { otpErr.hidden = false; otpErr.textContent = 'Escribe tu código completo, como llegó por WhatsApp.'; marcarError(otpInp, otpErr); return; }
    const boton = otpForm.querySelector('button');
    boton.disabled = true; boton.textContent = 'Entrando…';
    const r = await apiPost('/api/otp/verificar', { solicitud: otpEstado.solicitud, codigo });
    boton.disabled = false; boton.textContent = 'Entrar';
    if (r.json.ok && r.json.token) {
      detenerSondeo();
      guardarSesion({ token: r.json.token, pais: otpEstado.pais });
      entrar(inyectarCliente(r.json.cliente, r.json.maquinas));
      return;
    }
    otpErr.hidden = false;
    otpErr.textContent = {
      incorrecto: `Ese código no es el correcto.${r.json.intentos_restantes ? ` Te queda${r.json.intentos_restantes === 1 ? '' : 'n'} ${r.json.intentos_restantes}.` : ''}`,
      vencido: 'Tu código venció. Vuelve y pide uno nuevo.',
      usado: 'Ese código ya se usó. Pide uno nuevo.',
      bloqueado: 'Demasiados intentos. Vuelve y pide otro código.',
      no_enviado: 'Todavía no nos llegó tu mensaje de WhatsApp. Envíalo y espera unos segundos.'
    }[r.json.motivo] || 'No pudimos revisar tu código. Vuelve a intentarlo.';
    marcarError(otpInp, otpErr);
  };
  $('#otpVolver').onclick = () => { detenerSondeo(); otpEstado.solicitud = null; mostrarPaso('doc'); inp.focus(); };

  faseAcceso('doc');
  mostrarPaso('doc');
  gate.hidden = false; $('#app').hidden = true;
}

// ---------- CeVi · asistente de la máquina (chat + voz) ----------
/* Conecta con el backend propio (cevi-backend en Railway): Claude Haiku con el
   cerebro de CeVi, voz es-MX Dalia y creación de tickets en Odoo.
   Se le pasa el contexto REAL del cliente (nombre, ciudad, país, serie y su id de
   partner en Odoo) para que no pregunte lo que ya sabemos y para que la conversación
   quede registrada en la ficha correcta del ERP, sin crear contactos duplicados. */
/* CeVi es, ante todo, un asistente de VOZ: se abre escuchando y contesta hablando.
   El chat escrito sigue ahí para quien no puede hablar o está en un taller ruidoso.
   estado: 'reposo' | 'escuchando' | 'pensando' | 'hablando'   */
const cevi = {
  abierto: false, historial: [], hablando: null, escuchando: null, partnerId: null,
  modo: 'voz', estado: 'reposo', manosLibres: false, audioListo: false, cerrando: false,
  turnoVoz: 0, reproductor: null, textoPendiente: null,
  /* enVoz: la pantalla de solo-toro está abierta. sinAuto: este navegador no
     deja volver a escuchar sin un toque (iPhone), así que se le pide el toque.
     descartar: lo que se estaba oyendo no se manda (se cerró el modo voz). */
  enVoz: false, sinAuto: false, descartar: false
};

const HAY_DICTADO = !!(window.SpeechRecognition || window.webkitSpeechRecognition);

/* Safari e iOS solo dejan sonar audio si la reproducción arranca DENTRO de un
   gesto de la persona, y el permiso queda pegado al elemento <audio>, no a la
   página. Por eso hay un único reproductor para toda la sesión: se desbloquea
   con un silencio en el primer toque y luego solo se le cambia el `src`.
   Crear un `new Audio()` por respuesta era justamente lo que no sonaba. */
const SILENCIO = 'data:audio/wav;base64,UklGRogAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YWQAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA';

function ceviReproductor() {
  if (!cevi.reproductor) {
    const a = new Audio();
    a.preload = 'auto';
    a.setAttribute('playsinline', '');
    cevi.reproductor = a;
  }
  return cevi.reproductor;
}

function ceviDesbloquearAudio(forzar) {
  if (cevi.audioListo && !forzar) return;
  try {
    const a = ceviReproductor();
    a.src = SILENCIO;
    const p = a.play();
    if (p && p.then) p.then(() => { cevi.audioListo = true; }).catch(() => {});
    else cevi.audioListo = true;
  } catch {}
}

/* ---------- El orbe de CeVi ----------
   Una burbuja que se mueve con la voz de verdad: mide la amplitud del micrófono
   mientras escuchas y la del altavoz mientras habla. Si el navegador no deja
   medir, se mueve con un latido sintético, para que nunca parezca congelada. */
const orbe = { ctx: null, ana: null, datos: null, fuenteAudio: null, mic: null, raf: null, nivel: 0, nodos: [], genMic: 0 };

function orbeHTML(tam = 'grande') {
  return `<div class="orbe orbe-${tam}" data-orbe>
    <span class="orbe-halo"></span>
    <span class="orbe-anillo"></span>
    <span class="orbe-anillo dos"></span>
    <span class="orbe-disco"><img class="toro-cara" src="assets/cevi/listo.png" width="236" height="236" alt="" aria-hidden="true" decoding="async"></span>
  </div>`;
}

function orbeCtx() {
  if (!orbe.ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { orbe.ctx = new AC(); } catch { return null; }
  }
  if (orbe.ctx.state === 'suspended') orbe.ctx.resume().catch(() => {});
  return orbe.ctx;
}

function orbeAnalizador(ctx) {
  if (!orbe.ana) {
    orbe.ana = ctx.createAnalyser();
    orbe.ana.fftSize = 256;
    orbe.ana.smoothingTimeConstant = 0.75;
    orbe.datos = new Uint8Array(orbe.ana.frequencyBinCount);
  }
  return orbe.ana;
}

/* Antes se enchufaba el <audio> de CeVi a Web Audio para que el orbe se moviera
   con la forma de onda real. Se quitó: en cuanto el micrófono está abierto, la
   cancelación de eco de Chrome puede dejar mudo lo que sale por ese grafo, y
   entonces CeVi transcribe pero no se oye. Animar un círculo no vale quedarse
   sin voz; mientras habla, el orbe se mueve con un envolvente sintético.
   El medidor del micrófono sí se conserva: ese no toca la reproducción. */
function orbeEscucharAltavoz() { return false; }

/* `getUserMedia` tarda en resolver. Si la escucha termina antes, el micrófono
   se quedaba abierto para siempre: el indicador del sistema seguía encendido y
   la cancelación de eco de Chrome seguía activa mientras CeVi intentaba hablar.
   El contador de generación descarta cualquier stream que llegue tarde. */
async function orbeEscucharMicro() {
  if (orbe.mic) return true;
  const ctx = orbeCtx();
  if (!ctx || !navigator.mediaDevices?.getUserMedia) return false;
  const gen = ++orbe.genMic;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (gen !== orbe.genMic) {          // ya nos pidieron soltarlo: se cierra ya
      stream.getTracks().forEach(t => t.stop());
      return false;
    }
    const src = ctx.createMediaStreamSource(stream);
    src.connect(orbeAnalizador(ctx));
    orbe.mic = { stream, src };
    return true;
  } catch { return false; }
}

function orbeSoltarMicro() {
  orbe.genMic++;                        // invalida cualquier permiso en vuelo
  if (!orbe.mic) return;
  try { orbe.mic.src.disconnect(); } catch {}
  try { orbe.mic.stream.getTracks().forEach(t => t.stop()); } catch {}
  orbe.mic = null;
}

// Amplitud real si la hay; si no, un latido que no engaña a nadie pero da vida.
function orbeNivel(estado, t) {
  if (orbe.ana && (estado === 'hablando' || estado === 'escuchando')) {
    orbe.ana.getByteFrequencyData(orbe.datos);
    let suma = 0;
    for (let i = 0; i < orbe.datos.length; i++) suma += orbe.datos[i];
    const medio = suma / orbe.datos.length / 255;
    if (medio > 0.004) return Math.min(1, medio * 3.2);
  }
  if (estado === 'hablando') return 0.35 + Math.abs(Math.sin(t / 190)) * 0.45;
  if (estado === 'escuchando') return 0.15 + Math.abs(Math.sin(t / 520)) * 0.2;
  if (estado === 'pensando') return 0.1 + Math.abs(Math.sin(t / 700)) * 0.12;
  return 0.05 + Math.abs(Math.sin(t / 1600)) * 0.05;      // respiración en reposo
}

function orbeArrancar() {
  if (orbe.raf) return;
  const paso = (t) => {
    orbe.nodos = Array.from(document.querySelectorAll('[data-orbe]'));
    if (!orbe.nodos.length) { orbe.raf = null; return; }
    const estado = cevi.estado || 'reposo';
    const objetivo = orbeNivel(estado, t);
    orbe.nivel += (objetivo - orbe.nivel) * 0.22;          // suaviza el salto
    const n = orbe.nivel.toFixed(3);
    orbe.nodos.forEach(el => el.style.setProperty('--n', n));
    orbe.raf = requestAnimationFrame(paso);
  };
  orbe.raf = requestAnimationFrame(paso);
}

function orbeParar() {
  if (orbe.raf) cancelAnimationFrame(orbe.raf);
  orbe.raf = null;
  orbeSoltarMicro();
}

/* El toro de C4V. Va como máscara CSS para poder pintarlo del color que toque
   en cada sitio (blanco sobre el disco negro, rojo sobre papel). */
/* El personaje real de C4V, no la silueta de una tinta. Va con medidas fijas
   para que el navegador reserve el hueco y la página no salte al cargarlo. */
const TORO = '<img class="toro-cara" src="assets/cevi/listo-sm.png" width="96" height="96" alt="" aria-hidden="true" decoding="async">';

const CEVI_ICONOS = {
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0"/><path d="M12 18v3"/></svg>',
  enviar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h15M13 6l6 6-6 6"/></svg>',
  audioOn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9.5a3.5 3.5 0 0 1 0 5"/><path d="M19.5 7a7 7 0 0 1 0 10"/></svg>',
  audioOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 10l4 4M21 10l-4 4"/></svg>'
};

// Contexto que viaja con cada mensaje: lo que CeVi ya sabe del cliente.
function ceviContexto() {
  const cli = currentClient();
  const maq = cli ? state.db.maquinas.find(m => m.cliente_id === cli.id) : null;
  const idOdoo = parseInt(String(cli?.id || '').replace(/\D/g, ''), 10);
  return {
    customer_name: primerNombre(cli?.nombre) || 'Cliente',
    customer_city: cli?.ciudad || '',
    customer_country: PAISES[cli?.pais]?.replace(/^\S+\s/, '') || cli?.pais || 'Perú',
    machine_id: maq?.serie || (maq?.modelo ? `modelo ${maq.modelo} (sin serie registrada)` : 'sin registrar'),
    customer_id: cevi.partnerId || (Number.isFinite(idOdoo) ? idOdoo : null)
  };
}

function ceviBurbuja(quien, texto, extra = '') {
  const cuerpo = quien === 'cevi'
    ? `<div class="cevi-avatar" aria-hidden="true">${TORO}</div><div class="cevi-txt">${esc(texto)}${extra}</div>`
    : `<div class="cevi-txt">${esc(texto)}</div>`;
  return `<div class="cevi-msg ${quien}">${cuerpo}</div>`;
}

function ceviPintar() {
  const box = $('#ceviMsgs');
  if (!box) return;
  box.innerHTML = cevi.historial.map(m => {
    let extra = '';
    if (m.ticket) extra = `<div class="cevi-ticket">Ya le avisé a una persona del equipo. Te escriben por WhatsApp.</div>`;
    // Si CeVi se cayó, la persona no debería tener que buscar el número.
    if (m.wa) extra = `<a class="cevi-wa" href="${esc(m.wa)}" target="_blank" rel="noopener">Escribir por WhatsApp ahora</a>`;
    return ceviBurbuja(m.role === 'user' ? 'yo' : 'cevi', m.content, extra);
  }).join('');
  box.scrollTop = box.scrollHeight;
}

/* Parte la respuesta en trozos que se puedan sintetizar rápido. Se corta por
   frases; si una frase es muy larga se parte por comas. Un trozo corto se
   sintetiza en menos de un segundo, así CeVi empieza a hablar casi al instante. */
function ceviTrozos(texto, max = 150, primero = 70) {
  const frases = String(texto).match(/[^.!?…]+[.!?…]*\s*/g) || [String(texto)];
  const salida = [];
  let acc = '';
  for (let f of frases) {
    f = f.trim();
    if (!f) continue;
    while (f.length > max) {                       // frase larguísima: corta por coma
      let corte = f.lastIndexOf(',', max);
      if (corte < max * 0.4) corte = f.lastIndexOf(' ', max);
      if (corte < max * 0.4) corte = max;
      salida.push(f.slice(0, corte + 1).trim());
      f = f.slice(corte + 1).trim();
    }
    if ((acc + ' ' + f).trim().length <= max) acc = (acc + ' ' + f).trim();
    else { if (acc) salida.push(acc); acc = f; }
  }
  if (acc) salida.push(acc);
  const lista = salida.filter(Boolean);
  /* El primer trozo se parte más corto todavía: es el único que se espera en
     silencio, y sintetizar 60 caracteres tarda la mitad que 150. */
  if (lista.length && lista[0].length > primero * 1.4) {
    const t = lista[0];
    let corte = t.lastIndexOf(',', primero);
    if (corte < primero * 0.4) corte = t.lastIndexOf(' ', primero);
    if (corte > primero * 0.4) lista.splice(0, 1, t.slice(0, corte + 1).trim(), t.slice(corte + 1).trim());
  }
  return lista.filter(Boolean);
}

/* Cachea la síntesis por texto: el saludo y las repreguntas se repiten, y cada
   ida al servidor cuesta casi un segundo entero. Se guarda la promesa, no el
   resultado, para que dos pedidos a la vez no disparen dos síntesis. */
const ttsCache = new Map();
const TTS_CACHE_MAX = 24;

const TTS_TIMEOUT_MS = 9000;

function ceviPedirTts(texto, señal) {
  const clave = String(texto).trim();
  if (ttsCache.has(clave)) return ttsCache.get(clave);
  const promesa = (async () => {
    /* Con límite de tiempo: sin él, una petición colgada dejaba a CeVi en
       "hablando" para siempre y no volvía a escuchar nunca. */
    const corte = new AbortController();
    const reloj = setTimeout(() => corte.abort(), TTS_TIMEOUT_MS);
    let r;
    try {
      r = await fetch(`${CFG.ceviApi}/tts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: clave }), signal: señal || corte.signal
      });
    } finally { clearTimeout(reloj); }
    if (!r.ok) throw new Error('tts ' + r.status);
    const blob = await r.blob();
    if (!blob.size) throw new Error('audio vacío');
    return URL.createObjectURL(blob);
  })();
  promesa.catch(() => ttsCache.delete(clave));      // un fallo no se cachea
  ttsCache.set(clave, promesa);
  if (ttsCache.size > TTS_CACHE_MAX) ttsCache.delete(ttsCache.keys().next().value);
  return promesa;
}

// Reproduce un trozo y espera a que termine. Devuelve false si no sonó nada.
function ceviReproducirTrozo(url) {
  return new Promise((listo) => {
    const audio = ceviReproductor();
    cevi.hablando = audio;
    try { audio.pause(); } catch {}      // puede venir sonando la muletilla
    audio.src = url;
    audio.volume = 1;
    audio.muted = false;
    cevi.ultimoFalloVoz = null;
    let acabado = false, sonó = false;
    let fin = (ok) => {
      if (acabado) return;
      acabado = true;
      audio.onended = audio.onerror = audio.ontimeupdate = audio.onloadedmetadata = null;
      listo(ok !== false && sonó);
    };
    // Por evento y no por temporizador: si el navegador tarda en arrancar, un
    // setTimeout de 400 ms daba "no se oyó nada" aunque sí estuviera sonando.
    audio.ontimeupdate = () => { if (audio.currentTime > 0) sonó = true; };
    audio.onended = () => fin(true);
    audio.onerror = () => {
      cevi.ultimoFalloVoz = audio.error ? `media ${audio.error.code}` : 'media';
      fin(false);
    };
    /* Red de seguridad corta. Antes eran 120 segundos: si el audio no arrancaba
       y el navegador no avisaba con `error`, CeVi se quedaba dos minutos en
       "hablando" y parecía colgada. Ahora se corta a los dos segundos si no ha
       avanzado ni un fotograma, y en cuanto se sabe la duración se ajusta a
       ella con un margen. */
    const cortar = setTimeout(() => {
      if (!sonó) { cevi.ultimoFalloVoz = cevi.ultimoFalloVoz || 'sin arrancar'; fin(false); }
    }, 2200);
    let porDuracion = null;
    audio.onloadedmetadata = () => {
      const d = audio.duration;
      if (Number.isFinite(d) && d > 0) {
        clearTimeout(porDuracion);
        porDuracion = setTimeout(() => fin(sonó), (d + 4) * 1000);
      }
    };
    const finLimpio = fin;
    fin = (ok) => { clearTimeout(cortar); clearTimeout(porDuracion); finLimpio(ok); };
    audio.play().then(() => { cevi.audioListo = true; })
      .catch((e) => { cevi.ultimoFalloVoz = e && e.name ? e.name : 'play'; fin(false); });
  });
}

/* Voz: reproduce la respuesta con la voz del backend, en cadena. Mientras suena
   un trozo ya se está sintetizando el siguiente, así que CeVi empieza a hablar
   en cuanto está lista la primera frase, no la respuesta entera. */
/* Techo duro: hable o no hable, el turno termina. Antes, si algo se quedaba a
   medias, la conversación entera se congelaba sin decir nada y sin volver a
   escuchar. */
function ceviHablarConTecho(texto, ms = 45000) {
  return Promise.race([
    ceviHablar(texto),
    new Promise(r => setTimeout(() => { ceviParaVoz(); if (cevi.estado === 'hablando') ceviEstado('reposo'); r(); }, ms))
  ]);
}

async function ceviHablar(texto) {
  // En modo voz siempre habla: silenciarla sería vaciar el modo de sentido.
  // El interruptor del altavoz solo manda cuando la conversación es escrita.
  if (!CFG.ceviVoz) return;
  if (cevi.modo !== 'voz' && !ceviVozActiva()) return;

  ceviParaVoz();
  ceviEstado('hablando');
  const turno = ++cevi.turnoVoz;                  // si llega otro, este se abandona
  const trozos = ceviTrozos(texto);
  let sonóAlgo = false;

  try {
    let siguiente = ceviPedirTts(trozos[0]);
    for (let i = 0; i < trozos.length; i++) {
      const url = await siguiente;
      if (turno !== cevi.turnoVoz) return;
      // Pide el siguiente ANTES de reproducir este: se solapan y no hay pausa.
      siguiente = trozos[i + 1] ? ceviPedirTts(trozos[i + 1]).catch(() => null) : null;
      const ok = await ceviReproducirTrozo(url);
      if (turno !== cevi.turnoVoz) return;
      if (ok) { sonóAlgo = true; ceviAviso(''); }
      else if (!sonóAlgo) { ceviSinSonido(texto); return; }
      if (!siguiente) break;
    }
  } catch { /* sin voz, el texto ya está en pantalla */ }
  finally {
    // No se revocan: viven en el caché y se vuelven a usar.
    if (turno === cevi.turnoVoz) {
      cevi.hablando = null;
      if (cevi.estado === 'hablando') ceviEstado('reposo');
    }
  }
}

/* No se oyó nada. Puede ser el interruptor de silencio del iPhone, el volumen
   abajo o un navegador que no deja sonar sin un toque. Se dice cuál puede ser
   y se deja un botón que reproduce con el toque de la persona. */
function ceviSinSonido(texto) {
  cevi.textoPendiente = texto;
  const causa = cevi.ultimoFalloVoz;
  /* Deja rastro en la consola: si vuelve a fallar, esto dice exactamente por
     qué, en vez de tener que adivinar desde el otro lado. */
  const a = cevi.reproductor;
  console.warn('[CeVi] sin sonido', {
    causa: causa || 'sin error, el audio no avanzó',
    codigoMedia: a && a.error ? a.error.code : null,
    listo: a ? a.readyState : null,
    silenciado: a ? a.muted : null,
    volumen: a ? a.volume : null,
    audioDesbloqueado: cevi.audioListo,
    contextoAudio: orbe.ctx ? orbe.ctx.state : 'sin crear'
  });
  const detalle = causa === 'NotAllowedError'
    ? 'Tu navegador bloqueó el sonido hasta que toques la pantalla.'
    : causa
      ? 'No pude reproducir el audio.'
      : 'No se oyó nada. Revisa que el volumen esté arriba y que el equipo no esté en silencio.';
  ceviAviso(detalle, 'Escuchar la respuesta');
}

// Corta lo que esté sonando. Se usa al interrumpir, al cerrar y antes de escuchar.
function ceviParaVoz() {
  cevi.turnoVoz++;                 // invalida la cadena de trozos que venía sonando
  orbeSoltarMicro();               // nada de hablar con el micrófono abierto
  const a = cevi.reproductor;
  if (a) { try { a.pause(); } catch {} }
  cevi.hablando = null;
}

const ceviVozActiva = () => { try { return localStorage.getItem('c4v_cevi_voz') !== '0'; } catch { return true; } };

/* Pide la respuesta por streaming: cada frase llega en cuanto Claude la
   escribe, y se manda a voz sin esperar al resto. Antes se esperaban los 2,5 s
   completos antes de poder sintetizar la primera palabra.
   Devuelve el texto completo, o null si el backend no sabe hacer streaming (y
   entonces quien llama usa el /chat de siempre). */
async function ceviChatStream(msg, alLlegarFrase) {
  let r;
  try {
    r = await fetch(`${CFG.ceviApi}/chat/stream`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, history: cevi.historial.slice(0, -1).slice(-8), ...ceviContexto() })
    });
  } catch { return null; }
  if (!r.ok || !r.body || !/text\/event-stream/.test(r.headers.get('content-type') || '')) return null;

  const lector = r.body.getReader();
  const dec = new TextDecoder();
  let resto = '', evento = '', completo = '';

  while (true) {
    const { done, value } = await lector.read();
    if (done) break;
    resto += dec.decode(value, { stream: true });
    const bloques = resto.split('\n\n');
    resto = bloques.pop() || '';
    for (const bloque of bloques) {
      for (const linea of bloque.split('\n')) {
        if (linea.startsWith('event:')) evento = linea.slice(6).trim();
        else if (linea.startsWith('data:')) {
          let d; try { d = JSON.parse(linea.slice(5).trim()); } catch { continue; }
          if (evento === 'frase' && d.texto) alLlegarFrase(d.texto);
          else if (evento === 'fin') completo = d.texto || completo;
          else if (evento === 'error') throw new Error(d.error || 'stream');
        }
      }
    }
  }
  return completo || null;
}

/* Cola de voz: las frases llegan del streaming una a una, así que la síntesis
   de la siguiente arranca mientras suena la actual. Es lo mismo que hacía
   ceviHablar por dentro, pero alimentado en vivo. */
const colaVoz = { pendientes: [], corriendo: false, cerrada: true, avisar: null };

function ceviEncolarVoz(frase) {
  if (!CFG.ceviVoz) return;
  if (cevi.modo !== 'voz' && !ceviVozActiva()) return;
  colaVoz.pendientes.push(ceviPedirTts(frase).catch(() => null));
  if (colaVoz.avisar) { colaVoz.avisar(); colaVoz.avisar = null; }
  if (!colaVoz.corriendo) colaVoz.fin = ceviCorrerCola();
}

async function ceviCorrerCola() {
  colaVoz.corriendo = true;
  const turno = cevi.turnoVoz;
  ceviEstado('hablando');
  let sonóAlgo = false;
  while (turno === cevi.turnoVoz) {
    if (!colaVoz.pendientes.length) {
      if (colaVoz.cerrada) break;
      await new Promise(r => { colaVoz.avisar = r; setTimeout(r, 4000); });
      continue;
    }
    const url = await colaVoz.pendientes.shift();
    if (turno !== cevi.turnoVoz) break;
    if (!url) continue;
    const ok = await ceviReproducirTrozo(url);
    if (turno !== cevi.turnoVoz) break;
    if (ok) { sonóAlgo = true; ceviAviso(''); }
    else if (!sonóAlgo) { ceviSinSonido(cevi.ultimaRespuesta || ''); break; }
  }
  colaVoz.corriendo = false;
  if (turno === cevi.turnoVoz) {
    cevi.hablando = null;
    if (cevi.estado === 'hablando') ceviEstado('reposo');
  }
}

function ceviAbrirCola() {
  ceviParaVoz();                       // corta lo que sonaba y sube el turno
  colaVoz.pendientes = []; colaVoz.cerrada = false; colaVoz.fin = null;
}
function ceviCerrarCola() {
  colaVoz.cerrada = true;
  if (colaVoz.avisar) { colaVoz.avisar(); colaVoz.avisar = null; }
}

async function ceviEnviar(texto) {
  const msg = String(texto || '').trim();
  if (!msg || $('#ceviInput')?.disabled) return;
  cevi.historial.push({ role: 'user', content: msg });
  ceviPintar();
  const input = $('#ceviInput'); if (input) { input.value = ''; input.disabled = true; }
  ceviTranscripcion('');
  ceviEstado('pensando');
  ceviArmarRelleno();              // solo suena si la espera pasa de 800 ms
  $('#ceviMsgs').insertAdjacentHTML('beforeend', '<div class="cevi-msg cevi pensando" aria-hidden="true"><div class="cevi-avatar">' + TORO + '</div><div class="cevi-txt"><span></span><span></span><span></span></div></div>');
  $('#ceviMsgs').scrollTop = $('#ceviMsgs').scrollHeight;

  const cerrarTurno = async () => {
    if (input) { input.disabled = false; if (cevi.modo === 'texto') input.focus(); }
    if (cevi.estado === 'pensando') ceviEstado('reposo');
    /* En el modo voz, cuando CeVi termina de hablar vuelve a escuchar sola,
       como hacen los asistentes de voz. Si el navegador no lo permite (iPhone
       pide un toque por turno), se entera a la primera y desde ahí pide el
       toque en pantalla, sin intentarlo cada vez. En el chat no se reenciende. */
    if (cevi.enVoz && !cevi.sinAuto && cevi.estado === 'reposo' && !cevi.textoPendiente) ceviEscuchar(false);
  };

  try {
    // Camino rápido: cada frase se oye en cuanto Claude la escribe.
    let primeraFrase = true;
    ceviAbrirCola();
    const completo = await ceviChatStream(msg, (frase) => {
      if (primeraFrase) { primeraFrase = false; ceviCancelarRelleno(); }
      ceviEncolarVoz(frase);
    });
    ceviCerrarCola();

    if (completo) {
      cevi.ultimaRespuesta = completo;
      cevi.historial.push({ role: 'assistant', content: completo });
      ceviPintar();
      if (input) input.disabled = false;
      ceviPintarPistas();
      await colaVoz.fin;
      await cerrarTurno();
      return;
    }

    /* El backend todavía no sabe hacer streaming (o falló): se usa el /chat de
       siempre, que además puede crear el ticket en Odoo. */
    ceviParaVoz();
    const r = await fetch(`${CFG.ceviApi}/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, history: cevi.historial.slice(0, -1).slice(-8), ...ceviContexto() })
    });
    if (!r.ok) throw new Error('http ' + r.status);
    const j = await r.json();
    ceviCancelarRelleno();
    if (j.partner_id) cevi.partnerId = j.partner_id;
    const respuesta = j.response || 'Disculpa, no te entendí. ¿Lo repites?';
    cevi.ultimaRespuesta = respuesta;
    cevi.historial.push({ role: 'assistant', content: respuesta, ticket: j.ticket?.ref || null });
    ceviPintar();
    if (input) input.disabled = false;
    ceviPintarPistas();
    await ceviHablarConTecho(respuesta);
    await cerrarTurno();
  } catch {
    ceviCerrarCola();
    ceviCancelarRelleno();
    const caida = 'No pude conectarme en este momento. Escríbenos por WhatsApp y te responde una persona del equipo.';
    cevi.historial.push({ role: 'assistant', content: caida, wa: waLink(`Hola equipo C4V. ${msg}`) });
    ceviPintar();
    if (input) input.disabled = false;
    await ceviHablarConTecho(caida);
    if (input) input.disabled = false;
    if (cevi.estado === 'pensando') ceviEstado('reposo');
  }
}

/* ---------- El ciclo de voz ----------
   Escuchar, responder hablando y volver a escuchar, sin que la persona toque
   nada. Usa el reconocimiento nativo del navegador, que no cuesta nada. */
function ceviEscuchar(desdeToque = false) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { ceviModoTexto('Tu navegador no puede escuchar. Escríbeme tu pregunta.'); return; }
  if (cevi.escuchando) return;              // ya está escuchando
  ceviParaVoz();                            // no puede oírse a sí mismo

  /* Una sola instancia para toda la sesión: crear un reconocedor nuevo en cada
     turno hace sonar el pitido del sistema en iPhone una y otra vez. */
  if (!cevi.rec) {
    cevi.rec = new SR();
    cevi.rec.lang = 'es-PE'; cevi.rec.interimResults = true;
    cevi.rec.continuous = false; cevi.rec.maxAlternatives = 1;
  }
  const rec = cevi.rec;
  cevi.escuchando = rec;

  let dicho = '';
  let temporizador = null;
  /* Con 850 ms CeVi cortaba a la gente a media frase: quien explica un
     problema hace pausas para pensar. Ahora espera segundo y medio de silencio;
     si la frase quedó colgando de un conector ("y", "porque", "o sea") le da
     más aire, y si terminó en pregunta clara, un poco menos. */
  const COLGANDO = /\b(y|o|pero|porque|que|si|cuando|para|con|de|en|un|una|o sea|entonces|este|eh|em|mmm|a ver|es que|lo que)\s*$/i;
  const esperaSegun = (t) => COLGANDO.test(t) ? 2600 : (/[?¿]\s*$/.test(t) ? 1100 : 1500);
  const cortarPorSilencio = () => {
    clearTimeout(temporizador);
    if (!dicho) return;
    temporizador = setTimeout(() => { try { rec.stop(); } catch {} }, esperaSegun(dicho));
  };
  rec.onresult = (e) => {
    dicho = Array.from(e.results).map(x => x[0].transcript).join('').trim();
    ceviTranscripcion(dicho);
    const input = $('#ceviInput'); if (input) input.value = dicho;
    cortarPorSilencio();           // no esperamos al final del navegador
  };
  rec.onerror = (e) => {
    clearTimeout(temporizador);
    cevi.escuchando = null;
    // 'no-speech' y 'aborted' son normales: la persona se quedó callada o cortó.
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      cevi.manosLibres = false;
      if (desdeToque) {
        // La persona tocó el micrófono y aun así no se pudo: es permiso negado.
        ceviModoTexto('Necesito permiso del micrófono para escucharte. Puedes activarlo en tu navegador, o escribirme aquí.');
      } else {
        // Reencendido automático rechazado (típico de iPhone): pide un toque.
        cevi.sinAuto = true;
        if (!cevi.enVoz) ceviAviso('Toca el micrófono para seguir hablando: tu navegador pide un toque en cada turno.');
        ceviEstado('reposo');
      }
      return;
    }
    if (e.error !== 'no-speech' && e.error !== 'aborted') {
      ceviTranscripcion('No te escuché bien. Toca el micrófono e inténtalo otra vez.');
    }
    ceviEstado('reposo');
  };
  rec.onend = () => {
    clearTimeout(temporizador);
    cevi.escuchando = null;
    orbeSoltarMicro();
    if (cevi.cerrando) return;
    if (cevi.descartar) { cevi.descartar = false; ceviEstado('reposo'); return; }
    /* Un "eh" o un ruido no es una pregunta: mandarlo hace que CeVi conteste
       cualquier cosa y la conversación se vuelve absurda. */
    if (dicho && dicho.replace(/[^a-záéíóúñ]/gi, '').length < 4) {
      ceviTranscripcion('No te entendí. ¿Me lo repites?');
      ceviEstado('reposo'); return;
    }
    if (dicho) { cevi.silencios = 0; ceviEnviar(dicho); return; }
    if (cevi.estado === 'escuchando') {
      ceviEstado('reposo');
      ceviPintarPistas();
    }
  };

  try {
    rec.start(); ceviEstado('escuchando'); ceviTranscripcion('');
    ceviPitido('escucho');               // "te toca", para quien no mira la pantalla
    orbeEscucharMicro();                 // el orbe se mueve con tu voz
  }
  catch {
    cevi.escuchando = null;
    if (!desdeToque) { cevi.sinAuto = true; if (!cevi.enVoz) ceviAviso('Toca el micrófono para seguir hablando: tu navegador pide un toque en cada turno.'); }
    ceviEstado('reposo');
  }
}

// Corta la escucha. Si `enviar` es falso, descarta lo dicho.
function ceviCallar() {
  if (!cevi.escuchando) return;
  try { cevi.escuchando.stop(); } catch {}
}

/* Un solo sitio decide qué se ve: así el botón grande, el texto de ayuda y el
   aria-live nunca se contradicen entre sí. */
function ceviEstado(nuevo) {
  cevi.estado = nuevo;
  const pagina = $('#ceviPagina');
  if (!pagina) return;
  pagina.dataset.ceviEstado = nuevo;
  const etiquetas = {
    reposo: [cevi.enVoz ? 'Toca al toro y habla' : 'Toca el micrófono y habla', 'Hablar con CeVi'],
    escuchando: ['Te escucho…', 'Dejar de escuchar'],
    pensando: ['Pensando…', 'CeVi está pensando'],
    hablando: ['Toca para interrumpir', 'Interrumpir a CeVi']
  };
  const [texto, aria] = etiquetas[nuevo] || etiquetas.reposo;
  const t = $('#ceviEstadoTxt'); if (t) t.textContent = texto;
  const v = $('#ceviVozTxt'); if (v) v.textContent = texto;
  const mic = $('#ceviMic'); if (mic) mic.setAttribute('aria-label', aria);
  const orbeBtn = $('#ceviVozOrbe'); if (orbeBtn) orbeBtn.setAttribute('aria-label', aria);
}

// Lo que se va oyendo, en pantalla, mientras la persona habla.
function ceviTranscripcion(txt) {
  if (!txt) return;
  const el = $('#ceviEstadoTxt'); if (el) el.textContent = txt;
  const v = $('#ceviVozTxt'); if (v) v.textContent = txt;
}

/* ---------- La pantalla de voz ----------
   Se abre desde el micrófono, dentro del mismo toque (Safari solo desbloquea
   el altavoz así), y empieza a escuchar de inmediato. */
function ceviVozAbrir() {
  const capa = $('#ceviModoVoz');
  if (!capa) return;
  cevi.enVoz = true;
  capa.hidden = false;
  document.body.classList.add('cevi-en-voz');
  ceviAviso('');
  ceviVozToque();
}

function ceviVozCerrar() {
  const capa = $('#ceviModoVoz');
  cevi.enVoz = false;
  document.body.classList.remove('cevi-en-voz');
  if (!capa) return;
  capa.hidden = true;
  if (cevi.escuchando) { cevi.descartar = true; try { cevi.escuchando.abort(); } catch { cevi.descartar = false; } }
  if (cevi.estado === 'hablando') { ceviParaVoz(); }
  if (cevi.estado !== 'pensando') ceviEstado('reposo');
}

// El botón grande hace lo que toca según el estado. Un solo control, sin modos ocultos.
function ceviVozToque() {
  ceviDesbloquearAudio(true);      // dentro del gesto: es lo que exige Safari
  ceviPrecargarRelleno();
  if (cevi.estado === 'escuchando') { cevi.manosLibres = false; ceviCallar(); return; }
  // Interrumpir: en la pantalla de voz, además, se pasa a escuchar al instante.
  if (cevi.estado === 'hablando') { ceviParaVoz(); ceviEstado('reposo'); if (!cevi.enVoz) return; }
  if (cevi.estado === 'pensando') return;
  cevi.manosLibres = false;
  ceviAviso('');
  ceviEscuchar(true);
}

// Pasa al chat escrito y dice por qué, en vez de dejar un micrófono que no responde.
function ceviModoTexto(motivo) {
  ceviVozCerrar();                 // sin micrófono la pantalla de voz no tiene sentido
  cevi.modo = 'texto';
  cevi.manosLibres = false;
  const pagina = $('#ceviPagina');
  if (pagina) pagina.dataset.ceviModo = 'texto';
  ceviEstado('reposo');
  ceviTranscripcion('');
  ceviAviso(motivo);
  setTimeout(() => $('#ceviInput')?.focus(), 80);
}

/* Aviso que se ve en los dos modos: por qué no se puede hablar, o qué pasó.
   Si se le pasa una acción, sale además un botón, porque cuando el navegador
   bloquea el sonido lo único que lo destraba es un toque de la persona. */
function ceviAviso(texto, accion) {
  const el = $('#ceviAviso');
  if (!el) return;
  el.textContent = texto || '';
  if (texto && accion) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'cevi-aviso-btn'; b.textContent = accion;
    b.onclick = () => {
      ceviDesbloquearAudio(true);        // en el mismo toque, antes de cualquier await
      ceviAviso('');
      const t = cevi.textoPendiente;
      if (t) { cevi.textoPendiente = null; ceviHablar(t); }
    };
    el.appendChild(b);
  }
  el.hidden = !texto;
}


/* Los controles son los mismos en el panel flotante y en la página, así que se
   cablean en un solo sitio con los mismos ids. */
function ceviCablear(raiz) {
  const marca = (m) => {
    cevi.modo = m;
    const g = $('#ceviPagina'); if (g) g.dataset.ceviModo = m;
  };
  const f = $('#ceviForm');
  if (f) f.onsubmit = (e) => { e.preventDefault(); ceviEnviar($('#ceviInput').value); };
  const mic = $('#ceviMic');
  if (mic) mic.onclick = () => {
    if (!HAY_DICTADO) { ceviAviso('Tu navegador no puede escuchar. Escríbeme tu pregunta aquí abajo.'); return; }
    marca('voz');
    ceviVozAbrir();
  };
  // Dentro de la pantalla de voz: el toro y el micrófono hacen lo mismo; la equis sale.
  const orbeBtn = $('#ceviVozOrbe'), micVoz = $('#ceviVozMic'), cerrar = $('#ceviVozCerrar');
  if (orbeBtn) orbeBtn.onclick = ceviVozToque;
  if (micVoz) micVoz.onclick = ceviVozToque;
  if (cerrar) cerrar.onclick = ceviVozCerrar;
  document.onkeydown = (e) => { if (e.key === 'Escape' && cevi.enVoz) ceviVozCerrar(); };
  const alt = $('#ceviVoz');
  if (alt) alt.onclick = (e) => {
    const activa = !ceviVozActiva();
    try { localStorage.setItem('c4v_cevi_voz', activa ? '1' : '0'); } catch {}
    e.currentTarget.setAttribute('aria-pressed', activa);
    e.currentTarget.innerHTML = activa ? CEVI_ICONOS.audioOn : CEVI_ICONOS.audioOff;
    if (!activa) { ceviParaVoz(); if (cevi.estado === 'hablando') ceviEstado('reposo'); }
  };
  (raiz || document).querySelectorAll('#ceviSug .chip').forEach(b => b.onclick = () => ceviEnviar(b.dataset.q));
}

/* La página de CeVi arranca igual que el panel: saluda y se queda escuchando. */
function ceviPaginaIniciar() {
  const g = $('#ceviPagina');
  if (!g) return;
  cevi.cerrando = false;
  cevi.abierto = true;
  cevi.modo = HAY_DICTADO ? 'voz' : 'texto';
  g.dataset.ceviModo = cevi.modo;
  ceviCablear(g);
  ceviEstado('reposo');
  orbeArrancar();
  ceviDespertarBackend();
  ceviPrecargarRelleno();

  const cli = currentClient();
  const maq = cli ? state.db.maquinas.find(m => m.cliente_id === cli.id) : null;
  const primera = !cevi.historial.length;
  if (primera) {
    cevi.historial.push({
      role: 'assistant',
      /* Corto y en pregunta. El saludo largo tardaba ocho segundos en decirse y
         la persona no podía hablar hasta el final; además una pregunta invita a
         contestar, que es justo lo que hace falta en un asistente de voz. */
      content: `Hola${cli ? ' ' + primerNombre(cli.nombre) : ''}, soy CeVi. ¿En qué te ayudo con tu ${maq?.modelo || 'máquina'}?`
    });
  }
  ceviPintar();
  /* El saludo se muestra ESCRITO y no se dice solo.
     En iPhone, Safari solo deja sonar un <audio> que arrancó dentro del mismo
     toque de la persona. Llegar aquí desde el menú no cuenta como ese toque:
     el saludo se quedaba mudo y, peor, el estado se atascaba en "hablando",
     que es por qué el micrófono parecía roto. Ahora el altavoz se desbloquea
     en el primer toque del micrófono y a partir de ahí la conversación fluye. */
  ceviEstado('reposo');
  if (primera) ceviPedirTts(ceviTrozos(cevi.historial[0].content)[0]).catch(() => {});
  if (!HAY_DICTADO) ceviAviso('Tu navegador no puede escuchar. Escríbeme tu pregunta aquí abajo.');
}

/* Pitidos de cambio de turno. Quien está hablando no mira la pantalla, así que
   el orbe no le sirve: necesita oír cuándo le toca. Se generan con WebAudio,
   sin descargar ningún archivo. */
function ceviPitido(tipo) {
  const ctx = orbeCtx();
  if (!ctx || ctx.state !== 'running') return;
  const notas = { escucho: [660, 990], listo: [880, 587], falla: [400, 300] }[tipo];
  if (!notas) return;
  try {
    const t = ctx.currentTime;
    notas.forEach((hz, i) => {
      const osc = ctx.createOscillator(), gan = ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = hz;
      const t0 = t + i * 0.085;
      gan.gain.setValueAtTime(0, t0);
      gan.gain.linearRampToValueAtTime(0.075, t0 + 0.012);
      gan.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.13);
      osc.connect(gan); gan.connect(ctx.destination);
      osc.start(t0); osc.stop(t0 + 0.15);
    });
  } catch {}
}

/* ---------- Guiar la conversación ----------
   Un asistente de voz sin pistas deja a la gente muda: no sabe qué se le puede
   pedir. Después de cada respuesta se ofrecen dos o tres caminos concretos, y
   siempre queda a la vista la salida a una persona de carne y hueso. */
const PISTAS = {
  inicio: ['¿Con qué potencia corto MDF de 3 mm?', '¿Cada cuánto cambio el agua del chiller?', 'Mi láser dejó de cortar bien'],
  corte:  ['¿Y para acrílico de 3 mm?', '¿Cómo sé si la lente está sucia?', 'Se quema el material'],
  falla:  ['Sigue igual', '¿Lo puede ver un técnico?', '¿Está en garantía?'],
  limpieza: ['¿Qué necesito para limpiarla?', '¿Cada cuánto reviso los espejos?', '¿Y el pozo a tierra?'],
  general: ['Cuéntame más', '¿Qué más debería revisar?', 'Quiero hablar con una persona']
};

// Elige el juego de pistas por lo que se acaba de decir. Sin adivinar de más.
function ceviPistas() {
  const ultimo = [...cevi.historial].reverse().find(m => m.role === 'user');
  if (!ultimo) return PISTAS.inicio;
  const t = ultimo.content.toLowerCase();
  // La avería primero: "dejó de cortar bien" es una falla, no una pregunta de parámetros.
  if (/(no corta|falla|error|alarma|se apag|se quema|humo|problema|dej[óo] de|ya no|se traba|raro)/.test(t)) return PISTAS.falla;
  if (/(potencia|velocidad|corto|cortar|acr[íi]lico|mdf|grabar|material)/.test(t)) return PISTAS.corte;
  if (/(limpi|lente|espejo|mantenimiento|agua|chiller|filtro)/.test(t)) return PISTAS.limpieza;
  return PISTAS.general;
}

function ceviPintarPistas() {
  const box = $('#ceviSug');
  if (!box) return;
  const pistas = ceviPistas();
  box.innerHTML = pistas.map(q => `<button type="button" class="chip" data-q="${esc(q)}">${esc(q)}</button>`).join('')
    + '<a class="chip chip-persona" href="#/soporte">Hablar con una persona</a>';
  box.hidden = false;
  box.querySelectorAll('.chip[data-q]').forEach(b => b.onclick = () => ceviEnviar(b.dataset.q));
}


/* ---------- Relleno de espera ----------
   Entre que dejas de hablar y CeVi contesta pasan unos dos segundos y medio: es
   lo que tarda el modelo. Dos segundos y medio de silencio se sienten eternos,
   así que se precargan unas muletillas cortas y se suelta una al instante,
   igual que hace una persona cuando está pensando la respuesta. */
const MULETILLAS = ['Déjame ver.', 'Un momento.', 'Ya te digo.', 'A ver.'];
const relleno = { audios: [], cargando: false, timer: null, ultima: null };

async function ceviPrecargarRelleno() {
  if (relleno.audios.length || relleno.cargando || !CFG.ceviApi || !CFG.ceviVoz) return;
  relleno.cargando = true;
  try {
    const urls = await Promise.all(MULETILLAS.map(t => ceviPedirTts(t).catch(() => null)));
    relleno.audios = urls.filter(Boolean);
  } catch {}
  relleno.cargando = false;
}

/* Arma la muletilla, no la suelta: solo suena si a los 800 ms la respuesta
   todavía no llegó. Soltarla siempre hacía que en las respuestas rápidas se
   oyera "Un momento" pegado a la respuesta, y sonaba a tartamudeo. */
function ceviArmarRelleno() {
  clearTimeout(relleno.timer);
  if (cevi.modo !== 'voz' || !CFG.ceviVoz) return;
  relleno.timer = setTimeout(() => {
    if (cevi.estado !== 'pensando' || !relleno.audios.length) return;
    let url;
    do { url = relleno.audios[Math.floor(Math.random() * relleno.audios.length)]; }
    while (relleno.audios.length > 1 && url === relleno.ultima);
    relleno.ultima = url;
    try { const a = ceviReproductor(); a.src = url; a.play().catch(() => {}); } catch {}
  }, 800);
}

function ceviCancelarRelleno() {
  clearTimeout(relleno.timer);
  const a = cevi.reproductor;
  if (a && relleno.audios.includes(a.src)) { try { a.pause(); } catch {} }
}

/* Railway duerme el servicio: el primer turno pagaba el arranque en frío. Al
   abrir se le da un toque para que esté listo cuando llegue la pregunta. */
let ceviDespertado = 0;
function ceviDespertarBackend() {
  const ahora = Date.now();
  if (!CFG.ceviApi || ahora - ceviDespertado < 120000) return;
  ceviDespertado = ahora;
  fetch(`${CFG.ceviApi}/health`, { cache: 'no-store' }).catch(() => {});
}



/* El asistente ya no es un botón que flota encima del contenido: es una sección
   del menú, como Inicio o Academia. Si no hay backend, se esconde del menú en
   vez de fingir que existe. */
function initAgente() {
  if (!CFG.ceviApi) {
    const enlace = document.querySelector('.menu a[data-nav="cevi"]');
    if (enlace) enlace.hidden = true;
  }
}






async function pedirEstadoGuia() {
  if (modoDemo()) return;
  const ses = leerSesion();
  if (!ses?.t) return;
  const r = await apiPost('/api/mi-guia/estado', { token: ses.t });
  if (r.ok) state.guiaPorCorreo = r.json;
}

function bindCorreo() {
  const form = $('#correoForm');
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const email = $('#correoInput').value.trim();
      const msg = $('#correoMsg'), btn = form.querySelector('button');
      msg.hidden = true; msg.className = 'correo-msg';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        msg.hidden = false; msg.classList.add('mal'); msg.textContent = 'Revisa tu correo: parece que falta algo.'; return;
      }
      btn.disabled = true; btn.textContent = 'Enviando…';
      const ses = leerSesion();
      const r = await apiPost('/api/mi-guia', { token: ses?.t, email });
      btn.disabled = false; btn.textContent = 'Enviármela';
      if (r.json.ok) { state.guiaPorCorreo = { enviada: true, email }; render('preparacion'); toast('📩 Te la enviamos. Revisa tu correo.'); return; }
      msg.hidden = false; msg.classList.add('mal');
      msg.textContent = r.json.error || 'No pudimos enviarla ahora. Tu guía sigue aquí, completa.';
    };
  }
  const otra = $('#correoOtra');
  if (otra) otra.onclick = () => { state.guiaPorCorreo = null; render('preparacion'); setTimeout(() => $('#correoInput')?.focus(), 80); };
}

// ---------- pie legal (datos del proveedor + accesos obligatorios) ----------
/* El consumidor debe poder ver CON QUIÉN contrata y llegar al Libro de
   Reclamaciones desde cualquier página. Si falta un dato societario, se avisa
   en rojo: es preferible verlo nosotros a publicar un pie incompleto. */
/* Devuelve los datos de la empresa que le vendió a ESTE cliente. Si no lo
   sabemos (aún no sincronizado, o visitante sin sesión), la de por defecto. */
function empresaDelCliente() {
  const reg = CFG.empresas || {};
  const clave = state.empresaVendedora || CFG.empresaPorDefecto;
  const datos = reg[clave] || reg[CFG.empresaPorDefecto] || {};
  return { ...datos, ...(CFG.contacto || {}) };
}
window.empresaDelCliente = empresaDelCliente;

function pintarPieLegal() {
  const pie = $('#pieLegal');
  if (!pie) return;
  const e = empresaDelCliente();
  const faltan = ['razon_social', 'ruc', 'domicilio'].filter(k => !e[k]);
  // Se avisa por consola a quien mantiene el portal, nunca en pantalla: el
  // cliente no tiene por qué enterarse de nuestros pendientes internos.
  if (faltan.length) console.warn('[C4V] Faltan datos del proveedor en config.js:', faltan.join(', '));
  /* Qué se queda y por qué:
     - Razón social, RUC y domicilio: el consumidor debe poder saber CON QUIÉN
       contrata (Ley 29571).
     - Libro de Reclamaciones: obligatorio y visible desde cualquier página
       (Ley 29571 y DS 011-2011-PCM). Va primero y con más peso que el resto.
     - Privacidad, Términos y el acceso a los datos personales: Ley 29733.
     Se retiraron el teléfono fijo y el correo: el canal de atención es WhatsApp,
     y el correo para ejercer derechos sobre datos personales sigue publicado
     dentro de la Política de Privacidad, que es donde la ley lo pide. */
  /* Tres líneas y nada más. Lo que la ley obliga a mostrar sigue todo aquí:
     el Libro de Reclamaciones (Ley 29571), la política de datos (Ley 29733) y
     quién es el proveedor. Solo se quitó el adorno. */
  pie.innerHTML = `
    <nav class="pie-enlaces" aria-label="Información legal">
      <a href="libro-reclamaciones.html" class="pie-lr" target="_blank" rel="noopener">Libro de Reclamaciones</a>
      <a href="privacidad.html" target="_blank" rel="noopener">Privacidad</a>
      <a href="terminos.html" target="_blank" rel="noopener">Términos</a>
      <a href="privacidad.html#derechos" target="_blank" rel="noopener">Mis datos</a>
    </nav>
    <p class="pie-empresa">C4V Láser</p>`;
}

// ---------- init ----------
/* Los iconos del menú se pintan aquí y no en el HTML para no repetir el SVG
   entero tres veces: el <span> solo lleva el nombre del icono. */
function pintarIconosMenu() {
  document.querySelectorAll('.menu-ic[data-ic]').forEach(el => { el.innerHTML = icon(el.dataset.ic); });
}

async function init() {
  pintarIconosMenu();
  state.db = await loadDB();
  const cargando = document.getElementById('bootCargando');
  if (cargando) cargando.remove();
  $('#logoutBtn').onclick = () => { borrarSesion(); location.reload(); };
  initAgente();
  pintarPieLegal();
  initGate();

  // Sesión recordada: entra directo con el token firmado, sin pedir código otra vez.
  // Si el token venció o el servidor lo rechaza, se queda en el gate sin ruido.
  const ses = leerSesion();
  if (ses && ses.t) {
    try {
      const res = await entrarConToken(ses.t);
      if (res.estado === 'ok') entrar(res.cliente);
    } catch {}
  }
}
init();
