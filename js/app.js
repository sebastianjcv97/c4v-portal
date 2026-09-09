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

// ---------- SVG mini-previews (plantillas) ----------
const THUMBS = {
  llaveros: '<rect x="52" y="34" width="96" height="52" rx="14"/><circle cx="70" cy="52" r="7"/><line x1="92" y1="60" x2="132" y2="60"/>',
  cajas: '<path d="M60 45 L100 32 L140 45 L100 58 Z"/><path d="M60 45 V85 L100 98 V58"/><path d="M140 45 V85 L100 98"/>',
  senaletica: '<rect x="58" y="34" width="84" height="44" rx="6"/><line x1="72" y1="50" x2="128" y2="50"/><line x1="72" y1="62" x2="112" y2="62"/><line x1="100" y1="78" x2="100" y2="92"/>',
  toppers: '<path d="M100 30 l6 14 15 1 -11 10 4 15 -14 -8 -14 8 4 -15 -11 -10 15 -1 z"/><line x1="100" y1="70" x2="100" y2="94"/><rect x="80" y="92" width="40" height="6" rx="3"/>',
  moda: '<path d="M74 40 l14 -6 6 8 12 0 6 -8 14 6 -8 14 -6 -3 v27 h-28 v-27 l-6 3 z"/>',
  arquitectura: '<path d="M70 58 L100 40 L130 58"/><rect x="76" y="58" width="48" height="30"/><line x1="94" y1="58" x2="94" y2="88"/><line x1="112" y1="58" x2="112" y2="88"/>',
  regalos: '<rect x="64" y="46" width="72" height="44" rx="4"/><line x1="100" y1="46" x2="100" y2="90"/><path d="M100 46 c-10 -14 -24 -2 0 0 c10 -14 24 -2 0 0"/>'
};
const thumb = (key) => `<svg aria-hidden="true" viewBox="0 0 200 120" fill="none" stroke="#F9020B" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">${THUMBS[key] || '<rect x="60" y="40" width="80" height="40" rx="6"/>'}</svg>`;

// Sello del Certificado de Calidad C4V (de P2/COMUNICACION.md)
const CANDADO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" style="width:14px;height:14px"><rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"/></svg>`;
const SEAL = `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Certificado de Calidad C4V"><circle cx="100" cy="100" r="96" fill="#fdeeee" stroke="#F9020B" stroke-width="5"/><circle cx="100" cy="100" r="84" fill="none" stroke="#F9020B" stroke-width="1.5" stroke-dasharray="2 4"/><text x="100" y="54" text-anchor="middle" font-family="'Roboto Slab', serif" font-size="12" font-weight="700" letter-spacing="2" fill="#c40309">CERTIFICADO</text><text x="100" y="70" text-anchor="middle" font-family="'Roboto Slab', serif" font-size="10" letter-spacing="4" fill="#141414">DE CALIDAD</text><text x="100" y="121" text-anchor="middle" font-family="'Roboto Slab', serif" font-size="38" font-weight="800" fill="#F9020B">C4V</text><text x="100" y="150" text-anchor="middle" font-family="'Roboto', sans-serif" font-size="8.5" font-weight="700" letter-spacing="1.5" fill="#141414">PROBADA · CALIBRADA · LISTA</text></svg>`;

