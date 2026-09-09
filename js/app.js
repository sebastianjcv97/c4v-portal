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
function currentClient() { return state.db.clientes.find(c => c.id === state.ctx) || null; }

/* Preparación del espacio: la puerta de entrada. El resto del portal se
   desbloquea cuando el checklist de "Preparar mi espacio" está completo. */
function prepEstado() {
  const lista = state.db.preparacion?.checklist || [];
  let n = 0;
  try { n = lista.filter(c => localStorage.getItem('c4v_prep_' + state.ctx + '_' + c.id) === '1').length; } catch {}
  return { n, total: lista.length, completo: lista.length > 0 && n === lista.length };
}
/* La preparación es lo primero que ve un cliente nuevo (ver `entrar`), y su avance
   manda en la pantalla de inicio. Pero YA NO BLOQUEA el resto del portal:
   - El curso «Bienvenida» y las preguntas frecuentes explican justamente cómo
     prepararse, y estaban detrás del candado que exigía estar preparado.
   - Preparar el espacio depende de un electricista y toma una o dos semanas.
     Apagar el portal durante ese tiempo dejaba solo al cliente justo cuando más
     dudas tiene.
   - Marcar 12 casillas no prueba nada: quien tiene prisa las marca en 8 segundos.
   Se acompaña, no se castiga. */