// Íconos de línea (profesional, sin emojis)
const ICONS = {
  academia: '<path d="M12 6.5C12 5 10 4 7.5 4S4 4.8 4 4.8v13s1-.8 3.5-.8 4.5 1 4.5 1"/><path d="M12 6.5C12 5 14 4 16.5 4S20 4.8 20 4.8v13s-1-.8-3.5-.8-4.5 1-4.5 1"/><path d="M12 6.5v11"/>',
  soporte: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H9l-4.5 4z"/>',
  bolsa: '<rect x="3" y="7.5" width="18" height="12" rx="2"/><path d="M8.5 7.5v-2A1.5 1.5 0 0 1 10 4h4a1.5 1.5 0 0 1 1.5 1.5v2"/>',
  disenos: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2"/>',
  prep: '<path d="M9 3v4M15 3v4M7 7h10v5a5 5 0 0 1-10 0z"/><path d="M12 17v4"/>',
  cevi: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v7A1.5 1.5 0 0 1 18.5 14H9l-4.5 3.5z"/><path d="M9 8.5h6M9 11h3.5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.4 2.4 0 1 1 3.1 2.3c-.7.3-1.1.8-1.1 1.6"/><path d="M12 16.4h.01"/>'
};
const icon = (n) => `<svg class="ic" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICONS[n] || ''}</svg>`;

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
const views = {
  /* Pantalla única: saludo + tu máquina + 5 botones grandes. Nada más.
     Todo lo demás vive DENTRO de esos botones. */
  inicio() {
    const d = state.db, cli = currentClient();
    const maq = cli ? d.maquinas.find(m => m.cliente_id === cli.id) : null;
    const lista = maq ? d.maquinas.filter(m => m.cliente_id === cli.id) : [];
    const certificada = maq?.certificado?.estado === 'certificada';
    // 'desconocido' = el dato no está en Odoo. No es lo mismo que "en calibración":
    // afirmarlo sería prometerle al cliente algo que no podemos comprobar.
    const enRevision = ['en_revision', 'en_proceso'].includes(maq?.certificado?.estado);
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
      <h1 class="saludo">${cli ? `Hola, ${esc(primerNombre(cli.nombre))}` : 'Hola'}</h1>

      ${maq ? `<a class="maq" href="#/certificado">
        <div class="maq-seal">${SEAL}</div>
        <div class="maq-txt">
          <strong>Tu láser ${esc(maq.modelo)}</strong>
          <span>${certificada
            ? 'Probada y calibrada. Ver tu Certificado de Calidad'
            : enRevision
              ? 'La estamos probando y calibrando. Ver qué significa'
              : 'Ver tu Certificado de Calidad'}</span>
          ${lista.length > 1 ? `<span class="muted">y ${lista.length - 1} máquina${lista.length > 2 ? 's' : ''} más</span>` : ''}
        </div>
        <div class="big-arrow" aria-hidden="true">›</div></a>` : ''}

      ${prep.completo ? `
      <a class="prep-cta lista" href="#/academia">
        <div class="prep-cta-top"><strong>Ya tienes todo listo</strong><span>${prep.total} de ${prep.total}</span></div>
        <p>Ahora aprende a usar tu máquina.</p>
        <span class="prep-cta-btn">Ir a la Academia</span>
      </a>` : `
      <a class="prep-cta" href="#/preparacion">
        <div class="prep-cta-top"><strong>Empieza por aquí</strong><span>${prep.n} de ${prep.total}</span></div>
        <div class="bar"><i style="width:${prep.total ? Math.round(prep.n / prep.total * 100) : 0}%"></i></div>
        <p>Cinco pasos para dejar tu espacio listo.</p>
        <span class="prep-cta-btn">Ver mis primeros pasos</span>
      </a>`}

      <div class="bigs">
        <a class="big" href="#/cevi">
          <div class="big-ico"><span class="toro" aria-hidden="true"></span></div>
          <div class="big-txt"><strong>Habla con CeVi</strong><span>Pregúntale en voz alta</span></div>
          <div class="big-arrow" aria-hidden="true">›</div>
        </a>
        ${bigBtn('#/soporte', 'soporte', 'Necesito ayuda', 'Escríbenos por WhatsApp')}
        ${bigBtn('#/bolsa', 'bolsa', 'Trabajos para ti', 'Encargos de corte que te pasamos gratis')}
        ${bigBtn('#/plantillas', 'disenos', 'Diseños para cortar', 'Listos para usar, incluidos con tu máquina')}
      </div>`;
  },

  academia() {
    const a = state.db.academia, faqs = state.db.faqs, m = state.db.modelos;
    const fmtDur = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    const vistoKey = (v) => 'c4v_video_' + state.ctx + '_' + v;
    const visto = (v) => { try { return localStorage.getItem(vistoKey(v)) === '1'; } catch { return false; } };
    // Una lección puede ser texto (string) o video ({t, v, dur})
    const leccion = (l) => typeof l === 'string'
      ? `<li>${esc(l)}</li>`
      : `<li class="lesson-video${visto(l.v) ? ' visto' : ''}" data-video="${esc(l.v)}">
           <button type="button" class="lv-btn">
             <span class="lv-play" aria-hidden="true">▶</span>
             <span class="lv-tit">${esc(l.t)}</span>
             <span class="lv-dur">${visto(l.v) ? 'visto, ' : ''}${fmtDur(l.dur)}</span>
           </button>
           <div class="lv-player" hidden></div>
         </li>`;
    const mejorPuntaje = (k) => { try { return JSON.parse(localStorage.getItem('c4v_quiz_' + state.ctx + '_' + k) || 'null'); } catch { return null; } };
    // Sirve para CUALQUIER curso (c0, c1, c2, c3…). Solo cuenta preguntas bien formadas,
    // para no romper la vista si otro agente aún está agregando quizzes en data.js.
    const preguntasValidas = (m) => (m.preguntas || []).filter(p => p && p.q && Array.isArray(p.opciones) && p.opciones.length);
    const quizBox = (c, m, mi) => {
      const preguntas = preguntasValidas(m);
      if (!preguntas.length) return '';
      const k = c.id + '-' + mi, mejor = mejorPuntaje(k);
      const logro = mejor ? `<span class="qz-logro${mejor.p >= 70 ? ' ok' : ''}">${mejor.p >= 70 ? '🏅' : '📝'} Tu mejor puntaje: ${mejor.b}/${mejor.n}</span>` : '';
      return `<div class="quiz-box" data-key="${k}" data-curso="${c.id}" data-mod="${mi}">
          <button type="button" class="qz-start">Ponte a prueba <span>(${preguntas.length} preguntas)</span></button>${logro}
          <div class="qz-area" hidden></div>
        </div>`;
    };
    const cursoCard = (c, i) => {
      const estado = c.estado === 'disponible' ? '<span class="badge ok">Disponible</span>' : c.estado === 'en_proceso' ? '<span class="badge warn">En construcción</span>' : '<span class="badge grey">Próximamente</span>';
      const nLes = c.modulos.reduce((s, m) => s + m.lecciones.length, 0);
      const esVideo = c.modulos.some(m => m.lecciones.some(l => typeof l !== 'string'));
      return `<div class="course" id="curso-${esc(c.id)}"><button type="button" class="course-head" aria-expanded="false">
          <div class="course-ico">${i + 1}</div>
          <div style="flex:1"><h3>${esc(c.titulo)} ${estado} ${esVideo ? '<span class="badge red">en video</span>' : ''}</h3>
            <div class="sub">${esc(c.descripcion)}</div>
            <div class="sub">${esc(c.nivel)}. ${c.modulos.length} módulos, ${nLes} lecciones.</div></div>
          <span class="chev" aria-hidden="true">+</span></button>
        <div class="course-body">
          ${c.modulos.map((m, mi) => `<div class="module">
            <h4><span class="num-mod">${mi + 1}</span> ${esc(m.titulo)}</h4>
            ${m.lecciones.length ? `<ul class="lessons">${m.lecciones.map(leccion).join('')}</ul>` : ''}
            ${quizBox(c, m, mi)}
          </div>`).join('')}
        </div></div>`;
    };
    const faqCats = [...new Set(faqs.map(f => f.categoria))];
    return `
      <div class="page-head"><p>${esc(a.acceso)}</p></div>

      ${a.seguridad ? `
      <div class="card peligro">
        <h2 class="section-h" style="margin-top:0">${esc(a.seguridad.titulo)}</h2>
        <ul class="lista-peligro">
          ${a.seguridad.puntos.map(x => `<li><strong>${esc(x.t)}.</strong> ${esc(x.d)}</li>`).join('')}
        </ul>
      </div>` : ''}
      <div class="chips-row ruta">${a.ruta.map((r, i) => {
        const t = typeof r === 'string' ? { t: r } : r;
        const href = t.href || (t.curso ? '#curso-' + t.curso : '');
        return t.proximamente
          ? `<span class="chip soon" title="${esc(t.proximamente)}">${i + 1}. ${esc(t.t)} <small>próximamente</small></span>`
          : `<a class="chip" href="${href}">${i + 1}. ${esc(t.t)}</a>`;
      }).join('')}</div>

      ${a.pilares ? `<div class="grid cols-3 pilares">${a.pilares.map(p => `<div class="card pilar${p.estado === 'proximamente' ? ' soon' : ''}">
          <h3>${esc(p.titulo)}</h3><p>${esc(p.detalle)}</p>
          <span class="badge ${p.estado === 'proximamente' ? 'grey' : 'ok'}">${p.estado === 'proximamente' ? 'Próximamente' : 'Disponible'}</span>
          ${p.cursos ? `<span class="pilar-meta">${esc(p.cursos)}</span>` : ''}
        </div>`).join('')}</div>` : ''}

      <h2 class="section-h">Cursos por módulos</h2>
      ${a.cursos.map(cursoCard).join('')}

      ${a.parametros ? `
      <h2 class="section-h">Parámetros por material (potencia / velocidad)</h2>
      <div class="card">
        <p style="margin:0 0 12px">${esc(a.parametros.intro)}</p>
        <div class="tabla-scroll">
          <table class="tabla-params"><thead><tr>
            <th>Material</th><th>Grosor</th><th>Corte<br><span>Potencia / velocidad</span></th><th>Marcado<br><span>Potencia / velocidad</span></th><th>Grabado<br><span>Potencia / velocidad</span></th><th>Seal</th>
          </tr></thead>
          <tbody>${a.parametros.filas.map(f => `<tr><td><strong>${esc(f.m)}</strong></td><td>${esc(f.g)}</td><td>${esc(f.corte)}</td><td>${esc(f.marcado)}</td><td>${esc(f.grabado)}</td><td>${esc(f.seal)}</td></tr>`).join('')}</tbody></table>
        </div>
        <p class="muted" style="margin:12px 0 0;font-size:13px">${esc(a.parametros.nota)}</p>
        <h3 style="margin:16px 0 8px;font-size:15px">Cómo aplicarlos en RDWorks</h3>
        <ol class="acceso-pasos">${a.parametros.rdworks.map(x => `<li>${esc(x)}</li>`).join('')}</ol>
      </div>` : ''}

      ${a.guiasPdf ? `
      <h2 class="section-h">Guías técnicas para descargar (PDF)</h2>
      <div class="grid cols-3">
        ${a.guiasPdf.map(g => `<button type="button" class="card pdf-card" data-guia="${esc(g.archivo)}">
          <div class="pdf-ico">PDF</div>
          <h3>${esc(g.titulo)}</h3>
          <p>${esc(g.desc)}</p>
          <span class="pdf-dl">Descargar, ${esc(g.tam)}</span>
        </button>`).join('')}
      </div>` : ''}

      <h2 class="section-h">Próximamente</h2>
      <ul class="proximo">${a.proximamente.map(p => `<li>${esc(p)}</li>`).join('')}</ul>

      <h2 class="section-h">Conoce la línea C4V</h2>
      <p class="muted" style="margin:0 0 12px">${esc(m.intro)}</p>
      <div class="card tabla-scroll" style="padding:0">
        <table class="table"><thead><tr><th>Modelo</th><th>Área</th><th>Ideal para</th><th>Ref. (PE)</th></tr></thead>
        <tbody>${m.items.map(x => `<tr><td><strong>${esc(x.modelo)}</strong></td><td>${esc(x.area)}</td><td>${esc(x.ideal)}</td><td class="muted">${esc(x.precio)}</td></tr>`).join('')}</tbody></table>
      </div>
      <div class="grid cols-2" style="margin-top:14px">
        <div class="card"><h3>Materiales</h3><p>${esc(m.materiales)}</p></div>
        <div class="card"><h3>Mejoras nuevas</h3><p>${esc(m.mejoras)}</p></div>
      </div>
      ${m.incluye ? `<p class="muted" style="margin:12px 0 0;font-size:14px">${esc(m.incluye)}</p>` : ''}

      <h2 class="section-h">Prepara tu espacio</h2>
      <div class="help-card"><div class="grow"><h3>Antes de instalar, deja tu espacio listo</h3>
        <p>Checklist imprimible y guías paso a paso: eléctrico, pozo a tierra, extracción y agua destilada.</p></div>
        <a class="btn primary sm" href="#/preparacion">Abrir la guía</a></div>

      <h2 class="section-h">Preguntas frecuentes</h2>
      ${faqCats.map(cat => `<h4 style="font-size:14px;margin:16px 0 8px">${esc(cat)}</h4>
        ${faqs.filter(f => f.categoria === cat).map(f => `<div class="faq-item"><button type="button" class="faq-q" aria-expanded="false"><span>${esc(f.pregunta)}</span><span class="chev" aria-hidden="true">+</span></button><div class="faq-a">${esc(f.respuesta)}</div></div>`).join('')}`).join('')}`;
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

    if (hechos === total) {
      return `
        <div class="paso-fin">
          <h2>Tu espacio está listo</h2>
          <p>Ya puedes recibir tu máquina con confianza.</p>
          <a class="btn primary" href="#/academia">Aprender a usarla</a>
          <button type="button" class="paso-link" data-ir="0">Volver a ver la guía</button>
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

        <div class="paso-pie">
          <button type="button" class="btn primary paso-listo" data-paso="${esc(c.id)}">${hecho ? 'Siguiente' : 'Ya lo hice'}</button>
          ${n > 0 ? `<button type="button" class="paso-link" data-ir="${n - 1}">Atrás</button>` : ''}
        </div>
      </section>`;
  },

  /* Página propia de CeVi. Es el mismo asistente que el botón flotante, con los
     mismos ids, así que todo lo que ya funciona sirve tal cual. Aquí el orbe se
     lleva la pantalla, que es lo que pidió el modo voz. */
  cevi() {
    const cli = currentClient();
    const maq = cli ? state.db.maquinas.find(m => m.cliente_id === cli.id) : null;
    const nombre = primerNombre(cli?.nombre);
    return `
      <section class="cevi-pag" id="ceviPagina" data-cevi-estado="reposo" data-cevi-modo="voz">
        <p class="cevi-pag-intro">${nombre ? `Háblale, ${esc(nombre)}` : 'Háblale'}. Te contesta en voz alta sobre${maq?.modelo ? ` tu ${esc(maq.modelo)}` : ' tu máquina'}: potencias, mantenimiento y fallas.</p>

        <div class="cevi-pag-orbe">
          <button type="button" class="cevi-voz-btn" id="ceviVozBtn" aria-label="Hablar con CeVi">
            ${orbeHTML('gigante')}
          </button>
          <span class="cevi-voz-txt" id="ceviVozTxt">Toca para hablar</span>
          <p class="cevi-dictado" id="ceviDictado" aria-live="polite"></p>
        </div>

        <p class="cevi-aviso" id="ceviAviso" role="status" hidden></p>

        <div class="cevi-msgs" id="ceviMsgs" role="log" aria-live="polite" aria-label="Conversación con CeVi"></div>

        <div class="cevi-sug" id="ceviSug">
          ${['¿Con qué potencia corto MDF de 3 mm?', '¿Cada cuánto cambio el agua del chiller?', 'Mi láser dejó de cortar bien']
            .map(q => `<button type="button" class="chip" data-q="${esc(q)}">${esc(q)}</button>`).join('')}
        </div>

        <form class="cevi-form" id="ceviForm">
          <input id="ceviInput" type="text" autocomplete="off" placeholder="${nombre ? `Escríbeme, ${esc(nombre)}` : 'Escribe tu pregunta'}" aria-label="Tu pregunta para CeVi">
          <button type="submit" class="cevi-send" aria-label="Enviar">${CEVI_ICONOS.enviar}</button>
        </form>

        <div class="cevi-pag-pie">
          <button type="button" class="cevi-cambiar" id="ceviEscribir">Prefiero escribir</button>
          <button type="button" class="cevi-cambiar" id="ceviHablarBtn">Prefiero hablar</button>
          <button type="button" class="cevi-cambiar" id="ceviLimpiar">Empezar de nuevo</button>
        </div>
        <p class="cevi-pie">CeVi responde solo, con inteligencia artificial. Si el tema es serio, te pasamos con una persona del equipo.</p>
      </section>`;
  },

  soporte() {
    const d = state.db, cli = currentClient(), sop = d.soporte;
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
      ${refMaq ? `<p class="wa-ctx muted">Tu mensaje ya lleva los datos de tu máquina (<strong>${esc(refMaq)}</strong>) para atenderte más rápido.</p>` : ''}

      <div class="help-card cevi-card">
        <div class="big-ico" aria-hidden="true"><span class="toro"></span></div>
        <div class="grow"><h3>¿Quieres una respuesta ahora mismo?</h3>
          <p>Háblale a CeVi y te contesta en voz alta sobre potencias, mantenimiento y fallas. Si no puede, te pasa con una persona.</p></div>
        <a class="btn primary sm" href="#/cevi">Habla con CeVi</a>
      </div>

      ${(sop.lives || sop.redes) ? `
      <h2 class="section-h">Otras formas de encontrarnos</h2>
      <div class="card redes">
        ${sop.lives ? `<p><strong>Clases en vivo:</strong> ${esc(sop.lives)}</p>` : ''}
        ${sop.redes ? `<p class="redes-links">
          ${sop.redes.tiktok ? `<a href="${esc(sop.redes.tiktok_url || '#')}" target="_blank" rel="noopener">TikTok ${esc(sop.redes.tiktok)}</a>` : ''}
          ${sop.redes.instagram ? `<span>Instagram ${esc(sop.redes.instagram)}</span>` : ''}
          ${sop.redes.facebook ? `<span>Facebook ${esc(sop.redes.facebook)}</span>` : ''}
          ${sop.fijo ? `<span>Teléfono fijo ${esc(sop.fijo)}</span>` : ''}
        </p>` : ''}
      </div>` : ''}

      <h2 class="section-h">Antes de escribir, mira si es algo común</h2>
      <p class="muted" style="margin:0 0 14px;font-size:15px">Estos son los problemas que más nos consultan. Muchos se resuelven en un minuto.</p>
      <div id="guiaList">
        ${d.soporte_guia.map(g => `<div class="faq-item guia"><button type="button" class="faq-q" aria-expanded="false"><span>${esc(g.titulo)}</span><span class="chev" aria-hidden="true">+</span></button>
          <div class="faq-a"><p style="margin:0 0 6px"><strong>Qué pasa:</strong> ${esc(g.sintoma)}</p>
          <p style="margin:0 0 6px"><strong>Por qué:</strong> ${esc(g.causas)}</p>
          <p style="margin:0 0 12px"><strong>Qué hacer:</strong> ${esc(g.accion)}</p>
          <a class="wa-inline" href="${waSoporte(`Sigo con este problema: «${g.titulo}».`)}" target="_blank" rel="noopener">${wa()}<span>Sigo igual, quiero escribir por WhatsApp</span></a></div></div>`).join('')}
      </div>`;
  },

  bolsa() {
    return `
      <div class="page-head">
        <p><strong>Beneficio gratis, solo para clientes C4V.</strong> Cada día nos escriben personas pidiendo servicio de corte láser. Nosotros no damos ese servicio — fabricamos las máquinas — así que sus pedidos se publican aquí <strong>para ti</strong>: tómalos, contáctalos y produce. El contacto se revela al tomar el trabajo.</p></div>
      <div class="toolbar"><div class="filters">
          <button class="chip active" data-filter="todos">Todos</button>
          <button class="chip" data-filter="PE">🇵🇪 Perú</button>
          <button class="chip" data-filter="EC">🇪🇨 Ecuador</button>
          <button class="chip" data-filter="BO">🇧🇴 Bolivia</button>
          <button class="chip" data-filter="CL">🇨🇱 Chile</button>
          <button class="chip" data-filter="CO">🇨🇴 Colombia</button></div>
        <button class="btn primary sm" id="newLeadBtn">+ Publicar solicitud</button></div>
      <div id="leadForm"></div>
      ${state.db.leads.length
        ? `<div class="list" id="leadList">${leadRows(state.db.leads)}</div>`
        : `<div class="card vacio" id="leadList">
             <h3>Todavía no hay trabajos publicados</h3>
             <p>${state.leadsCargados === false && !modoDemo()
                 ? 'No pudimos cargar los trabajos en este momento. Vuelve a intentarlo en un rato.'
                 : 'Cuando alguien nos pida un servicio de corte, lo publicamos aquí y podrás tomarlo. Vuelve a mirar en unos días.'}</p>
             <a class="btn ghost sm" href="${waLink('Hola, quiero que me avisen cuando publiquen trabajos en la Bolsa de C4V.')}" target="_blank" rel="noopener">Avísenme cuando haya trabajos</a>
           </div>`}
      <h2 class="section-h">Trae más trabajos a la red</h2>
      <div class="help-card">${icon('bolsa')}
        <div class="grow"><h3>¿Conoces a alguien que necesita corte láser?</h3>
          <p>Compártele el enlace de solicitudes: deja su pedido en 1 minuto y se publica en esta bolsa.</p></div>
        <a class="btn ghost sm" href="solicita.html" target="_blank" rel="noopener">Abrir página de solicitudes</a></div>`;
  },

  plantillas() {
    const pl = state.db.plantillas;
    return `
      <div class="page-head"><p>${esc(pl.intro)}</p></div>
      <div class="chips-row"><span class="badge warn">${esc(pl.estado)}</span></div>
      <div class="grid cols-3">
        ${pl.categorias.map(c => `<div class="card tpl">
          <div class="tpl-thumb">${thumb(c.key)}</div>
          <h3>${esc(c.categoria)}</h3>
          <p>${esc(c.descripcion)}</p>
          <div class="chips-row" style="margin:10px 0 12px">${c.ejemplos.map(e => `<span class="badge grey">${esc(e)}</span>`).join('')}<span class="badge info">${esc(c.formato)}</span></div>
          <span class="badge warn">Muy pronto</span>
        </div>`).join('')}
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
          <p class="cert-lema">«${esc(ci.lema)}»</p>
          <p class="muted" style="max-width:52ch">${esc(ci.frase_ancla)}</p></div>
      </div>

      ${maqs.length ? `<h2 class="section-h">${maqs.length > 1 ? 'Tus máquinas' : 'Tu máquina'}</h2>
      <div class="cert-maq-grid">${maqs.map(certMaq).join('')}</div>` : ''}

      <h2 class="section-h">Qué garantiza</h2>
      <div class="grid cols-2">
        <div class="card"><ul class="ulist">${ci.promesa.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>
        <div class="card"><p>${esc(ci.narrativa)}</p></div>
      </div>

      <h2 class="section-h">El recorrido de tu máquina</h2>
      <div class="card">${ci.etapas.map(e => `<div class="step"><div class="n">${e.n}</div><div><h4>${esc(e.titulo)}</h4><p>${esc(e.detalle)}</p></div></div>`).join('')}</div>

      <h2 class="section-h">Por qué lo hacemos</h2>
      <div class="grid cols-3">${ci.porque.map(x => `<div class="card"><h3>${esc(x.q)}</h3><p>${esc(x.a)}</p></div>`).join('')}</div>

      <h2 class="section-h">Así se ve tu certificado digital</h2>
      <div class="card" style="padding:12px"><img src="assets/certificado-calidad-c4v.png" alt="Certificado de Calidad C4V" class="cert-img" onerror="this.parentElement.remove()"/></div>

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
  view.querySelectorAll('[data-cevi]').forEach(b => b.onclick = () => ceviAbrir());
  // En la página de CeVi el botón flotante sobra: la página ya es el asistente.
  const flotante = $('#aiBtn');
  if (flotante) flotante.classList.toggle('oculto', route === 'cevi');
  if (route === 'cevi') { if (cevi.abierto && $('#aiPanel') && !$('#aiPanel').hidden) ceviCerrar(); ceviPaginaIniciar(); }
  else if (!$('#aiPanel') || $('#aiPanel').hidden) {
    // Al salir de la página, CeVi deja de escuchar y de hablar.
    cevi.manosLibres = false; cevi.abierto = false;
    ceviCallar(); ceviParaVoz(); orbeParar();
  }
  if (route === 'academia') { bindAccordions('.faq-item'); bindAccordions('.course'); bindVideos(); bindQuizzes(); bindGuias(); }
  if (route === 'preparacion') {
    /* Un solo botón por pantalla: marca el paso y pasa al siguiente. Antes había
       una casilla, un «¿Cómo lo hago?» y una barra que había que interpretar. */
    view.querySelectorAll('.paso-listo').forEach(b => b.onclick = () => {
      const id = b.dataset.paso;
      try { localStorage.setItem('c4v_prep_' + state.ctx + '_' + id, '1'); } catch {}
      const total = state.db.preparacion.checklist.length;
      state.paso = Math.min(state.paso + 1, total);
      const hechos = state.db.preparacion.checklist
        .filter(c => { try { return localStorage.getItem('c4v_prep_' + state.ctx + '_' + c.id) === '1'; } catch { return false; } }).length;
      if (hechos === total) state.paso = null;
      render('preparacion'); window.scrollTo(0, 0);
    });
    view.querySelectorAll('[data-ir]').forEach(b => b.onclick = () => {
      state.paso = Number(b.dataset.ir);
      render('preparacion'); window.scrollTo(0, 0);
    });
  }
  if (route === 'certificado') {
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
  if (route === 'soporte') bindAccordions('.faq-item');
  if (route === 'bolsa') {
    let filtro = 'todos';
    const apply = () => {
      const lista = filtro === 'todos' ? state.db.leads : state.db.leads.filter(l => l.pais === filtro);
      const caja = $('#leadList'); if (!caja) return;
      caja.innerHTML = lista.length ? leadRows(lista) : '<p class="muted" style="padding:18px">No hay trabajos publicados en ese país por ahora.</p>';
      bindTake();
    };
    view.querySelectorAll('[data-filter]').forEach(b => b.onclick = () => { filtro = b.dataset.filter; view.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c === b)); apply(); });
    $('#newLeadBtn').onclick = () => {
      const box = $('#leadForm'); if (box.innerHTML) { box.innerHTML = ''; return; }
      box.innerHTML = `<div class="card" style="margin-bottom:16px"><h3>Publicar una solicitud</h3>
        <form class="form" id="lf" style="margin-top:10px">
          <div class="field"><label>¿Qué trabajo es?</label><input name="titulo" placeholder="Ej: corte de 100 llaveros" required></div>
          <div class="field"><label>Detalle</label><textarea name="descripcion"></textarea></div>
          <div class="form-row"><div class="field"><label>Material</label><input name="material" placeholder="MDF 3mm"></div><div class="field"><label>Cantidad</label><input name="cantidad" placeholder="100 unidades"></div></div>
          <div class="form-row"><div class="field"><label>País</label><select name="pais"><option>PE</option><option>EC</option><option>BO</option><option>CL</option><option>CO</option></select></div><div class="field"><label>Ciudad</label><input name="ciudad"></div></div>
          <div class="form-row"><div class="field"><label>Nombre del cliente</label><input name="contacto" placeholder="Nombre" required></div><div class="field"><label>Teléfono o email</label><input name="telefono" placeholder="+51 …"></div></div>
          <button class="btn primary" type="submit">Publicar</button></form></div>`;
      $('#lf').onsubmit = async (e) => { e.preventDefault();
        try { await actions.crearLead(Object.fromEntries(new FormData(e.target))); toast(state.offline ? 'Solicitud guardada en esta demostración' : '✅ Solicitud publicada'); render('bolsa'); } catch { toast('No pudimos publicar tu solicitud. Revisa tu internet y vuelve a intentar: no perdiste lo que escribiste.'); } };
    };
    bindTake();
  }
}

// ---------- lecciones en video (Academia) ----------
/* Las guías en PDF también son contenido pagado: se piden firmadas en el
   momento, no cuelgan de una URL pública. */
function bindGuias() {
  view.querySelectorAll('.pdf-card[data-guia]').forEach(b => {
    b.onclick = async () => {
      const etiqueta = b.querySelector('.pdf-dl');
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

function bindVideos() {
  view.querySelectorAll('.lesson-video').forEach(li => {
    const btn = li.querySelector('.lv-btn'), box = li.querySelector('.lv-player'), archivo = li.dataset.video;
    btn.onclick = () => {
      const abierto = !box.hidden;
      // Solo un video abierto a la vez (ahorra datos y evita audios cruzados)
      view.querySelectorAll('.lv-player').forEach(p => { p.hidden = true; p.innerHTML = ''; });
      if (abierto) return;
      box.hidden = false;
      /* PENDIENTE: los videos siguen colgando de una ruta pública. Las guías ya
         salen firmadas desde /api/media; los videos no pueden hacerlo todavía
         porque sus 65 MB no caben en la subida de `railway up`. En cuanto estén
         en el volumen, esto pasa a `await enlaceMedio('videos', archivo)`. */
      box.innerHTML = `<video controls autoplay playsinline preload="none" controlsList="nodownload">
          <source src="videos/c4vtech/${archivo}" type="video/mp4">
          Tu navegador no puede reproducir este video.
        </video>`;
      const vid = box.querySelector('video');
      // Marcar como visto al llegar al 80%
      vid.ontimeupdate = () => {
        if (vid.duration && vid.currentTime / vid.duration > 0.8 && !li.classList.contains('visto')) {
          li.classList.add('visto');
          try { localStorage.setItem('c4v_video_' + state.ctx + '_' + archivo, '1'); } catch {}
          const dur = li.querySelector('.lv-dur');
          if (dur && !dur.textContent.includes('visto')) dur.textContent = '✓ visto · ' + dur.textContent;
        }
      };
    };
  });
}

// ---------- quizzes interactivos (Academia) ----------
// Fisher-Yates: el orden de las opciones cambia en cada intento, así la respuesta
// correcta no queda siempre en la misma posición (varios módulos la tenían fija).
function barajar(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
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
    let idx = 0, puntos = 0;

    const preguntar = () => {
      const p = preguntas[idx];
      area.innerHTML = `
        <div class="qz-prog">Pregunta ${idx + 1} de ${total}</div>
        <div class="qz-q">${esc(p.q)}</div>
        <div class="qz-opts">${barajar(p.opciones.map((_, i) => i)).map(i => `<button type="button" class="qz-opt" data-i="${i}">${esc(p.opciones[i])}</button>`).join('')}</div>
        <div class="qz-ex" hidden></div>`;
      area.querySelectorAll('.qz-opt').forEach(b => b.onclick = () => {
        const elegido = Number(b.dataset.i), acierto = elegido === p.ok;
        if (acierto) puntos++;
        area.querySelectorAll('.qz-opt').forEach(x => {
          x.disabled = true;
          if (Number(x.dataset.i) === p.ok) x.classList.add('ok');
          else if (Number(x.dataset.i) === elegido) x.classList.add('bad');
        });
        const ex = area.querySelector('.qz-ex');
        ex.hidden = false;
        ex.innerHTML = `${acierto ? '✅ <b>¡Correcto!</b>' : '❌ <b>Casi.</b>'} 🦉 ${esc(p.ex)}
          <button type="button" class="btn primary sm qz-next">${idx + 1 < total ? 'Siguiente pregunta' : 'Ver mi resultado 🏁'}</button>`;
        ex.querySelector('.qz-next').onclick = () => { idx++; idx < total ? preguntar() : terminar(); };
        ex.querySelector('.qz-next').focus();
      });
    };

    const terminar = () => {
      const pct = Math.round(puntos / total * 100), paso = pct >= 70;
      try {
        const k = 'c4v_quiz_' + state.ctx + '_' + box.dataset.key;
        const prev = JSON.parse(localStorage.getItem(k) || 'null');
        if (!prev || puntos > prev.b) localStorage.setItem(k, JSON.stringify({ b: puntos, n: total, p: pct }));
      } catch {}
      area.innerHTML = `
        <div class="qz-fin ${paso ? 'ok' : ''}">
          <div class="qz-emoji">${paso ? '🏅' : '💪'}</div>
          <div class="qz-nota">${puntos} de ${total} correctas</div>
          <p>${paso ? '¡Excelente! Dominas este módulo.' : 'Buen intento — repasa las lecciones y vuelve a probar. Tú puedes.'}</p>
          <button type="button" class="btn primary sm qz-retry">Intentar de nuevo</button>
        </div>`;
      area.querySelector('.qz-retry').onclick = () => { idx = 0; puntos = 0; preguntar(); };
    };

    start.onclick = () => {
      const abierto = !area.hidden;
      area.hidden = abierto;
      if (!abierto) { idx = 0; puntos = 0; preguntar(); }
    };
  });
}

// ---------- router ----------
/* Títulos cortos: los largos ("Aprender a usar mi máquina") no cabían en el
   menú ni en la cabecera del móvil. */
const TITLES = { inicio: 'Inicio', cevi: 'Habla con CeVi', academia: 'Academia', preparacion: 'Primeros pasos', soporte: 'Necesito ayuda', bolsa: 'Trabajos para ti', plantillas: 'Diseños para cortar', certificado: 'Tu Certificado de Calidad' };
// El aviso del candado ya no existe; la preparación se acompaña, no se bloquea.
function render(route) {
  if (!views[route]) route = 'inicio';
  /* Ya no se desvía a nadie. Antes, tocar "Academia" sin la guía terminada te
     dejaba en otra pantalla sin avisar: tocabas una cosa y aparecías en otra.
     Además la Academia es justo donde están las reglas de seguridad, así que
     cerrarla era al revés de lo que conviene. La guía sigue siendo lo primero
     que se ve al entrar, pero invita en vez de bloquear. */
  document.querySelectorAll('.menu a').forEach(a => a.setAttribute('aria-current', a.dataset.nav === route ? 'page' : 'false'));
  // El título ya lo dice el menú; dentro solo hace falta el nombre de la página.
  const cabecera = route === 'inicio' ? '' : `<h1 class="pag-title">${esc(TITLES[route])}</h1>`;
  view.innerHTML = cabecera + views[route]();
  if (route === 'certificado' || route === 'soporte') { try { localStorage.setItem('c4v_visto_' + route + '_' + state.ctx, '1'); } catch {} }
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
  $('#me').innerHTML = `<strong>${esc(nombrePropio(cliente.nombre))}</strong>${esc(info.doc)} ${esc(cliente.documento)}`;
  // El cliente nuevo aterriza en la guía de preparación: es lo que necesita hoy.
  // Ya no es un candado — puede ir a donde quiera desde el inicio.
  let primeraVez = false;
  try {
    if (!localStorage.getItem('c4v_hola_' + cliente.id)) { localStorage.setItem('c4v_hola_' + cliente.id, '1'); primeraVez = true; }
  } catch {}
  const pe = prepEstado();
  // Mientras la guía no esté completa, siempre se entra por ella: es lo que el
  // cliente necesita hoy y lo que abre el resto del portal.
  if (!pe.completo) {
    location.hash = '#/preparacion';
    setTimeout(() => toast(primeraVez
      ? `👋 ¡Hola${cliente.nombre ? ', ' + primerNombre(cliente.nombre) : ''}! Empieza por dejar tu espacio listo`
      : `📋 Vas ${pe.n} de ${pe.total} en tu preparación`), 500);
    render('preparacion');
    return;
  }
  render(currentRoute());
}

/* ---------- Acceso en dos pasos ----------
   Paso A: documento + país + consentimiento.
   Paso B: el cliente nos escribe por WhatsApp (así demuestra que el número es
   suyo) y el bot le responde un código de 6 dígitos que teclea aquí.
   Si el servidor no exige código (OTP apagado), el paso A entra directo. */
const otpEstado = { solicitud: null, pais: null, sondeo: null, directo: false, faltan: 0 };

/* En modo demostración no hay backend ni WhatsApp, pero el recorrido tiene que
   verse igual que el de verdad: documento, teléfono, código. El código se
   muestra en pantalla y se dice claramente que es una prueba. */
const demoAcceso = { cliente: null, codigo: null };

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
  $('#gatePasoTel').hidden = cual !== 'tel';
  $('#gatePasoOtp').hidden = cual !== 'otp';
  if (cual === 'tel') setTimeout(() => $('#telInput')?.focus(), 80);
  if (cual === 'otp') setTimeout(() => (otpEstado.directo ? $('#otpCodigoDirecto') : $('#otpCodigo'))?.focus(), 80);
}

/* ── Paso: completar el teléfono ────────────────────────────────────────────
   Se muestran los últimos 4 dígitos que hay en Odoo y la persona escribe el
   resto. Sirve a la vez de prueba (solo el dueño sabe su número entero) y de
   aviso (le dice a qué número le va a llegar el código). */
function pintarPasoTel(datos, pais) {
  otpEstado.solicitud = datos.solicitud;
  otpEstado.pais = pais;
  otpEstado.faltan = datos.faltan || 0;
  const prefijo = (CFG.paises || []).find(p => p.code === pais)?.prefijo || '51';
  $('#telPrefijo').textContent = '+' + prefijo;
  $('#telCola').textContent = datos.pista || '';
  $('#telFaltan').textContent = datos.faltan ? `${datos.faltan} dígitos que faltan` : 'dígitos que faltan';
  const inp = $('#telInput');
  inp.value = '';
  inp.placeholder = '•'.repeat(Math.max(3, datos.faltan || 5));
  inp.maxLength = Math.max(3, (datos.faltan || 5) + 3);   // holgura por si guardaron el prefijo
  $('#telError').hidden = true;
  mostrarPaso('tel');
}

/* El código ya salió: aquí solo se teclea. */
function pintarPasoCodigo(pista, codigoDePrueba) {
  otpEstado.directo = true;
  $('#otpSubDirecto').hidden = false;
  $('#otpSubInvertido').hidden = true;
  $('#otpDirecto').hidden = false;
  $('#otpInvertido').hidden = true;
  $('#otpPista4').textContent = pista || '';
  $('#otpCodigoDirecto').value = '';
  $('#otpErrorDirecto').hidden = true;
  const est = $('#otpEstadoDirecto');
  if (codigoDePrueba) {
    est.innerHTML = `<strong>Modo de prueba:</strong> todavía no enviamos WhatsApp, así que tu código es <strong class="codigo-prueba">${esc(codigoDePrueba)}</strong>.`;
    est.classList.add('es-prueba');
  } else {
    est.textContent = 'Te llega en unos segundos. Revisa tu WhatsApp.';
    est.classList.remove('es-prueba');
  }
  mostrarPaso('otp');
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
  const acepta = $('#gateAcepta'), marketing = $('#gateMarketing');
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
    const ej = $('#gateDocEjTxt'); if (ej) ej.textContent = info.ej;
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

  // ---- Paso A: identificar ----
  form.onsubmit = async (e) => {
    e.preventDefault(); limpiarError(inp, err);
    const doc = normalizarDoc(inp.value);
    const info = docInfo(pais, tipo);

    if (!acepta.checked) {
      err.hidden = false;
      err.innerHTML = 'Marca la casilla para aceptar los Términos y la Política de Privacidad.';
      marcarError(acepta, err); return;
    }
    if (doc.length < 5) {
      err.hidden = false;
      err.innerHTML = `Ese ${esc(info.doc)} está incompleto. Escríbelo completo, así: ${esc(info.ej)}.`;
      marcarError(inp, err); return;
    }

    setCargando(true);
    let res;
    try { res = await verificarCliente({ pais, doc }); }
    catch { res = { estado: 'error' }; }

    // El servidor pide segundo factor: solicitamos el código.
    if (res.estado === 'otp') {
      /* Primero el camino directo: le pedimos la pista de su teléfono. Si el
         canal de envío no está configurado, se cae al camino de siempre (que
         el cliente escriba primero por WhatsApp), que sí funciona hoy. */
      const d = await apiPost('/api/acceso/identificar', { pais, doc });
      if (d.status === 429) {
        setCargando(false);
        err.hidden = false;
        err.innerHTML = 'Probaste demasiadas veces seguidas. Espera cinco minutos y vuelve a intentar.';
        marcarError(inp, err); return;
      }
      if (d.json.ok && d.json.canal === 'whatsapp') {
        setCargando(false);
        apiPost('/api/consentimiento', { doc, pais, acepta_datos: true, acepta_marketing: marketing.checked }).catch(() => {});
        pintarPasoTel(d.json, pais);
        return;
      }
      if (d.json.ok === false && d.json.motivo === 'sin_telefono') {
        setCargando(false);
        err.hidden = false;
        err.innerHTML = `No tenemos tu WhatsApp registrado, así que no podemos enviarte el código. <a href="${waLink('Hola, quiero entrar a mi Central de Postventa C4V pero no tienen mi WhatsApp registrado. ¿Me ayudan?')}" target="_blank" rel="noopener">Escríbenos y lo actualizamos</a> en un minuto.`;
        marcarError(inp, err); return;
      }

      const r = await apiPost('/api/otp/solicitar', { pais, doc });
      setCargando(false);
      if (r.status === 429) { err.hidden = false; err.innerHTML = 'Pediste muchos códigos seguidos. Espera 5 minutos y vuelve a intentar.'; return; }
      if (r.json.ok) {
        // Deja constancia del consentimiento junto al acceso.
        // Constancia del consentimiento: qué aceptó, cuándo y desde dónde.
        apiPost('/api/consentimiento', { doc, pais, acepta_datos: true, acepta_marketing: marketing.checked }).catch(() => {});
        pintarPasoOtp(r.json, pais);
        return;
      }
      err.hidden = false;
      err.innerHTML = r.json.motivo === 'sin_telefono'
        ? `No tenemos tu WhatsApp registrado, así que no podemos enviarte el código. <a href="${waLink('Hola, quiero entrar a mi Central de Postventa C4V pero no tienen mi WhatsApp registrado. ¿Me ayudan?')}" target="_blank" rel="noopener">Escríbenos y lo actualizamos</a> en un minuto.`
        : `Ese ${esc(info.doc)} no nos aparece. Revisa que sea el mismo con el que compraste tu máquina. Si está bien, <a href="${waLink('Hola, mi documento no aparece en la Central de Postventa C4V. ¿Me ayudan?')}" target="_blank" rel="noopener">escríbenos por WhatsApp</a>.`;
      marcarError(inp, err); return;
    }

    setCargando(false);
    if (res.estado === 'ok') {
      /* En demostración también se recorre el segundo factor, para poder verlo
         y probarlo. Con verificación real esto lo decide el servidor. */
      if (modoDemo() && res.cliente?.telefono) {
        apiPost('/api/consentimiento', { doc, pais, acepta_datos: true, acepta_marketing: marketing.checked }).catch(() => {});
        demoAcceso.cliente = res.cliente;
        demoAcceso.codigo = null;
        const nac = numeroNacional(res.cliente.telefono, pais);
        pintarPasoTel({
          solicitud: 'DEMO',
          pista: nac.slice(-PISTA_DIGITOS),
          largo: nac.length,
          faltan: Math.max(0, nac.length - PISTA_DIGITOS)
        }, pais);
        return;
      }
      entrar(res.cliente); return;
    }

    err.hidden = false;
    if (res.estado === 'limite') {
      err.innerHTML = `Demasiados intentos. Espera 5 minutos y vuelve a probar, o <a href="${waLink('Hola, no puedo entrar a mi Central de Postventa C4V. ¿Me ayudan?')}" target="_blank" rel="noopener">escríbenos por WhatsApp</a>.`;
    } else if (res.estado === 'error') {
      err.innerHTML = `No pudimos conectarnos. Revisa tu internet y vuelve a intentar. Si sigue igual, o <a href="${waLink('Hola, no puedo entrar a mi Central de Postventa C4V (error al verificar). ¿Me ayudan?')}" target="_blank" rel="noopener">escríbenos por WhatsApp</a>.`;
    } else {
      err.innerHTML = `Ese ${esc(info.doc)} no nos aparece. Revisa que sea el mismo con el que compraste tu máquina. Si está bien, <a href="${waLink('Hola, mi documento no aparece en la Central de Postventa C4V. ¿Me ayudan?')}" target="_blank" rel="noopener">escríbenos por WhatsApp</a> y te ayudamos.`;
    }
    marcarError(inp, err);
  };

  // ---- Paso B: validar el código ----
  const otpForm = $('#otpForm'), otpErr = $('#otpError'), otpInp = $('#otpCodigo');
  otpInp.oninput = () => { otpInp.value = otpInp.value.replace(/\D/g, '').slice(0, 6); };
  otpForm.onsubmit = async (e) => {
    e.preventDefault(); limpiarError(otpInp, otpErr);
    const codigo = otpInp.value.replace(/\D/g, '');
    if (codigo.length !== 6) { otpErr.hidden = false; otpErr.textContent = 'Escribe los 6 números que te llegaron por WhatsApp.'; marcarError(otpInp, otpErr); return; }
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
    const motivos = {
      incorrecto: `Ese código no es el correcto.${r.json.intentos_restantes ? ` Te queda${r.json.intentos_restantes === 1 ? '' : 'n'} ${r.json.intentos_restantes} intento${r.json.intentos_restantes === 1 ? '' : 's'}.` : ''} Revisa el último mensaje de WhatsApp.`,
      vencido: 'Tu código venció. Toca «Volver y cambiar mi documento» y pide uno nuevo.',
      usado: 'Ese código ya se usó. Pide uno nuevo.',
      bloqueado: 'Demasiados intentos. Toca «Volver y cambiar mi documento» y pide otro código.',
      no_enviado: 'Todavía no nos llegó tu mensaje de WhatsApp. Envíalo y espera unos segundos.',
      invalido: 'Revisa el código e inténtalo de nuevo.'
    };
    otpErr.textContent = motivos[r.json.motivo] || (r.status === 429
      ? 'Demasiados intentos. Espera unos minutos.'
      : 'No pudimos revisar tu código. Vuelve a intentarlo en unos segundos.');
    marcarError(otpInp, otpErr);
  };

  $('#otpVolver').onclick = () => { detenerSondeo(); otpEstado.solicitud = null; mostrarPaso('doc'); inp.focus(); };

  // ---- Paso: completar el teléfono y pedir el código ----
  const telForm = $('#telForm'), telInp = $('#telInput'), telErr = $('#telError'), telBtn = $('#telBtn');
  telInp.oninput = () => { telInp.value = telInp.value.replace(/\D/g, ''); };
  $('#telVolver').onclick = () => { otpEstado.solicitud = null; mostrarPaso('doc'); inp.focus(); };

  const pedirCodigo = async () => {
    limpiarError(telInp, telErr);
    const faltan = otpEstado.faltan || 0;
    const escrito = telInp.value.replace(/\D/g, '');
    if (escrito.length < Math.max(3, faltan - 2)) {
      telErr.hidden = false;
      telErr.textContent = faltan
        ? `Faltan dígitos. Escribe los ${faltan} que van antes de ${$('#telCola').textContent}.`
        : 'Escribe tu número completo, sin los últimos cuatro.';
      marcarError(telInp, telErr); return;
    }
    telBtn.disabled = true; telBtn.textContent = 'Enviando…';
    const completo = escrito + ($('#telCola').textContent || '');

    if (otpEstado.solicitud === 'DEMO') {
      // Demostración: se compara aquí mismo, sin servidor ni WhatsApp.
      const suyo = numeroNacional(demoAcceso.cliente?.telefono, otpEstado.pais);
      telBtn.disabled = false; telBtn.textContent = 'Enviarme el código';
      if (digitosDe(completo).slice(-8) !== suyo.slice(-8)) {
        telErr.hidden = false;
        telErr.textContent = 'Ese número no coincide con el que tenemos.';
        marcarError(telInp, telErr); return;
      }
      demoAcceso.codigo = String(Math.floor(100000 + Math.random() * 900000));
      pintarPasoCodigo(suyo.slice(-PISTA_DIGITOS), demoAcceso.codigo);
      return;
    }

    const r = await apiPost('/api/acceso/enviar', { solicitud: otpEstado.solicitud, telefono: completo });
    telBtn.disabled = false; telBtn.textContent = 'Enviarme el código';

    if (r.json.ok) { pintarPasoCodigo(r.json.pista || $('#telCola').textContent); return; }

    telErr.hidden = false;
    const motivos = {
      telefono_no_coincide: `Ese número no coincide con el que tenemos. ${r.json.restantes ? `Te queda${r.json.restantes === 1 ? '' : 'n'} ${r.json.restantes} intento${r.json.restantes === 1 ? '' : 's'}.` : 'Se acabaron los intentos: vuelve a empezar.'}`,
      demasiados_intentos: 'Se acabaron los intentos. Toca «Volver y cambiar mi documento» y empieza otra vez.',
      solicitud_vencida: 'Pasó demasiado tiempo. Toca «Volver y cambiar mi documento» y empieza otra vez.',
      no_configurado: 'Todavía no podemos enviarte el código por WhatsApp. Escríbenos y te ayudamos a entrar.',
      fallo_envio: 'No pudimos enviarte el código en este momento. Prueba otra vez en un minuto.'
    };
    telErr.innerHTML = motivos[r.json.motivo]
      || (r.status === 429 ? 'Probaste demasiadas veces. Espera unos minutos.' : 'No pudimos enviarte el código. Inténtalo de nuevo.');
    marcarError(telInp, telErr);
  };
  telForm.onsubmit = (e) => { e.preventDefault(); pedirCodigo(); };

  // ---- Paso: el código, cuando lo enviamos nosotros ----
  const dirForm = $('#otpFormDirecto'), dirInp = $('#otpCodigoDirecto'), dirErr = $('#otpErrorDirecto');
  dirInp.oninput = () => { dirInp.value = dirInp.value.replace(/\D/g, '').slice(0, 6); };
  dirForm.onsubmit = async (e) => {
    e.preventDefault(); limpiarError(dirInp, dirErr);
    const codigo = dirInp.value.replace(/\D/g, '');
    if (codigo.length !== 6) { dirErr.hidden = false; dirErr.textContent = 'Escribe los 6 números que te llegaron por WhatsApp.'; marcarError(dirInp, dirErr); return; }
    const boton = dirForm.querySelector('button');
    boton.disabled = true; boton.textContent = 'Entrando…';
    if (otpEstado.solicitud === 'DEMO') {
      boton.disabled = false; boton.textContent = 'Entrar';
      if (codigo === demoAcceso.codigo) { entrar(demoAcceso.cliente); return; }
      dirErr.hidden = false; dirErr.textContent = 'Ese código no es el correcto.';
      marcarError(dirInp, dirErr); return;
    }
    const r = await apiPost('/api/otp/verificar', { solicitud: otpEstado.solicitud, codigo });
    boton.disabled = false; boton.textContent = 'Entrar';
    if (r.json.ok && r.json.token) {
      guardarSesion({ token: r.json.token, pais: otpEstado.pais });
      entrar(inyectarCliente(r.json.cliente, r.json.maquinas));
      return;
    }
    dirErr.hidden = false;
    dirErr.textContent = {
      incorrecto: `Ese código no es el correcto.${r.json.intentos_restantes ? ` Te queda${r.json.intentos_restantes === 1 ? '' : 'n'} ${r.json.intentos_restantes}.` : ''}`,
      vencido: 'Tu código venció. Pide uno nuevo.',
      usado: 'Ese código ya se usó. Pide uno nuevo.',
      bloqueado: 'Demasiados intentos. Vuelve a empezar.'
    }[r.json.motivo] || 'No pudimos revisar tu código. Inténtalo otra vez.';
    marcarError(dirInp, dirErr);
  };
  $('#otpReenviar').onclick = () => { mostrarPaso('tel'); };

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
  modo: 'voz', estado: 'reposo', manosLibres: true, audioListo: false, cerrando: false,
  turnoVoz: 0, reproductor: null, textoPendiente: null
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

function ceviDesbloquearAudio() {
  if (cevi.audioListo) return;
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
    <span class="orbe-disco"><span class="toro" aria-hidden="true"></span></span>
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
const TORO = '<span class="toro" aria-hidden="true"></span>';

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

function ceviPedirTts(texto, señal) {
  const clave = String(texto).trim();
  if (ttsCache.has(clave)) return ttsCache.get(clave);
  const promesa = (async () => {
    const r = await fetch(`${CFG.ceviApi}/tts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: clave }), signal: señal
    });
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
    const fin = (ok) => {
      if (acabado) return;
      acabado = true;
      audio.onended = audio.onerror = audio.ontimeupdate = null;
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
    setTimeout(() => fin(sonó), 120000);
    audio.play().then(() => { cevi.audioListo = true; })
      .catch((e) => { cevi.ultimoFalloVoz = e && e.name ? e.name : 'play'; fin(false); });
  });
}

/* Voz: reproduce la respuesta con la voz del backend, en cadena. Mientras suena
   un trozo ya se está sintetizando el siguiente, así que CeVi empieza a hablar
   en cuanto está lista la primera frase, no la respuesta entera. */
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
    // Manos libres: en cuanto CeVi termina de hablar, vuelve a escuchar sola.
    if (cevi.abierto && cevi.modo === 'voz' && cevi.manosLibres && !cevi.cerrando) ceviEscuchar();
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
    await ceviHablar(respuesta);
    await cerrarTurno();
  } catch {
    ceviCerrarCola();
    ceviCancelarRelleno();
    const caida = 'No pude conectarme en este momento. Escríbenos por WhatsApp y te responde una persona del equipo.';
    cevi.historial.push({ role: 'assistant', content: caida, wa: waLink(`Hola equipo C4V. ${msg}`) });
    ceviPintar();
    if (input) input.disabled = false;
    await ceviHablar(caida);
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
  /* 850 ms es lo que usa la industria. Pero si la frase quedó colgando de un
     conector ("y", "porque", "o sea"), la persona sigue pensando y se le da más
     aire; si terminó en pregunta, se corta antes. */
  const COLGANDO = /\b(y|o|pero|porque|que|si|cuando|para|con|de|en|un|una|o sea|entonces|este|eh|em|mmm|a ver|es que|lo que)\s*$/i;
  const esperaSegun = (t) => COLGANDO.test(t) ? 1600 : (/[?¿]\s*$/.test(t) ? 600 : 850);
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
        ceviAviso('Toca el micrófono para seguir hablando: tu navegador pide un toque en cada turno.');
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
    /* Un "eh" o un ruido no es una pregunta: mandarlo hace que CeVi conteste
       cualquier cosa y la conversación se vuelve absurda. */
    if (dicho && dicho.replace(/[^a-záéíóúñ]/gi, '').length < 4) {
      ceviTranscripcion('No te entendí. ¿Me lo repites?');
      if (cevi.manosLibres) { setTimeout(() => ceviEscuchar(), 400); return; }
      ceviEstado('reposo'); return;
    }
    if (dicho) { cevi.silencios = 0; ceviEnviar(dicho); return; }
    if (cevi.estado === 'escuchando') {
      ceviEstado('reposo');
      if (cevi.manosLibres && !ceviSinRespuesta()) ceviPintarPistas();
    }
  };

  try {
    rec.start(); ceviEstado('escuchando'); ceviTranscripcion('');
    ceviPitido('escucho');               // "te toca", para quien no mira la pantalla
    orbeEscucharMicro();                 // el orbe se mueve con tu voz
  }
  catch {
    cevi.escuchando = null;
    if (!desdeToque) ceviAviso('Toca el micrófono para seguir hablando: tu navegador pide un toque en cada turno.');
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
  const panel = $('#aiPanel');
  if (panel) panel.dataset.estado = nuevo;
  const pagina = $('#ceviPagina');
  if (pagina) pagina.dataset.ceviEstado = nuevo;
  if (!panel && !pagina) return;
  const b = $('#ceviVozBtn');
  if (b) {
    const etiquetas = {
      reposo: ['Toca para hablar', 'Hablar con CeVi'],
      escuchando: ['Te escucho…', 'Dejar de escuchar'],
      pensando: ['Pensando…', 'CeVi está pensando'],
      hablando: ['CeVi está hablando', 'Interrumpir a CeVi']
    };
    const [texto, aria] = etiquetas[nuevo] || etiquetas.reposo;
    const t = $('#ceviVozTxt'); if (t) t.textContent = texto;
    b.setAttribute('aria-label', aria);
  }
}