// ---------- data layer ----------
async function loadDB() {
  // Hosting estático (GitHub Pages / archivo local): el contenido fijo (cursos,
  // guías, FAQ) sale de data.js. Lo que cambia por cliente se pide al backend.
  if (location.hostname.endsWith('github.io') || location.protocol === 'file:') { state.offline = true; return JSON.parse(JSON.stringify(window.__SEED__)); }
  try { const db = await apiGet('/api/bootstrap'); state.offline = false; return db; }
  catch { state.offline = true; return JSON.parse(JSON.stringify(window.__SEED__)); }
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
function rutaInicio(d, cli, prep, certificada) {
  let pasos = d.onboarding || [];
  if (!pasos.length || !cli) return '';
  // Mientras la preparación está pendiente, la tarjeta negra de arriba ya lo dice
  // todo: repetirlo aquí era el mismo "Paso 1" dos veces con dos diseños.
  if (!prep.completo) pasos = pasos.filter(x => x.id !== 'espacio');
  if (!pasos.length) return '';
  const ls = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const quizC0 = () => { try { return Object.keys(localStorage).some(k => k.startsWith('c4v_quiz_' + state.ctx + '_c0-') && (JSON.parse(localStorage.getItem(k) || '{}').p || 0) >= 70); } catch { return false; } };
  const hecho = { espacio: prep.completo, cert: !!ls('c4v_visto_certificado_' + state.ctx), curso: quizC0(), soporte: !!ls('c4v_visto_soporte_' + state.ctx) };
  const n = pasos.filter(p => hecho[p.id]).length;
  if (n === pasos.length) return '';
  const bloqueado = (p) => p.id !== 'espacio' && p.id !== 'cert' && p.id !== 'soporte' && !prep.completo;
  return `
      <section class="ruta-inicio" aria-label="Tus primeros pasos">
        <div class="ruta-head"><strong>Tus primeros pasos</strong><span>${n} de ${pasos.length}</span></div>
        ${!certificada && d.bienvenida?.mensaje ? `<p class="ruta-msg">${esc(d.bienvenida.mensaje)}</p>` : ''}
        <ol class="ruta-pasos">${pasos.map(p => `<li class="${hecho[p.id] ? 'done' : bloqueado(p) ? 'lock' : ''}">
          <a href="${bloqueado(p) ? '#/preparacion' : esc(p.href)}">
            <span class="ruta-num" aria-hidden="true">${hecho[p.id] ? '✓' : bloqueado(p) ? '🔒' : ''}</span>
            <span class="ruta-txt"><strong>${esc(p.titulo)}</strong><small>${esc(p.detalle)}</small></span>
          </a></li>`).join('')}</ol>
      </section>`;
}

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

    const bigBtn = (href, ic, t, desc, ext) => `<a class="big" href="${href}"${ext ? ' target="_blank" rel="noopener"' : ''}>
        <div class="big-ico">${icon(ic)}</div>
        <div class="big-txt"><strong>${t}</strong><span>${desc}</span></div>
        <div class="big-arrow" aria-hidden="true">→</div></a>`;

    const prep = prepEstado();

    return `
      <h1 class="saludo">${cli ? `Hola, ${esc(primerNombre(cli.nombre))}` : 'Hola'}</h1>

      ${maq ? `<a class="maq" href="#/certificado">
        <div class="maq-seal">${SEAL}</div>
        <div class="maq-txt">
          <strong>Tu láser ${esc(maq.modelo)}</strong>
          <span>${certificada
            ? 'Certificada ✓ · Ver tu Certificado de Calidad'
            : enRevision
              ? 'La estamos probando y calibrando · Ver qué significa'
              : 'Ver tu Certificado de Calidad'}</span>
          ${lista.length > 1 ? `<span class="muted">y ${lista.length - 1} máquina${lista.length > 2 ? 's' : ''} más</span>` : ''}
        </div>
        <div class="big-arrow" aria-hidden="true">→</div></a>` : ''}

      ${prep.completo ? '' : `
      <a class="prep-cta" href="#/preparacion">
        <div class="prep-cta-top"><strong>Deja tu espacio listo</strong><span>${prep.n} de ${prep.total}</span></div>
        <div class="bar"><i style="width:${prep.total ? Math.round(prep.n / prep.total * 100) : 0}%"></i></div>
        <p>Antes de usar tu máquina, completa la guía: eléctrico, pozo a tierra, extracción y agua destilada. Así tu instalación sale bien a la primera.</p>
        <span class="prep-cta-btn">Continuar mi preparación →</span>
      </a>`}

      ${rutaInicio(d, cli, prep, certificada)}

      <div class="bigs">
        ${prep.completo ? bigBtn('#/preparacion', 'prep', 'Preparar mi espacio', 'Ya terminaste tu lista ✓') : ''}
        ${bigBtn('#/academia', 'academia', 'Aprender a usar mi máquina', 'Videos, prácticas y las dudas más comunes')}
        ${bigBtn('#/soporte', 'soporte', 'Necesito ayuda', 'Escríbenos por WhatsApp')}
        <button type="button" class="big" data-cevi="1">
          <div class="big-ico">${icon('cevi')}</div>
          <div class="big-txt"><strong>Pregúntale a CeVi</strong><span>Te responde al toque: potencias, limpieza y fallas</span></div>
          <div class="big-arrow" aria-hidden="true">→</div>
        </button>
        ${bigBtn('#/bolsa', 'bolsa', 'Quiero más clientes', 'Trabajos de corte que te pasamos gratis')}
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
             <span class="lv-dur">${visto(l.v) ? '✓ visto · ' : ''}${fmtDur(l.dur)}</span>
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
          <button type="button" class="qz-start">📝 Ponte a prueba <span>(${preguntas.length} preguntas)</span></button>${logro}
          <div class="qz-area" hidden></div>
        </div>`;
    };
    const cursoCard = (c, i) => {
      const estado = c.estado === 'disponible' ? '<span class="badge ok">Disponible</span>' : c.estado === 'en_proceso' ? '<span class="badge warn">En construcción</span>' : '<span class="badge grey">Próximamente</span>';
      const nLes = c.modulos.reduce((s, m) => s + m.lecciones.length, 0);
      const esVideo = c.modulos.some(m => m.lecciones.some(l => typeof l !== 'string'));
      return `<div class="course" id="curso-${esc(c.id)}"><button type="button" class="course-head" aria-expanded="false">
          <div class="course-ico">${i + 1}</div>
          <div style="flex:1"><h3>${esc(c.titulo)} ${estado} ${esVideo ? '<span class="badge red">🎬 en video</span>' : ''}</h3>
            <div class="sub">${esc(c.nivel)} · ${c.modulos.length} módulos · ${nLes} lecciones — ${esc(c.descripcion)}</div></div>
          <span class="chev" aria-hidden="true">＋</span></button>
        <div class="course-body">
          ${c.modulos.map((m, mi) => `<div class="module">
            <h4><span class="num-mod">${mi + 1}</span> ${esc(m.titulo)} ${m.quizzes ? `<span class="badge red" style="margin-left:auto">${m.quizzes} preguntas</span>` : ''}</h4>
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
        <h2 class="section-h" style="margin-top:0">⚠️ ${esc(a.seguridad.titulo)}</h2>
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

      <h2 class="section-title">Cursos por módulos</h2>
      ${a.cursos.map(cursoCard).join('')}

      ${a.parametros ? `
      <h2 class="section-title">Parámetros por material (potencia / velocidad)</h2>
      <div class="card">
        <p style="margin:0 0 12px">${esc(a.parametros.intro)}</p>
        <div class="tabla-scroll">
          <table class="tabla-params"><thead><tr>
            <th>Material</th><th>Grosor</th><th>✂️ Corte<br><span>Pot / Vel</span></th><th>✏️ Marcado<br><span>Pot / Vel</span></th><th>🖼️ Grabado<br><span>Pot / Vel</span></th><th>Seal</th>
          </tr></thead>
          <tbody>${a.parametros.filas.map(f => `<tr><td><strong>${esc(f.m)}</strong></td><td>${esc(f.g)}</td><td>${esc(f.corte)}</td><td>${esc(f.marcado)}</td><td>${esc(f.grabado)}</td><td>${esc(f.seal)}</td></tr>`).join('')}</tbody></table>
        </div>
        <p class="muted" style="margin:12px 0 0;font-size:13px">${esc(a.parametros.nota)}</p>
        <h3 style="margin:16px 0 8px;font-size:15px">Cómo aplicarlos en RDWorks</h3>
        <ol class="acceso-pasos">${a.parametros.rdworks.map(x => `<li>${esc(x)}</li>`).join('')}</ol>
      </div>` : ''}

      ${a.guiasPdf ? `
      <h2 class="section-title">Guías técnicas para descargar (PDF)</h2>
      <div class="grid cols-3">
        ${a.guiasPdf.map(g => `<a class="card pdf-card" href="guias/${esc(g.archivo)}" target="_blank" rel="noopener" download>
          <div class="pdf-ico">PDF</div>
          <h3>${esc(g.titulo)}</h3>
          <p>${esc(g.desc)}</p>
          <span class="pdf-dl">⬇ Descargar · ${esc(g.tam)}</span>
        </a>`).join('')}
      </div>` : ''}

      <h2 class="section-title">Próximamente</h2>
      <div class="grid cols-3">${a.proximamente.map(p => `<div class="card"><p>🔜 ${esc(p)}</p></div>`).join('')}</div>

      <h2 class="section-title">Conoce la línea C4V</h2>
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

      <h2 class="section-title">Prepara tu espacio</h2>
      <div class="help-card"><div class="grow"><h3>Antes de instalar, deja tu espacio listo</h3>
        <p>Checklist imprimible y guías paso a paso: eléctrico, pozo a tierra, extracción y agua destilada.</p></div>
        <a class="btn primary sm" href="#/preparacion">Abrir la guía</a></div>

      <h2 class="section-title">Preguntas frecuentes</h2>
      ${faqCats.map(cat => `<h4 style="font-size:14px;margin:16px 0 8px">${esc(cat)}</h4>
        ${faqs.filter(f => f.categoria === cat).map(f => `<div class="faq-item"><button type="button" class="faq-q" aria-expanded="false"><span>${esc(f.pregunta)}</span><span class="chev" aria-hidden="true">＋</span></button><div class="faq-a">${esc(f.respuesta)}</div></div>`).join('')}`).join('')}`;
  },

  preparacion() {
    const p = state.db.preparacion;
    const cli = currentClient();
    const maq = cli ? state.db.maquinas.find(x => x.cliente_id === cli.id && x.modelo) : null;
    const done = (id) => { try { return localStorage.getItem('c4v_prep_' + state.ctx + '_' + id) === '1'; } catch { return false; } };
    const hechos = p.checklist.filter(c => done(c.id)).length, total = p.checklist.length;
    const completo = total > 0 && hechos === total;
    const guiaDe = (k) => (p.guias || []).find(g => g.key === k);

    // Mensaje ya escrito para pedir la ficha del modelo: es lo que destraba tres
    // de las ocho compras, el trabajo del electricista y la medida de la puerta.
    const waFicha = waLink(`Hola, soy ${cli ? nombrePropio(cli.nombre) : 'cliente C4V'}${maq ? ` y compré una ${maq.modelo}` : ''}${maq?.pedido ? ` (pedido ${maq.pedido})` : ''}. Estoy preparando mi espacio y necesito la ficha de mi máquina: capacidad del estabilizador, diámetro del extractor, peso, amperaje y medidas de la caja.`);

    return `
      ${completo
        ? `<div class="prep-ok"><strong>🎉 Tu espacio está listo</strong>
             <p>Completaste toda la guía. Ya puedes recibir tu máquina con confianza.</p>
             <a class="btn primary sm" href="#/academia">Aprender a usarla →</a></div>`
        : `<div class="prep-aviso"><strong>Empieza por comprar lo que falta</strong>
             <p>Si tienes todo listo cuando llegue tu máquina, cortas el mismo día. Prepararse toma unas dos semanas, así que empieza hoy.</p></div>`}

      ${fechaEntrega(maq)}
      ${tarjetaCorreo()}

      <h2 class="section-h">1 · Tu lista de compras</h2>
      <p class="muted seccion-bajada">Cómprala completa antes de que llegue tu máquina. Si falta algo, la instalación se detiene.</p>

      ${p.fichaModelo ? `
      <div class="card ficha-modelo">
        <strong>${esc(p.fichaModelo.titulo)}</strong>
        <p>${esc(p.fichaModelo.intro)}</p>
        <a class="btn primary" href="${waFicha}" target="_blank" rel="noopener">Pedir la ficha de mi máquina<span class="sr-only"> (se abre WhatsApp)</span></a>
      </div>` : ''}

      <div class="compras">
        ${p.compras.map((c, i) => `
          <article class="compra">
            <div class="compra-img">
              ${c.img ? `<img src="assets/compras/${esc(c.img)}" alt="Dibujo de ${esc(c.item)}" loading="lazy" onerror="this.remove()">` : ''}
            </div>
            <div class="compra-txt">
              <h3>${i + 1}. ${esc(c.item)}</h3>
              <p class="compra-para">${esc(c.para)}</p>
              <p class="compra-spec">${esc(c.spec)}</p>
              <p class="compra-donde">Dónde: ${esc(c.donde || '—')}</p>
              ${c.pedirFicha ? '<span class="badge warn">Necesitas la ficha de tu modelo</span>' : ''}
            </div>
          </article>`).join('')}
      </div>

      <h2 class="section-h">2 · Deja tu espacio listo <span class="contador" id="prepCount">${hechos} de ${total}</span></h2>
      <p class="muted seccion-bajada">En este orden: primero lo que depende de otras personas y toma días.</p>
      <div class="card">
        <div class="bar" style="margin:0 0 20px"><i id="prepBar" style="width:${total ? Math.round(hechos / total * 100) : 0}%"></i></div>
        <ol id="prepList" class="prep-steps">${p.checklist.map((c, i) => {
          const g = c.guia ? guiaDe(c.guia) : null;
          return `<li class="prep-step${done(c.id) ? ' done' : ''}" data-prep="${c.id}">
            <label class="prep-step-main">
              <span class="prep-step-num" aria-hidden="true">${i + 1}</span>
              <input type="checkbox" ${done(c.id) ? 'checked' : ''} aria-label="${esc(c.t)}">
              <span class="prep-step-txt">${esc(c.t)}
                ${c.tiempo ? `<span class="prep-tiempo">⏱ ${esc(c.tiempo)}</span>` : ''}
                ${c.opcional ? `<span class="prep-opcional">${esc(c.opcional)}</span>` : ''}
              </span>
              <span class="prep-step-check" aria-hidden="true">✓</span>
            </label>
            ${g ? `<div class="prep-como">
              <button type="button" class="prep-como-btn" aria-expanded="false">¿Cómo lo hago?</button>
              <div class="prep-como-txt" hidden><ul class="ulist">${g.pasos.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
            </div>` : ''}
            ${c.img ? `<figure class="prep-step-fig"><img src="assets/prep/${esc(c.img)}" alt="Dibujo: ${esc(c.t)}" loading="lazy" onerror="this.closest('.prep-step-fig').remove()"></figure>` : ''}
          </li>`;
        }).join('')}</ol>
      </div>

      ${bloqueModelo(p, maq, waFicha)}

      ${p.diaEntrega ? `
      <h2 class="section-h">3 · ${esc(p.diaEntrega.titulo)}</h2>
      <div class="card dia-entrega">
        <p>${esc(p.diaEntrega.intro)}</p>
        <ol class="acceso-pasos">${p.diaEntrega.pasos.map(x => `<li${x.destacado ? ' class="destacado"' : ''}>${esc(x.t)}</li>`).join('')}</ol>
      </div>` : ''}

      ${resumenImprimible(p, cli, maq)}

      <div class="help-card" style="margin-top:28px">
        <div class="grow"><h3>Ya está tu espacio, ¿y ahora?</h3>
          <p>Entra a la Academia: ahí están las reglas de seguridad y los cursos para usarla desde el primer día.</p></div>
        <a class="btn primary sm" href="#/academia">Ir a la Academia</a>
      </div>`;
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
        <div class="wa-txt"><strong>Escríbenos por WhatsApp</strong><span>${esc(sop.whatsapp)} · ${esc(sop.horario)}</span></div>
      </a>
      ${refMaq ? `<p class="wa-ctx muted">Tu mensaje ya lleva los datos de tu máquina (<strong>${esc(refMaq)}</strong>) para atenderte más rápido.</p>` : ''}

      <div class="help-card cevi-card">
        <div class="big-ico" aria-hidden="true">${icon('cevi')}</div>
        <div class="grow"><h3>¿Quieres una respuesta ahora mismo?</h3>
          <p>CeVi conoce tu máquina y responde al instante sobre potencias, mantenimiento y fallas. Si no puede, te pasa con una persona.</p></div>
        <button type="button" class="btn primary sm" data-cevi="1">Pregúntale a CeVi</button>
      </div>

      ${(sop.lives || sop.redes) ? `
      <h2 class="section-title">Otras formas de encontrarnos</h2>
      <div class="card redes">
        ${sop.lives ? `<p><strong>Clases en vivo:</strong> ${esc(sop.lives)}</p>` : ''}
        ${sop.redes ? `<p class="redes-links">
          ${sop.redes.tiktok ? `<a href="${esc(sop.redes.tiktok_url || '#')}" target="_blank" rel="noopener">TikTok ${esc(sop.redes.tiktok)}</a>` : ''}
          ${sop.redes.instagram ? `<span>Instagram ${esc(sop.redes.instagram)}</span>` : ''}
          ${sop.redes.facebook ? `<span>Facebook ${esc(sop.redes.facebook)}</span>` : ''}
          ${sop.fijo ? `<span>Teléfono fijo ${esc(sop.fijo)}</span>` : ''}
        </p>` : ''}
      </div>` : ''}

      <h2 class="section-title">Antes de escribir, mira si es algo común</h2>
      <p class="muted" style="margin:0 0 14px;font-size:15px">Estos son los problemas que más nos consultan. Muchos se resuelven en un minuto.</p>
      <div id="guiaList">
        ${d.soporte_guia.map(g => `<div class="faq-item guia"><button type="button" class="faq-q" aria-expanded="false"><span>${esc(g.titulo)}</span><span class="chev" aria-hidden="true">＋</span></button>
          <div class="faq-a"><p style="margin:0 0 6px"><strong>Qué pasa:</strong> ${esc(g.sintoma)}</p>
          <p style="margin:0 0 6px"><strong>Por qué:</strong> ${esc(g.causas)}</p>
          <p style="margin:0 0 12px"><strong>Qué hacer:</strong> ${esc(g.accion)}</p>
          <a class="wa-inline" href="${waSoporte(`Sigo con este problema: «${g.titulo}».`)}" target="_blank" rel="noopener">${wa()}<span>Sigo igual — escribir por WhatsApp</span></a></div></div>`).join('')}
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
      <h2 class="section-title">Trae más trabajos a la red</h2>
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
        ? (cert.fecha ? `<p class="cert-maq-meta">Certificada el ${esc(cert.fecha)}${cert.tecnico ? ` · por ${esc(nombrePropio(cert.tecnico))}` : ''}</p>` : '')
        : enRevision ? '<p class="cert-maq-meta">La estamos probando y calibrando antes de entregártela.</p>'
        : `<p class="cert-maq-meta">Todavía no tenemos el estado de esta máquina. <a href="${waLink(`Hola, quiero saber el estado del Certificado de Calidad de mi máquina${m.modelo ? ' ' + m.modelo : ''}${m.pedido ? ' (pedido ' + m.pedido + ')' : ''}.`)}" target="_blank" rel="noopener">Pregúntanos por WhatsApp</a> y te lo confirmamos.</p>`;
      const publico = cert.url
        ? `<a class="cert-verif-link" href="${esc(cert.url)}" target="_blank" rel="noopener">Ver certificado público ↗</a>` : '';
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
        <div><h1>${esc(ci.nombre)}</h1>
          <p class="cert-lema">«${esc(ci.lema)}»</p>
          <p class="muted" style="max-width:52ch">${esc(ci.frase_ancla)}</p></div>
      </div>

      ${maqs.length ? `<h2 class="section-title">${maqs.length > 1 ? 'Tus máquinas' : 'Tu máquina'}</h2>
      <div class="cert-maq-grid">${maqs.map(certMaq).join('')}</div>` : ''}

      <h2 class="section-title">Qué garantiza</h2>
      <div class="grid cols-2">
        <div class="card"><ul class="ulist">${ci.promesa.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>
        <div class="card"><p>${esc(ci.narrativa)}</p></div>
      </div>

      <h2 class="section-title">El recorrido de tu máquina</h2>
      <div class="card">${ci.etapas.map(e => `<div class="step"><div class="n">${e.n}</div><div><h4>${esc(e.titulo)}</h4><p>${esc(e.detalle)}</p></div></div>`).join('')}</div>

      <h2 class="section-title">Por qué lo hacemos</h2>
      <div class="grid cols-3">${ci.porque.map(x => `<div class="card"><h3>${esc(x.q)}</h3><p>${esc(x.a)}</p></div>`).join('')}</div>

      <h2 class="section-title">Así se ve tu certificado digital</h2>
      <div class="card" style="padding:12px"><img src="assets/certificado-calidad-c4v.png" alt="Certificado de Calidad C4V" class="cert-img" onerror="this.parentElement.remove()"/></div>

      <h2 class="section-title">Preguntas frecuentes</h2>
      ${ci.faq.map(f => `<div class="faq-item"><button type="button" class="faq-q" aria-expanded="false"><span>${esc(f.q)}</span><span class="chev" aria-hidden="true">＋</span></button><div class="faq-a">${esc(f.a)}</div></div>`).join('')}`;
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
  if (route === 'academia') { bindAccordions('.faq-item'); bindAccordions('.course'); bindVideos(); bindQuizzes(); }
  if (route === 'preparacion') {
    view.querySelectorAll('#prepList input[type="checkbox"]').forEach(chk => chk.onchange = () => {
      const step = chk.closest('.prep-step'); const id = step.dataset.prep;
      try { chk.checked ? localStorage.setItem('c4v_prep_' + state.ctx + '_' + id, '1') : localStorage.removeItem('c4v_prep_' + state.ctx + '_' + id); } catch {}
      step.classList.toggle('done', chk.checked);
      const ins = view.querySelectorAll('#prepList input[type="checkbox"]'), n = [...ins].filter(i => i.checked).length;
      $('#prepCount').textContent = n + ' de ' + ins.length;
      $('#prepBar').style.width = Math.round(n / ins.length * 100) + '%';
      // 🎉 Al completar todo, se desbloquea el portal
      if (n === ins.length && ins.length) {
        toast('🎉 ¡Espacio listo! Se desbloqueó tu Academia');
        render('preparacion'); window.scrollTo(0, 0);
      }
    });
    bindCorreo();
    const ih = $('#imprimirHoja'); if (ih) ih.onclick = () => window.print();
    // "¿Cómo lo hago?" pegado a cada paso: antes la explicación estaba tres
    // bloques más abajo y nadie bajaba a buscarla.
    view.querySelectorAll('.prep-como-btn').forEach(b => b.onclick = () => {
      const caja = b.nextElementSibling, abierto = !caja.hidden;
      caja.hidden = abierto;
      b.setAttribute('aria-expanded', String(!abierto));
      b.textContent = abierto ? '¿Cómo lo hago?' : 'Ocultar';
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
function bindVideos() {
  view.querySelectorAll('.lesson-video').forEach(li => {
    const btn = li.querySelector('.lv-btn'), box = li.querySelector('.lv-player'), archivo = li.dataset.video;
    btn.onclick = () => {
      const abierto = !box.hidden;
      // Solo un video abierto a la vez (ahorra datos y evita audios cruzados)
      view.querySelectorAll('.lv-player').forEach(p => { p.hidden = true; p.innerHTML = ''; });
      if (abierto) return;
      box.innerHTML = `<video controls autoplay playsinline preload="none" controlsList="nodownload">
          <source src="videos/c4vtech/${archivo}" type="video/mp4">
          Tu navegador no puede reproducir este video. <a href="videos/c4vtech/${archivo}">Descárgalo aquí</a>.
        </video>`;
      box.hidden = false;
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
          <button type="button" class="btn primary sm qz-next">${idx + 1 < total ? 'Siguiente pregunta →' : 'Ver mi resultado 🏁'}</button>`;
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
          <button type="button" class="btn primary sm qz-retry">↺ Intentar de nuevo</button>
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
const TITLES = { inicio: 'Inicio', academia: 'Aprender a usar mi máquina', preparacion: 'Preparar mi espacio', soporte: 'Necesito ayuda', bolsa: 'Quiero más clientes', plantillas: 'Diseños listos para cortar', certificado: 'Tu Certificado de Calidad' };
// El aviso del candado ya no existe; la preparación se acompaña, no se bloquea.
function render(route) {
  if (!views[route]) route = 'inicio';
  // Sin menú: en cualquier pantalla que no sea el inicio, un solo camino de vuelta.
  const volver = route === 'inicio' ? ''
    : `<a class="volver" href="#/inicio"><span aria-hidden="true">←</span> Volver al inicio</a>
       <h1 class="pag-title">${esc(TITLES[route])}</h1>`;
  view.innerHTML = volver + views[route]();
  if (route === 'certificado' || route === 'soporte') { try { localStorage.setItem('c4v_visto_' + route + '_' + state.ctx, '1'); } catch {} }
  bind(route); window.scrollTo(0, 0);
}
const currentRoute = () => (location.hash.replace('#/', '') || 'inicio');
window.addEventListener('hashchange', () => render(currentRoute()));
window.toast = toast;

// ---------- identidad: tu documento es tu llave ----------
/* persona → DNI / Cédula / CI / RUT / CC · empresa → RUC / NIT / RUT (según país).
   Normalización: mayúsculas, solo dígitos y K (dígito verificador del RUT chileno). */
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
  const sinRuta = !location.hash || location.hash === '#/' || location.hash === '#/inicio';
  if (!pe.completo && sinRuta) {
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
const otpEstado = { solicitud: null, pais: null, sondeo: null };

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
    if (res.estado === 'ok') { entrar(res.cliente); return; }

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

  mostrarPaso('doc');
  gate.hidden = false; $('#app').hidden = true;
}

// ---------- CeVi · asistente de la máquina (chat + voz) ----------
/* Conecta con el backend propio (cevi-backend en Railway): Claude Haiku con el
   cerebro de CeVi, voz es-MX Dalia y creación de tickets en Odoo.
   Se le pasa el contexto REAL del cliente (nombre, ciudad, país, serie y su id de
   partner en Odoo) para que no pregunte lo que ya sabemos y para que la conversación
   quede registrada en la ficha correcta del ERP, sin crear contactos duplicados. */
const cevi = { abierto: false, historial: [], hablando: null, escuchando: null, partnerId: null };

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
    ? `<div class="cevi-avatar" aria-hidden="true">🐂</div><div class="cevi-txt">${esc(texto)}${extra}</div>`
    : `<div class="cevi-txt">${esc(texto)}</div>`;
  return `<div class="cevi-msg ${quien}">${cuerpo}</div>`;
}

function ceviPintar() {
  const box = $('#ceviMsgs');
  if (!box) return;
  box.innerHTML = cevi.historial.map(m => ceviBurbuja(m.role === 'user' ? 'yo' : 'cevi', m.content, m.ticket
    ? `<div class="cevi-ticket">✅ Ya le avisé a una persona del equipo. Te escriben por WhatsApp.</div>` : '')).join('');
  box.scrollTop = box.scrollHeight;
}

// Voz: reproduce la respuesta con la voz mexicana del backend (gratis, sin API key).
async function ceviHablar(texto) {
  if (!CFG.ceviVoz || !ceviVozActiva()) return;
  try {
    if (cevi.hablando) { cevi.hablando.pause(); cevi.hablando = null; }
    const r = await fetch(`${CFG.ceviApi}/tts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: texto })
    });
    if (!r.ok) return;
    const audio = new Audio(URL.createObjectURL(await r.blob()));
    cevi.hablando = audio;
    audio.play().catch(() => {});   // si el navegador bloquea el autoplay, no pasa nada
  } catch { /* sin voz, el texto ya está en pantalla */ }
}

const ceviVozActiva = () => { try { return localStorage.getItem('c4v_cevi_voz') !== '0'; } catch { return true; } };

async function ceviEnviar(texto) {
  const msg = String(texto || '').trim();
  if (!msg || $('#ceviInput')?.disabled) return;
  cevi.historial.push({ role: 'user', content: msg });
  document.getElementById('ceviSug')?.remove();   // ya no hacen falta
  ceviPintar();
  const input = $('#ceviInput'); if (input) { input.value = ''; input.disabled = true; }
  $('#ceviMsgs').insertAdjacentHTML('beforeend', '<div class="cevi-msg cevi pensando" aria-hidden="true"><div class="cevi-avatar">🐂</div><div class="cevi-txt"><span></span><span></span><span></span></div></div>');
  $('#ceviMsgs').scrollTop = $('#ceviMsgs').scrollHeight;

  try {
    const r = await fetch(`${CFG.ceviApi}/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, history: cevi.historial.slice(0, -1).slice(-8), ...ceviContexto() })
    });
    if (!r.ok) throw new Error('http ' + r.status);
    const j = await r.json();
    if (j.partner_id) cevi.partnerId = j.partner_id;
    const respuesta = j.response || 'Disculpa, no te entendí. ¿Lo repites?';
    cevi.historial.push({ role: 'assistant', content: respuesta, ticket: j.ticket?.ref || null });
    ceviPintar();
    ceviHablar(respuesta);
  } catch {
    cevi.historial.push({
      role: 'assistant',
      content: 'No pude conectarme en este momento. Escríbenos por WhatsApp y te responde una persona del equipo.'
    });
    ceviPintar();
  } finally {
    if (input) { input.disabled = false; input.focus(); }
  }
}

// Dictado por voz con el reconocimiento nativo del navegador (sin costo).
function ceviEscuchar(boton) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast('Tu navegador no permite dictar. Escribe tu pregunta.'); return; }
  if (cevi.escuchando) { cevi.escuchando.stop(); cevi.escuchando = null; return; }
  const rec = new SR();
  rec.lang = 'es-PE'; rec.interimResults = true; rec.continuous = false;
  cevi.escuchando = rec;
  boton.classList.add('grabando'); boton.setAttribute('aria-label', 'Detener dictado');
  rec.onresult = (e) => {
    const txt = Array.from(e.results).map(x => x[0].transcript).join('');
    const input = $('#ceviInput'); if (input) input.value = txt;
    if (e.results[e.results.length - 1].isFinal) { rec.stop(); ceviEnviar(txt); }
  };
  rec.onerror = () => toast('No te escuché bien. Intenta de nuevo o escribe.');
  rec.onend = () => { cevi.escuchando = null; boton.classList.remove('grabando'); boton.setAttribute('aria-label', 'Dictar por voz'); };
  rec.start();
}

function ceviPanelHTML() {
  const ag = CFG.agente || {};
  const cli = currentClient();
  const nombre = primerNombre(cli?.nombre);
  return `
    <div class="cevi-head">
      <div class="cevi-avatar grande" aria-hidden="true">🐂</div>
      <div class="cevi-head-txt">
        <strong>${esc(ag.nombre || 'CeVi')}</strong>
        <span>Tu asistente C4V · responde al instante</span>
      </div>
      <button type="button" class="cevi-voz" id="ceviVoz" aria-pressed="${ceviVozActiva()}" aria-label="Leer respuestas en voz alta">${ceviVozActiva() ? CEVI_ICONOS.audioOn : CEVI_ICONOS.audioOff}</button>
      <button type="button" class="cevi-close" id="ceviClose" aria-label="Cerrar">×</button>
    </div>
    <div class="cevi-msgs" id="ceviMsgs" role="log" aria-live="polite" aria-label="Conversación con CeVi"></div>
    <div class="cevi-sug" id="ceviSug">
      ${['¿Con qué potencia corto MDF de 3 mm?', '¿Cada cuánto cambio el agua del chiller?', 'Mi láser dejó de cortar bien']
        .map(q => `<button type="button" class="chip" data-q="${esc(q)}">${esc(q)}</button>`).join('')}
    </div>
    <form class="cevi-form" id="ceviForm">
      <button type="button" class="cevi-mic" id="ceviMic" aria-label="Dictar por voz">${CEVI_ICONOS.mic}</button>
      <input id="ceviInput" type="text" autocomplete="off" placeholder="${nombre ? `Pregúntame lo que sea, ${esc(nombre)}` : 'Escribe tu pregunta'}" aria-label="Tu pregunta para CeVi">
      <button type="submit" class="cevi-send" aria-label="Enviar">${CEVI_ICONOS.enviar}</button>
    </form>
    <p class="cevi-pie">CeVi responde solo, con inteligencia artificial. Si el tema es serio, te pasamos con una persona del equipo.</p>`;
}

function ceviAbrir() {
  const panel = $('#aiPanel'), btn = $('#aiBtn');
  if (!panel) return;
  cevi.origen = document.activeElement;          // para devolver el foco al cerrar
  panel.innerHTML = ceviPanelHTML();
  panel.hidden = false; cevi.abierto = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'Chat con CeVi, tu asistente');
  btn?.setAttribute('aria-expanded', 'true');

  if (!cevi.historial.length) {
    const cli = currentClient();
    const maq = cli ? state.db.maquinas.find(m => m.cliente_id === cli.id) : null;
    cevi.historial.push({
      role: 'assistant',
      content: `Hola${cli ? ' ' + primerNombre(cli.nombre) : ''}. Soy CeVi.${maq?.modelo ? ` Veo que tienes tu ${maq.modelo}.` : ''} Pregúntame sobre parámetros, mantenimiento o cualquier problema con tu máquina.`
    });
  }
  ceviPintar();

  $('#ceviClose').onclick = ceviCerrar;
  $('#ceviForm').onsubmit = (e) => { e.preventDefault(); ceviEnviar($('#ceviInput').value); };
  $('#ceviMic').onclick = (e) => ceviEscuchar(e.currentTarget);
  $('#ceviVoz').onclick = (e) => {
    const activa = !ceviVozActiva();
    try { localStorage.setItem('c4v_cevi_voz', activa ? '1' : '0'); } catch {}
    e.currentTarget.setAttribute('aria-pressed', activa);
    e.currentTarget.innerHTML = activa ? CEVI_ICONOS.audioOn : CEVI_ICONOS.audioOff;
    if (!activa && cevi.hablando) { cevi.hablando.pause(); cevi.hablando = null; }
  };
  panel.querySelectorAll('#ceviSug .chip').forEach(b => b.onclick = () => ceviEnviar(b.dataset.q));
  setTimeout(() => $('#ceviInput')?.focus(), 60);
}

function ceviCerrar() {
  const panel = $('#aiPanel');
  if (panel) { panel.hidden = true; panel.innerHTML = ''; }
  cevi.abierto = false;
  const btn = $('#aiBtn');
  btn?.setAttribute('aria-expanded', 'false');
  // Sin esto el foco caía al principio del documento al cerrar con Escape.
  (cevi.origen && document.contains(cevi.origen) ? cevi.origen : btn)?.focus();
  if (cevi.hablando) { cevi.hablando.pause(); cevi.hablando = null; }
  if (cevi.escuchando) { try { cevi.escuchando.stop(); } catch {} cevi.escuchando = null; }
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

/* ---------- Resumen imprimible ----------
   Una hoja con todo: lo que hay que comprar y lo que hay que hacer, en casillas.
   Es lo que el cliente se lleva a la ferretería y le pasa a su electricista.
   Al imprimir, el resto del portal desaparece y queda solo esto. */
function resumenImprimible(p, cli, maq) {
  const casilla = '<span class="hoja-box" aria-hidden="true"></span>';
  return `
    <section class="hoja" id="hojaResumen">
      <div class="hoja-cab">
        <div>
          <h2>Todo lo que necesitas, en una hoja</h2>
          <p>Imprímela o guárdala en el celular. Ve marcando lo que ya tienes.</p>
        </div>
        <button type="button" class="btn primary sm no-print" id="imprimirHoja">🖨 Imprimir</button>
      </div>

      <div class="hoja-marca">
        <strong>C4V Láser</strong>
        <span>Preparación de tu espacio${cli ? ` · ${esc(nombrePropio(cli.nombre))}` : ''}${maq?.modelo ? ` · láser ${esc(maq.modelo)}` : ''}</span>
      </div>

      <div class="hoja-cols">
        <div class="hoja-col">
          <h3>Lo que compro</h3>
          <ul>${p.compras.map(c => `<li>${casilla}<span>${esc(c.item)}${c.pedirFicha ? ' <em>(pide la medida)</em>' : ''}</span></li>`).join('')}</ul>
        </div>
        <div class="hoja-col">
          <h3>Lo que hago</h3>
          <ul>${p.checklist.map(c => `<li>${casilla}<span>${esc(c.t)}${c.tiempo ? ` <em>${esc(c.tiempo)}</em>` : ''}</span></li>`).join('')}</ul>
        </div>
      </div>

      ${p.fichaModelo ? `
      <div class="hoja-ficha">
        <h3>Lo que le pido a mi asesor</h3>
        <p>Capacidad del estabilizador · diámetro del extractor · peso de la máquina · amperaje y grosor del cable · medidas de la caja</p>
      </div>` : ''}

      <p class="hoja-pie">¿Dudas? WhatsApp ${esc((CFG.contacto || {}).whatsapp_visible || '')} — te responde una persona, todos los días.</p>
    </section>`;
}

/* ---------- Cuenta regresiva hasta la entrega ----------
   La fecha ya venía de Odoo y no se mostraba en ningún lado. Sin fecha, "prepara
   tu espacio antes de que llegue" es una idea abstracta; con fecha, es un plazo. */
function fechaEntrega(maq) {
  const f = maq?.fecha_entrega;
  if (!f) return '';
  const fecha = new Date(f + 'T12:00:00');
  if (isNaN(fecha)) return '';
  const dias = Math.round((fecha - new Date()) / 864e5);
  const bonito = fecha.toLocaleDateString('es-PE', { day: 'numeric', month: 'long' });
  if (dias < -30) return '';                       // entrega antigua: ya no es una cuenta regresiva
  const txt = dias > 1 ? `Te quedan <strong>${dias} días</strong>`
    : dias === 1 ? 'Es <strong>mañana</strong>'
    : dias === 0 ? 'Es <strong>hoy</strong>'
    : 'Ya debería estar contigo';
  return `<div class="cuenta ${dias <= 7 ? 'urgente' : ''}">
      <span class="cuenta-ic" aria-hidden="true">📅</span>
      <div><strong>Tu ${esc(maq.modelo ? 'láser ' + maq.modelo : 'máquina')} llega alrededor del ${esc(bonito)}</strong>
      <span>${txt} para dejar tu espacio listo.</span></div>
    </div>`;
}

/* Solo el grupo del cliente. Mostrar los dos hacía que alguien con una compacta
   leyera especificaciones industriales que no le tocan y se asustara. */
function bloqueModelo(p, maq, waFicha) {
  const pm = p.porModelo;
  if (!pm) return '';
  const modelo = String(maq?.modelo || '').replace(/\D/g, '');
  const mio = (pm.grupos || []).find(g => g.modelos.includes(modelo));
  if (!mio) {
    return `<h2 class="section-h">Según tu modelo</h2>
      <div class="card">
        <p>No tenemos cargado qué modelo compraste, así que no podemos decirte si tu instalación es remota o presencial.</p>
        <a class="wa-inline" href="${waFicha}" target="_blank" rel="noopener">Pregúntanos por WhatsApp</a>
      </div>`;
  }
  return `<h2 class="section-h">Según tu modelo${maq?.modelo ? ` · ${esc(maq.modelo)}` : ''}</h2>
    <div class="card modelo-card mio">
      <p><strong>Instalación:</strong> ${esc(mio.instalacion)}</p>
      <p><strong>En qué concentrarte:</strong> ${esc(mio.foco)}</p>
      <p class="muted">${esc(mio.nota)}</p>
    </div>`;
}

/* ---------- Llevarse la guía al correo ----------
   El cliente va a ir a comprar con el celular en la mano y va a hablar con un
   electricista. Tener la lista en su correo (y poder reenviársela) vale más que
   tenerla solo aquí. Se le pide el correo UNA vez y se explica para qué. */
function tarjetaCorreo() {
  if (modoDemo()) return '';                       // en demostración no se envía nada
  const g = state.guiaPorCorreo;
  // Si el servidor no puede mandar correo, no se pide uno que no vamos a usar:
  // se ofrece descargar la guía, que resuelve lo mismo (llevársela a la ferretería).
  if (g && g.disponible === false) {
    return `<div class="correo-caja">
        <div class="correo-ic" aria-hidden="true">📄</div>
        <div class="grow">
          <strong>Llévate esta guía contigo</strong>
          <p>Descárgala o imprímela para tenerla en la ferretería y pasársela a tu electricista.</p>
          <button type="button" class="btn primary" id="guiaDescargar">Descargar mi guía</button>
        </div>
      </div>`;
  }
  if (g && g.enviada) {
    return `<div class="correo-caja lista">
        <div class="correo-ic" aria-hidden="true">✅</div>
        <div class="grow">
          <strong>Te enviamos esta guía a ${esc(g.email || 'tu correo')}</strong>
          <p>Llévala contigo cuando vayas a comprar y pásasela a tu electricista. ¿No llegó? Mira en tu carpeta de spam.</p>
        </div>
        <button type="button" class="btn ghost sm" id="correoOtra">Enviarla a otro correo</button>
      </div>`;
  }
  return `<div class="correo-caja">
      <div class="correo-ic" aria-hidden="true">📩</div>
      <div class="grow">
        <strong>Llévate esta guía en tu correo</strong>
        <p>Te mandamos la lista de compras y el checklist completos. Así los tienes en la ferretería y se los puedes reenviar a tu electricista.</p>
        <form class="correo-form" id="correoForm">
          <input type="email" id="correoInput" placeholder="tucorreo@ejemplo.com" autocomplete="email" aria-label="Tu correo electrónico" required>
          <button class="btn primary" type="submit">Enviármela</button>
        </form>
        <div class="correo-msg" id="correoMsg" role="status" hidden></div>
      </div>
    </div>`;
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
  const desc = $('#guiaDescargar');
  if (desc) desc.onclick = () => { document.getElementById('hojaResumen')?.scrollIntoView({ behavior: 'smooth' }); setTimeout(() => window.print(), 500); };
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
      <strong>${esc(e.razon_social || '')}</strong>${e.ruc ? ` · RUC ${esc(e.ruc)}` : ''}${e.domicilio ? `<br>${esc(e.domicilio)}` : ''}
      <br>Atención al cliente: WhatsApp ${esc(e.whatsapp_visible || CFG.whatsapp?.visible || '')}${e.telefono ? ` · Tel. ${esc(e.telefono)}` : ''}${e.email ? ` · ${esc(e.email)}` : ''}
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