// Lo que se va oyendo, en pantalla, mientras la persona habla.
function ceviTranscripcion(txt) {
  const el = $('#ceviDictado');
  if (el) el.textContent = txt;
}

// El botón grande hace lo que toca según el estado. Un solo control, sin modos ocultos.
function ceviVozToque() {
  ceviDesbloquearAudio();
  if (cevi.estado === 'escuchando') { cevi.manosLibres = false; ceviCallar(); return; }
  if (cevi.estado === 'hablando') { ceviParaVoz(); ceviEstado('reposo'); return; }
  if (cevi.estado === 'pensando') return;
  cevi.manosLibres = true;
  ceviAviso('');
  ceviEscuchar(true);
}

// Pasa al chat escrito y dice por qué, en vez de dejar un micrófono que no responde.
function ceviModoTexto(motivo) {
  cevi.modo = 'texto';
  cevi.manosLibres = false;
  const panel = $('#aiPanel');
  if (panel) panel.dataset.modo = 'texto';
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
      ceviAviso('');
      const t = cevi.textoPendiente;
      if (t) { cevi.textoPendiente = null; ceviHablar(t); }
    };
    el.appendChild(b);
  }
  el.hidden = !texto;
}

function ceviPanelHTML() {
  const ag = CFG.agente || {};
  const cli = currentClient();
  const nombre = primerNombre(cli?.nombre);
  return `
    <div class="cevi-head">
      <div class="cevi-avatar grande" aria-hidden="true">${TORO}</div>
      <div class="cevi-head-txt">
        <strong>${esc(ag.nombre || 'CeVi')}</strong>
        <span>Háblale, te contesta en voz alta</span>
      </div>
      <button type="button" class="cevi-voz" id="ceviVoz" aria-pressed="${ceviVozActiva()}" aria-label="Leer respuestas en voz alta">${ceviVozActiva() ? CEVI_ICONOS.audioOn : CEVI_ICONOS.audioOff}</button>
      <button type="button" class="cevi-close" id="ceviClose" aria-label="Cerrar">×</button>
    </div>

    <div class="cevi-msgs" id="ceviMsgs" role="log" aria-live="polite" aria-label="Conversación con CeVi"></div>

    <p class="cevi-aviso" id="ceviAviso" role="status" hidden></p>

    <!-- El micrófono es el control principal: ocupa el sitio que antes tenía el
         cuadro de escribir, porque hablar es lo que la mayoría va a hacer. -->
    <div class="cevi-voz-zona">
      <p class="cevi-dictado" id="ceviDictado" aria-live="polite"></p>
      <button type="button" class="cevi-voz-btn" id="ceviVozBtn" aria-label="Hablar con CeVi">
        ${orbeHTML('grande')}
      </button>
      <span class="cevi-voz-txt" id="ceviVozTxt">Toca para hablar</span>
      <button type="button" class="cevi-cambiar" id="ceviEscribir">Prefiero escribir</button>
    </div>

    <div class="cevi-sug" id="ceviSug">
      ${['¿Con qué potencia corto MDF de 3 mm?', '¿Cada cuánto cambio el agua del chiller?', 'Mi láser dejó de cortar bien']
        .map(q => `<button type="button" class="chip" data-q="${esc(q)}">${esc(q)}</button>`).join('')}
    </div>

    <form class="cevi-form" id="ceviForm">
      <input id="ceviInput" type="text" autocomplete="off" placeholder="${nombre ? `Escríbeme, ${esc(nombre)}` : 'Escribe tu pregunta'}" aria-label="Tu pregunta para CeVi">
      <button type="submit" class="cevi-send" aria-label="Enviar">${CEVI_ICONOS.enviar}</button>
      <button type="button" class="cevi-cambiar" id="ceviHablarBtn">Prefiero hablar</button>
    </form>

    <p class="cevi-pie">CeVi responde solo, con inteligencia artificial. Si el tema es serio, te pasamos con una persona del equipo.</p>`;
}

/* Los controles son los mismos en el panel flotante y en la página, así que se
   cablean en un solo sitio con los mismos ids. */
function ceviCablear(raiz) {
  const marca = (m) => {
    cevi.modo = m;
    const p = $('#aiPanel'); if (p) p.dataset.modo = m;
    const g = $('#ceviPagina'); if (g) g.dataset.ceviModo = m;
  };
  const f = $('#ceviForm');
  if (f) f.onsubmit = (e) => { e.preventDefault(); ceviEnviar($('#ceviInput').value); };
  const vb = $('#ceviVozBtn'); if (vb) vb.onclick = ceviVozToque;
  const esc2 = $('#ceviEscribir'); if (esc2) esc2.onclick = () => ceviModoTexto('');
  const hab = $('#ceviHablarBtn');
  if (hab) hab.onclick = () => {
    if (!HAY_DICTADO) { ceviAviso('Tu navegador no puede escuchar. Escríbeme tu pregunta.'); return; }
    marca('voz');
    ceviAviso(''); ceviTranscripcion(''); ceviVozToque();
  };
  const lim = $('#ceviLimpiar');
  if (lim) lim.onclick = () => {
    ceviParaVoz(); ceviCallar();
    cevi.historial = []; cevi.partnerId = null;
    ceviPintar(); ceviAviso(''); ceviTranscripcion(''); ceviEstado('reposo');
    const sug = $('#ceviSug'); if (sug) sug.hidden = false;
  };
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
  cevi.manosLibres = cevi.modo === 'voz';
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
  // Se pide la voz del saludo ya, mientras la pantalla termina de pintarse.
  if (primera) ceviPedirTts(ceviTrozos(cevi.historial[0].content)[0]).catch(() => {});
  if (!HAY_DICTADO) { ceviAviso('Tu navegador no puede escuchar. Escríbeme tu pregunta aquí abajo.'); return; }
  /* El primer toque de la persona fue el enlace que trajo aquí, así que el
     altavoz ya está desbloqueado y puede saludar sola. */
  (async () => {
    if (primera) await ceviHablar(cevi.historial[0].content);
    if (currentRoute() === 'cevi' && cevi.manosLibres) ceviEscuchar();
  })();
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

/* Si nadie contesta, CeVi no se queda muda: vuelve a ofrecer, una sola vez, y
   después se calla para no hostigar. Es lo que recomienda cualquier guía de
   interfaces de voz para el "no-input". */
const REPREGUNTAS = [
  'Sigo aquí. Puedes preguntarme por potencias, por limpieza, o contarme qué falla tienes.',
  '¿Te ayudo con algo más? Si prefieres, toca el toro y háblame cuando quieras.'
];

function ceviSinRespuesta() {
  if (cevi.modo !== 'voz') return false;
  cevi.silencios = (cevi.silencios || 0) + 1;
  if (cevi.silencios > 2) { cevi.manosLibres = false; ceviPintarPistas(); return false; }
  const texto = REPREGUNTAS[Math.min(cevi.silencios, REPREGUNTAS.length) - 1];
  (async () => {
    await ceviHablar(texto);
    if (cevi.abierto && cevi.manosLibres && !cevi.cerrando) ceviEscuchar();
  })();
  return true;
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

function ceviAbrir() {
  const panel = $('#aiPanel'), btn = $('#aiBtn');
  if (!panel) return;
  ceviDesbloquearAudio();                        // el toque que abre también libera el altavoz
  cevi.origen = document.activeElement;          // para devolver el foco al cerrar
  cevi.cerrando = false;
  cevi.modo = HAY_DICTADO ? 'voz' : 'texto';
  cevi.manosLibres = cevi.modo === 'voz';
  panel.innerHTML = ceviPanelHTML();
  panel.dataset.modo = cevi.modo;
  panel.hidden = false; cevi.abierto = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'Hablar con CeVi, tu asistente');
  btn?.setAttribute('aria-expanded', 'true');
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
  if (primera) ceviPedirTts(ceviTrozos(cevi.historial[0].content)[0]).catch(() => {});

  ceviCablear(panel);
  $('#ceviClose').onclick = ceviCerrar;

  if (cevi.modo === 'voz') {
    // Saluda en voz alta y se queda escuchando: no hay que tocar nada más.
    (async () => {
      if (primera) await ceviHablar(cevi.historial[0].content);
      if (cevi.abierto && !cevi.cerrando && cevi.manosLibres) ceviEscuchar();
    })();
  } else {
    if (!HAY_DICTADO) ceviAviso('Tu navegador no puede escuchar. Escríbeme tu pregunta aquí abajo.');
    setTimeout(() => $('#ceviInput')?.focus(), 60);
  }
}

function ceviCerrar() {
  cevi.cerrando = true;
  const panel = $('#aiPanel');
  if (panel) { panel.hidden = true; panel.innerHTML = ''; delete panel.dataset.estado; }
  cevi.abierto = false;
  cevi.manosLibres = false;
  cevi.estado = 'reposo';
  const btn = $('#aiBtn');
  btn?.setAttribute('aria-expanded', 'false');
  // Sin esto el foco caía al principio del documento al cerrar con Escape.
  (cevi.origen && document.contains(cevi.origen) ? cevi.origen : btn)?.focus();
  ceviParaVoz();
  if (cevi.escuchando) { try { cevi.escuchando.abort(); } catch {} cevi.escuchando = null; }
  if (!document.querySelector('[data-orbe]')) orbeParar();
}

function initAgente() {
  const btn = $('#aiBtn');
  const nombreEl = $('#aiName');
  if (nombreEl) nombreEl.textContent = (CFG.agente || {}).nombre || 'CeVi';
  if (!btn) return;
  if (!CFG.ceviApi) { btn.hidden = true; return; }   // sin backend, no fingimos que existe
  btn.onclick = () => (cevi.abierto ? ceviCerrar() : ceviAbrir());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && cevi.abierto) ceviCerrar(); });
}
window.ceviAbrir = ceviAbrir;






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
  pie.innerHTML = `
    <p class="pie-empresa">
      <strong>${esc(e.razon_social || '')}</strong>${e.ruc ? `, RUC ${esc(e.ruc)}` : ''}${e.domicilio ? `<br>${esc(e.domicilio)}` : ''}
      <br>Atención al cliente: WhatsApp ${esc(e.whatsapp_visible || CFG.whatsapp?.visible || '')}${e.telefono ? `<br>Teléfono ${esc(e.telefono)}` : ''}${e.email ? `<br>${esc(e.email)}` : ''}
    </p>
    <nav aria-label="Información legal">
      <a href="libro-reclamaciones.html" class="pie-lr" target="_blank" rel="noopener">📕 Libro de Reclamaciones</a>
      <a href="privacidad.html" target="_blank" rel="noopener">Política de Privacidad</a>
      <a href="terminos.html" target="_blank" rel="noopener">Términos de Uso</a>
      <a href="privacidad.html#derechos" target="_blank" rel="noopener">Ver, corregir o borrar mis datos</a>
    </nav>`;
}

// ---------- init ----------
async function init() {
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
