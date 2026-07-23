/* Central de Postventa C4V — SPA (vanilla JS). Sin login (modo local).
   Funciona con servidor (npm start) o en modo DEMO con datos embebidos (data.js). */

const state = { db: null, ctx: null, offline: false, telefono: null };
const CFG = window.C4V_CONFIG || {};
const SESION_DIAS = 90; // A5: sesión recordada 90 días en el dispositivo

// ---------- helpers ----------
const $ = (s, r = document) => r.querySelector(s);
const view = $('#view');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => new Date().toISOString().slice(0, 10);
const PAISES = { PE: '🇵🇪 Perú', EC: '🇪🇨 Ecuador', BO: '🇧🇴 Bolivia', CL: '🇨🇱 Chile', CO: '🇨🇴 Colombia' };
const ESTADO_TICKET = { nuevo: 'Recibido', asignado: 'Asignado', en_proceso: 'En atención', resuelto: 'Resuelto', cerrado: 'Cerrado' };

function toast(msg) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2600);
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
/* Introducción OBLIGATORIA para clientes nuevos.
   Mientras el checklist de preparación NO esté completo, SOLO estas rutas son accesibles.
   Es una lista blanca (default-deny): cualquier otra sección — actual o futura —
   queda bloqueada y redirige a #/preparacion. Así la guía no se puede saltar. */
const RUTAS_LIBRES = ['inicio', 'preparacion', 'soporte', 'certificado'];

// ---------- data layer ----------
async function loadDB() {
  // Hosting estático (GitHub Pages / archivo local): demo directa, sin esperar un 404.
  if (location.hostname.endsWith('github.io') || location.protocol === 'file:') { state.offline = true; return JSON.parse(JSON.stringify(window.__SEED__)); }
  try { const db = await apiGet('/api/bootstrap'); state.offline = false; return db; }
  catch { state.offline = true; return JSON.parse(JSON.stringify(window.__SEED__)); }
}
function assignTicket(db, tipo, pais) {
  if (tipo === 'soporte') { const t = db.tecnicos.find(x => x.pais === pais && !x.nombre.includes('Por asignar')); return t ? t.nombre : `Soporte ${pais}`; }
  const c = db.comercial.find(x => x.pais === pais); return c ? c.nombre : `Comercial ${pais}`;
}
async function mutate(onlineCall, offlineFn) {
  if (!state.offline) { await onlineCall(); state.db = await loadDB(); } else { offlineFn(state.db); }
}
const post = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => { if (!r.ok) throw new Error('err'); });
const actions = {
  crearTicket: (p) => mutate(() => post('/api/tickets', p),
    (db) => db.tickets.unshift({ id: 'TK-' + (2000 + db.tickets.length + 1), tipo: p.tipo, serie: p.serie || '', pais: p.pais || 'PE', asunto: p.asunto, descripcion: p.descripcion || '', estado: 'nuevo', prioridad: p.prioridad || 'media', asignado_a: assignTicket(db, p.tipo, p.pais || 'PE'), cliente_id: p.cliente_id || null, fecha: today() })),
  estadoTicket: (id, estado) => mutate(() => post(`/api/tickets/${id}/estado`, { estado }),
    (db) => { const t = db.tickets.find(x => x.id === id); if (t) t.estado = estado; }),
  crearLead: (p) => mutate(() => post('/api/leads', p),
    (db) => db.leads.unshift({ id: 'lead-' + (1000 + db.leads.length + 1), titulo: p.titulo, descripcion: p.descripcion || '', material: p.material || '', cantidad: p.cantidad || '', pais: p.pais || 'PE', ciudad: p.ciudad || '', contacto: p.contacto, telefono: p.telefono || '', estado: 'nuevo', tomado_por: null, fecha: today() })),
  tomarLead: (id, cliente_id) => mutate(() => post(`/api/leads/${id}/tomar`, { cliente_id }),
    (db) => { const l = db.leads.find(x => x.id === id); if (l) { l.estado = 'tomado'; l.tomado_por = cliente_id; } })
};

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
const thumb = (key) => `<svg viewBox="0 0 200 120" fill="none" stroke="#F9020B" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">${THUMBS[key] || '<rect x="60" y="40" width="80" height="40" rx="6"/>'}</svg>`;

// Sello del Certificado de Calidad C4V (de P2/COMUNICACION.md)
const SEAL = `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Certificado de Calidad C4V"><circle cx="100" cy="100" r="96" fill="#fdeeee" stroke="#F9020B" stroke-width="5"/><circle cx="100" cy="100" r="84" fill="none" stroke="#F9020B" stroke-width="1.5" stroke-dasharray="2 4"/><text x="100" y="54" text-anchor="middle" font-family="'Roboto Slab', serif" font-size="12" font-weight="700" letter-spacing="2" fill="#c40309">CERTIFICADO</text><text x="100" y="70" text-anchor="middle" font-family="'Roboto Slab', serif" font-size="10" letter-spacing="4" fill="#141414">DE CALIDAD</text><text x="100" y="121" text-anchor="middle" font-family="'Roboto Slab', serif" font-size="38" font-weight="800" fill="#F9020B">C4V</text><text x="100" y="150" text-anchor="middle" font-family="'Roboto', sans-serif" font-size="8.5" font-weight="700" letter-spacing="1.5" fill="#141414">PROBADA · CALIBRADA · LISTA</text></svg>`;

// Íconos de línea (profesional, sin emojis)
const ICONS = {
  academia: '<path d="M12 6.5C12 5 10 4 7.5 4S4 4.8 4 4.8v13s1-.8 3.5-.8 4.5 1 4.5 1"/><path d="M12 6.5C12 5 14 4 16.5 4S20 4.8 20 4.8v13s-1-.8-3.5-.8-4.5 1-4.5 1"/><path d="M12 6.5v11"/>',
  soporte: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H9l-4.5 4z"/>',
  bolsa: '<rect x="3" y="7.5" width="18" height="12" rx="2"/><path d="M8.5 7.5v-2A1.5 1.5 0 0 1 10 4h4a1.5 1.5 0 0 1 1.5 1.5v2"/>',
  disenos: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2"/>',
  prep: '<path d="M9 3v4M15 3v4M7 7h10v5a5 5 0 0 1-10 0z"/><path d="M12 17v4"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.4 2.4 0 1 1 3.1 2.3c-.7.3-1.1.8-1.1 1.6"/><path d="M12 16.4h.01"/>'
};
const icon = (n) => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICONS[n] || ''}</svg>`;

// Diagramas simples para la guía de preparación (accentos en currentColor = rojo de marca)
const DIAG = {
  electrico: '<rect x="72" y="34" width="76" height="58" rx="12" fill="#fff" stroke="#333" stroke-width="3"/><line x1="98" y1="50" x2="98" y2="68" stroke="#333" stroke-width="4"/><line x1="122" y1="50" x2="122" y2="68" stroke="#333" stroke-width="4"/><circle cx="110" cy="80" r="4" fill="#333"/><path d="M150 12 l-14 22 h11 l-7 18 20 -25 h-11 z" fill="currentColor"/><text x="110" y="110" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="700" fill="currentColor">220V dedicado</text>',
  tierra: '<rect x="92" y="16" width="36" height="24" rx="4" fill="#fff" stroke="#333" stroke-width="3"/><line x1="110" y1="40" x2="110" y2="62" stroke="#333" stroke-width="3"/><line x1="84" y1="62" x2="136" y2="62" stroke="currentColor" stroke-width="4"/><line x1="92" y1="72" x2="128" y2="72" stroke="currentColor" stroke-width="4"/><line x1="100" y1="82" x2="120" y2="82" stroke="currentColor" stroke-width="4"/><text x="110" y="108" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="700" fill="currentColor">Pozo a tierra</text>',
  extraccion: '<rect x="34" y="46" width="72" height="46" rx="6" fill="#fff" stroke="#333" stroke-width="3"/><path d="M52 40 q6 -9 12 0 q6 9 12 0" fill="none" stroke="#999" stroke-width="2.5"/><path d="M106 60 H150 V38" fill="none" stroke="#333" stroke-width="3"/><path d="M150 30 l-7 12 h14 z" fill="currentColor"/><line x1="158" y1="30" x2="188" y2="30" stroke="#333" stroke-width="3"/><text x="120" y="110" text-anchor="middle" font-family="sans-serif" font-size="12.5" font-weight="700" fill="currentColor">Extractor al exterior</text>',
  chiller: '<rect x="80" y="30" width="60" height="52" rx="8" fill="#fff" stroke="#333" stroke-width="3"/><path d="M110 40 c-11 13 -15 19 -15 25 a15 15 0 0 0 30 0 c0 -6 -4 -12 -15 -25 z" fill="currentColor"/><text x="110" y="106" text-anchor="middle" font-family="sans-serif" font-size="12" font-weight="700" fill="currentColor">Agua destilada · 15–25°C</text>',
  secuencia: '<g font-family="sans-serif"><rect x="4" y="38" width="58" height="42" rx="6" fill="#fff" stroke="#333" stroke-width="2.5"/><text x="33" y="57" text-anchor="middle" font-size="13" font-weight="800" fill="#333">1</text><text x="33" y="71" text-anchor="middle" font-size="8" fill="#333">Estabiliz.</text><path d="M66 59 h14" stroke="currentColor" stroke-width="3"/><path d="M80 59 l-7 -4 v8 z" fill="currentColor"/><rect x="84" y="38" width="52" height="42" rx="6" fill="#fff" stroke="#333" stroke-width="2.5"/><text x="110" y="57" text-anchor="middle" font-size="13" font-weight="800" fill="#333">2</text><text x="110" y="71" text-anchor="middle" font-size="8" fill="#333">Chiller</text><path d="M140 59 h14" stroke="currentColor" stroke-width="3"/><path d="M154 59 l-7 -4 v8 z" fill="currentColor"/><rect x="158" y="38" width="58" height="42" rx="6" fill="#fff" stroke="#333" stroke-width="2.5"/><text x="187" y="57" text-anchor="middle" font-size="13" font-weight="800" fill="#333">3</text><text x="187" y="71" text-anchor="middle" font-size="8" fill="#333">Máquina</text></g>',
  seguridad: '<path d="M110 28 L152 92 H68 Z" fill="#fff" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><line x1="110" y1="50" x2="110" y2="72" stroke="currentColor" stroke-width="4"/><circle cx="110" cy="82" r="2.8" fill="currentColor"/><text x="110" y="110" text-anchor="middle" font-family="sans-serif" font-size="12.5" font-weight="700" fill="currentColor">Nunca cortes PVC</text>'
};
const diag = (k) => `<svg class="diag" viewBox="0 0 220 120" fill="none">${DIAG[k] || ''}</svg>`;

// ---------- vistas ----------
const views = {
  /* Pantalla única: saludo + tu máquina + 4 botones grandes. Nada más.
     Todo lo demás vive DENTRO de esos 4 botones. */
  inicio() {
    const d = state.db, cli = currentClient();
    const maq = cli ? d.maquinas.find(m => m.cliente_id === cli.id) : null;
    const lista = maq ? d.maquinas.filter(m => m.cliente_id === cli.id) : [];
    const certificada = maq?.certificado?.estado === 'certificada';

    const bigBtn = (href, ic, t, desc, ext) => `<a class="big" href="${href}"${ext ? ' target="_blank" rel="noopener"' : ''}>
        <div class="big-ico">${icon(ic)}</div>
        <div class="big-txt"><strong>${t}</strong><span>${desc}</span></div>
        <div class="big-arrow" aria-hidden="true">→</div></a>`;

    const prep = prepEstado();
    const lockBtn = (ic, t) => `<button type="button" class="big lock" data-lock="1">
        <div class="big-ico">${icon(ic)}</div>
        <div class="big-txt"><strong>🔒 ${t}</strong><span>Se desbloquea al completar tu preparación</span></div>
      </button>`;

    return `
      <h1 class="saludo">${cli ? `Hola, ${esc(cli.nombre.split(' ')[0])}` : 'Hola'}</h1>

      ${maq ? `<a class="maq" href="#/certificado">
        <div class="maq-seal">${SEAL}</div>
        <div class="maq-txt">
          <strong>Tu láser ${esc(maq.modelo)}</strong>
          <span>${certificada
            ? 'Certificada ✓ · Ver tu Certificado de Calidad'
            : 'La estamos probando y calibrando · Ver qué significa'}</span>
          ${lista.length > 1 ? `<span class="muted">y ${lista.length - 1} máquina${lista.length > 2 ? 's' : ''} más</span>` : ''}
        </div>
        <div class="big-arrow" aria-hidden="true">→</div></a>` : ''}

      ${prep.completo ? '' : `
      <a class="prep-cta" href="#/preparacion">
        <div class="prep-cta-top"><strong>Paso 1 · Deja tu espacio listo</strong><span>${prep.n} de ${prep.total}</span></div>
        <div class="bar"><i style="width:${prep.total ? Math.round(prep.n / prep.total * 100) : 0}%"></i></div>
        <p>Antes de usar tu máquina, completa la guía: eléctrico, pozo a tierra, extracción y agua destilada. Así tu instalación sale bien a la primera.</p>
        <span class="prep-cta-btn">Continuar mi preparación →</span>
      </a>`}

      <div class="bigs">
        ${prep.completo
          ? bigBtn('#/preparacion', 'prep', 'Preparar mi espacio', 'Tu checklist quedó completo ✓')
          : ''}
        ${prep.completo
          ? bigBtn('#/academia', 'academia', 'Aprender a usar mi máquina', 'Cursos en video, quizzes y preguntas frecuentes')
          : lockBtn('academia', 'Aprender a usar mi máquina')}
        ${prep.completo
          ? bigBtn('#/bolsa', 'bolsa', 'Quiero más clientes', 'Trabajos de corte que te pasamos gratis')
          : lockBtn('bolsa', 'Quiero más clientes')}
        ${bigBtn('#/soporte', 'soporte', 'Necesito ayuda', 'Habla con nosotros por WhatsApp')}
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
      return `<div class="course"><button type="button" class="course-head" aria-expanded="false">
          <div class="course-ico">${i + 1}</div>
          <div style="flex:1"><h3>${esc(c.titulo)} ${estado} ${esVideo ? '<span class="badge red">🎬 en video</span>' : ''}</h3>
            <div class="sub">${esc(c.nivel)} · ${c.modulos.length} módulos · ${nLes} lecciones — ${esc(c.descripcion)}</div></div>
          <span class="chev">＋</span></button>
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
      <div class="chips-row">${a.ruta.map((r, i) => `<span class="chip">${i + 1}. ${esc(r)}</span>`).join('')}</div>

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
      <div class="card" style="padding:0;overflow:hidden">
        <table class="table"><thead><tr><th>Modelo</th><th>Área</th><th>Ideal para</th><th>Ref. (PE)</th></tr></thead>
        <tbody>${m.items.map(x => `<tr><td><strong>${esc(x.modelo)}</strong></td><td>${esc(x.area)}</td><td>${esc(x.ideal)}</td><td class="muted">${esc(x.precio)}</td></tr>`).join('')}</tbody></table>
      </div>
      <div class="grid cols-2" style="margin-top:14px">
        <div class="card"><h3>Materiales</h3><p>${esc(m.materiales)}</p></div>
        <div class="card"><h3>Mejoras nuevas</h3><p>${esc(m.mejoras)}</p></div>
      </div>

      <h2 class="section-title">Prepara tu espacio</h2>
      <div class="help-card"><div class="grow"><h3>Antes de instalar, deja tu espacio listo</h3>
        <p>Checklist imprimible y guías paso a paso: eléctrico, pozo a tierra, extracción y agua destilada.</p></div>
        <a class="btn primary sm" href="#/preparacion">Abrir la guía</a></div>

      <h2 class="section-title">Preguntas frecuentes</h2>
      ${faqCats.map(cat => `<h4 style="font-size:14px;margin:16px 0 8px">${esc(cat)}</h4>
        ${faqs.filter(f => f.categoria === cat).map(f => `<div class="faq-item"><button type="button" class="faq-q" aria-expanded="false"><span>${esc(f.pregunta)}</span><span class="chev">＋</span></button><div class="faq-a">${esc(f.respuesta)}</div></div>`).join('')}`).join('')}`;
  },

  preparacion() {
    const p = state.db.preparacion;
    const done = (id) => { try { return localStorage.getItem('c4v_prep_' + state.ctx + '_' + id) === '1'; } catch { return false; } };
    const hechos = p.checklist.filter(c => done(c.id)).length, total = p.checklist.length;
    const completo = total > 0 && hechos === total;
    return `
      ${completo
        ? `<div class="prep-ok"><strong>🎉 ¡Tu espacio está listo!</strong>
             <p>Completaste toda la guía. Ya puedes instalar con confianza y explorar todo tu portal.</p>
             <a class="btn primary sm" href="#/academia">Ir a la Academia →</a></div>`
        : `<div class="prep-aviso"><strong>Empieza por aquí 👇</strong>
             <p>Antes de que llegue tu máquina necesitas <strong>tener TODO comprado y listo</strong>: revisa la lista de compras, mide el acceso y marca cada punto del checklist. Cuando completes todo, se desbloquea el resto de tu portal — así tu instalación sale bien a la primera y produces desde el día 1.</p></div>`}
      <div class="page-head" style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap">
        <div><p style="margin:0;max-width:64ch">${esc(p.intro)}</p></div>
        <button class="btn ghost sm" id="printPrep">🖨 Imprimir</button>
      </div>

      ${p.acceso ? `
      <h2 class="section-title">${esc(p.acceso.titulo)}</h2>
      <div class="card acceso">
        <div class="acceso-diag" aria-hidden="true">
          <svg viewBox="0 0 220 150" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="18" y="14" width="76" height="122" rx="2"/>
            <rect x="26" y="22" width="60" height="114"/>
            <path d="M120 75h30" stroke-dasharray="4 5"/><path d="M144 68l8 7-8 7"/>
            <rect x="158" y="38" width="48" height="74" rx="2"/>
            <path d="M158 52h48M158 66h48M158 80h48M158 94h48" opacity=".35"/>
            <path d="M10 14v122" opacity=".5"/><path d="M6 30l4-6 4 6M6 120l4 6 4-6" opacity=".5"/>
            <path d="M26 146h60" opacity=".5"/><path d="M36 142l-6 4 6 4M76 142l6 4-6 4" opacity=".5"/>
          </svg>
          <span>Puerta vs. máquina embalada</span>
        </div>
        <div class="grow">
          <p style="margin:0 0 10px">${esc(p.acceso.intro)}</p>
          <ol class="acceso-pasos">${p.acceso.pasos.map(x => `<li>${esc(x)}</li>`).join('')}</ol>
        </div>
      </div>` : ''}

      <h2 class="section-title">🛒 Lista de compras — cómprala COMPLETA antes de que llegue</h2>
      <div class="card compras-destacada">
        <p class="compras-nota">Esto es <strong>súper importante</strong>: tu máquina no se puede instalar si falta algo de esta lista. Cómpralo todo con anticipación y tenlo esperándola — así produces desde el primer día.</p>
        <table><thead><tr><th>Ítem</th><th>Para qué</th><th>Especificación</th></tr></thead>
        <tbody>${p.compras.map(c => `<tr><td><strong>${esc(c.item)}</strong></td><td>${esc(c.para)}</td><td>${esc(c.spec)}</td></tr>`).join('')}</tbody></table>
      </div>

      <h2 class="section-title">Checklist paso a paso <span id="prepCount" style="text-transform:none;letter-spacing:0;color:var(--muted);font-weight:600">${hechos}/${total}</span></h2>
      <div class="card">
        <p class="prep-list-intro">Ve marcando cada punto cuando lo tengas listo. Sigue el orden: cada paso te acerca a cortar desde el primer día. La foto es una referencia de cómo debe verse.</p>
        <div class="bar" style="margin:0 0 20px"><i id="prepBar" style="width:${total ? Math.round(hechos / total * 100) : 0}%"></i></div>
        <ol id="prepList" class="prep-steps">${p.checklist.map((c, i) => `<li class="prep-step${done(c.id) ? ' done' : ''}" data-prep="${c.id}">
            <label class="prep-step-main">
              <span class="prep-step-num" aria-hidden="true">${i + 1}</span>
              <input type="checkbox" ${done(c.id) ? 'checked' : ''} aria-label="${esc(c.t)}">
              <span class="prep-step-txt">${esc(c.t)}</span>
              <span class="prep-step-check" aria-hidden="true">✓</span>
            </label>
            ${c.img ? `<figure class="prep-step-fig"><img src="assets/prep/${esc(c.img)}" alt="Referencia: ${esc(c.t)}" loading="lazy" onerror="this.closest('.prep-step-fig').remove()"><figcaption>Referencia · paso ${i + 1}</figcaption></figure>` : ''}
          </li>`).join('')}</ol>
      </div>

      ${p.kit ? `
      <h2 class="section-title">${esc(p.kit.titulo)}</h2>
      <img class="kit-img" src="assets/prep/kit-mantenimiento.png" alt="Kit de mantenimiento C4V Laser" loading="lazy" onerror="this.remove()">
      <div class="card">
        <p style="margin:0 0 12px">${esc(p.kit.nota)}</p>
        <div class="kit-grid">${p.kit.items.map(k => `<div class="kit-item">
            ${k.img ? `<img src="assets/prep/${esc(k.img)}" alt="" loading="lazy" onerror="this.remove()">` : ''}
            <strong>${esc(k.t)}</strong><span>${esc(k.d)}</span>
          </div>`).join('')}</div>
      </div>` : ''}

      <h2 class="section-title">Guías paso a paso</h2>
      <div class="grid cols-2">
        ${p.guias.map(g => `<div class="card guia"><div class="guia-thumb">${diag(g.key)}</div><h3>${esc(g.titulo)}</h3><ul class="ulist">${g.pasos.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('')}
      </div>

      <div class="card" style="margin-top:20px"><h3>Según tu modelo</h3><p>${esc(p.modelos)}</p></div>`;
  },

  soporte() {
    const d = state.db, cli = currentClient(), sop = d.soporte;
    // Nº de serie de la máquina del cliente → da contexto al agente de soporte.
    const maq = cli ? d.maquinas.find(x => x.cliente_id === cli.id) : null;
    const wa = (svg) => `<svg class="wa-ic" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.5 14.4c-.3-.2-1.7-.9-2-1-.3-.1-.5-.1-.6.2-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1-.3-.2-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.5-.5c.1-.2.2-.3.3-.5v-.5c-.1-.2-.6-1.6-.9-2.2-.2-.5-.4-.4-.6-.5h-.5c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1.1 2.8 1.2 3c.2.2 2.1 3.2 5.1 4.4 1.9.8 2.6.9 3.5.7.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3z"/><path d="M12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.4 1.3 4.9L2 22l5.3-1.4c1.4.8 3 1.2 4.7 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3.1.8.8-3-.2-.3c-.9-1.4-1.3-3-1.3-4.6C3.5 7.3 7.3 3.5 12 3.5S20.5 7.3 20.5 12 16.7 20.2 12 20.2z"/></svg>`;
    // Deep link de WhatsApp con mensaje pre-redactado (identifica al cliente y su máquina).
    const contexto = [cli ? `Soy ${cli.nombre}` : null, maq ? `máquina ${maq.serie}` : null].filter(Boolean).join(', ');
    const waSoporte = (motivo) => waLink(`Hola equipo C4V${contexto ? `. ${contexto}` : ''}. ${motivo}`);

    /* INTEGRACIÓN ODOO HELPDESK (pendiente de backend):
       Hoy el soporte se canaliza 100% por WhatsApp (deep links de abajo). Cuando el
       backend esté hosteado (ver INTEGRACION_ODOO.md), aquí entraría la creación de
       ticket en Odoo Helpdesk: POST {apiBase}/api/tickets → helpdesk.ticket con
       { cliente_id, serie, asunto, descripcion, canal:'portal' }. Existe ya
       actions.crearTicket() (usa /api/tickets en modo online); faltaría el endpoint
       en server.js mapeando a helpdesk.ticket y decidir si se abre ticket además de
       (o en vez de) WhatsApp. Mientras tanto NO se finge: solo WhatsApp real. */
    return `
      <!-- Lo primero y más grande: hablar con una persona por WhatsApp, con contexto -->
      <a class="wa-big" href="${waSoporte('Necesito ayuda con mi máquina.')}" target="_blank" rel="noopener">
        ${wa()}
        <div class="wa-txt"><strong>Escríbenos por WhatsApp</strong><span>${esc(sop.whatsapp)} · ${esc(sop.horario)}</span></div>
      </a>
      ${maq ? `<p class="wa-ctx muted">Tu mensaje ya llevará tu Nº de serie (<strong>${esc(maq.serie)}</strong>) para atenderte más rápido.</p>` : ''}

      <h2 class="section-title">O mira si es algo común</h2>
      <div id="guiaList">
        ${d.soporte_guia.map(g => `<div class="faq-item guia"><button type="button" class="faq-q" aria-expanded="false"><span>${esc(g.titulo)}</span><span class="chev">＋</span></button>
          <div class="faq-a"><p style="margin:0 0 6px"><strong>Síntoma:</strong> ${esc(g.sintoma)}</p>
          <p style="margin:0 0 6px"><strong>Posibles causas:</strong> ${esc(g.causas)}</p>
          <p style="margin:0 0 12px"><strong>Qué hacer:</strong> ${esc(g.accion)}</p>
          <a class="wa-inline" href="${waSoporte(`Sigo con este problema: «${g.titulo}».`)}" target="_blank" rel="noopener">${wa()}<span>Sigo con este problema — escribir por WhatsApp</span></a></div></div>`).join('')}
      </div>

      ${(cli ? d.tickets.filter(t => t.cliente_id === cli.id) : []).length ? `
        <h2 class="section-title">Tus casos</h2>
        <div class="list" id="ticketList">${ticketRows(d.tickets.filter(t => t.cliente_id === cli.id), false)}</div>` : ''}`;
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
      <div class="list" id="leadList">${leadRows(state.db.leads)}</div>
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
          <span class="badge warn">Disponible próximamente</span>
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
      const meta = ok && cert.fecha
        ? `<p class="cert-maq-meta">Certificada el ${esc(cert.fecha)}${cert.tecnico ? ` · por ${esc(cert.tecnico)}` : ''}</p>`
        : (ok ? '' : '<p class="cert-maq-meta">La estamos probando y calibrando antes de entregártela.</p>');
      const publico = cert.url
        ? `<a class="cert-verif-link" href="${esc(cert.url)}" target="_blank" rel="noopener">Ver certificado público ↗</a>`
        : '';
      return `<div class="card cert-maq">
        <div class="cert-maq-top">
          <h3>Láser ${esc(m.modelo)}</h3>
          ${ok ? '<span class="badge ok">Certificada ✓</span>' : '<span class="badge warn">En revisión y calibración</span>'}
        </div>
        <div class="cert-serie">
          <span class="cert-serie-lbl">Nº de serie (tu llave de verificación)</span>
          <div class="cert-serie-row">
            <code class="cert-serie-num">${esc(m.serie)}</code>
            <button type="button" class="cert-copy btn ghost sm" data-copy="${esc(m.serie)}" aria-label="Copiar Nº de serie">Copiar</button>
          </div>
        </div>
        ${meta}
        ${publico || (ok ? '<p class="cert-verif-note muted">Verifica tu máquina con este Nº de serie ante nuestro equipo por WhatsApp cuando lo necesites.</p>' : '')}
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
      ${ci.faq.map(f => `<div class="faq-item"><button type="button" class="faq-q" aria-expanded="false"><span>${esc(f.q)}</span><span class="chev">＋</span></button><div class="faq-a">${esc(f.a)}</div></div>`).join('')}`;
  }
};

function ticketRows(tickets, isStaff) {
  if (!tickets.length) return '<div class="empty">Aún no tienes tickets.</div>';
  const badge = (e) => { const m = { nuevo: 'info', asignado: 'info', en_proceso: 'warn', resuelto: 'ok', cerrado: 'grey' }; return `<span class="badge ${m[e] || 'grey'}">${ESTADO_TICKET[e] || e}</span>`; };
  return tickets.map(t => `<div class="row-card">
    <div class="grow"><h4>${esc(t.asunto)} ${badge(t.estado)}</h4>
      <div class="meta"><span class="badge ${t.tipo === 'soporte' ? 'red' : 'info'}">${t.tipo}</span><span>${esc(t.id)}</span><span class="pill-pais">${t.pais}</span><span>Atiende: ${esc(t.asignado_a)}</span></div></div>
    ${isStaff ? `<select class="mini-select" data-ticket="${esc(t.id)}">${['nuevo', 'asignado', 'en_proceso', 'resuelto', 'cerrado'].map(e => `<option ${e === t.estado ? 'selected' : ''} value="${e}">${ESTADO_TICKET[e] || e}</option>`).join('')}</select>` : ''}</div>`).join('');
}
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
    if (!cli) { toast('Inicia sesión para tomar el trabajo'); return; }
    try { await actions.tomarLead(b.dataset.take, cli.id); toast(state.offline ? 'Trabajo tomado (demostración: el contacto es de ejemplo)' : '🎉 ¡Trabajo tomado! Contacta al cliente'); render('bolsa'); } catch { toast('⚠️ Ese trabajo ya fue tomado'); }
  });
}

// ---------- interacciones ----------
function bindAccordions(sel) { view.querySelectorAll(sel).forEach(it => { const q = it.querySelector('.faq-q, .course-head'); if (q) q.onclick = () => { const open = it.classList.toggle('open'); q.setAttribute('aria-expanded', open); }; }); }
function bind(route) {
  if (route === 'inicio') {
    // Secciones bloqueadas hasta completar la preparación
    view.querySelectorAll('[data-lock]').forEach(b => b.onclick = () => {
      toast('🔒 Se desbloquea al completar tu guía «Preparar mi espacio»');
      location.hash = '#/preparacion';
    });
  }
  if (route === 'academia') { bindAccordions('.faq-item'); bindAccordions('.course'); bindVideos(); bindQuizzes(); }
  if (route === 'preparacion') {
    view.querySelectorAll('#prepList input[type="checkbox"]').forEach(chk => chk.onchange = () => {
      const step = chk.closest('.prep-step'); const id = step.dataset.prep;
      try { chk.checked ? localStorage.setItem('c4v_prep_' + state.ctx + '_' + id, '1') : localStorage.removeItem('c4v_prep_' + state.ctx + '_' + id); } catch {}
      step.classList.toggle('done', chk.checked);
      const ins = view.querySelectorAll('#prepList input[type="checkbox"]'), n = [...ins].filter(i => i.checked).length;
      $('#prepCount').textContent = n + '/' + ins.length;
      $('#prepBar').style.width = Math.round(n / ins.length * 100) + '%';
      // 🎉 Al completar todo, se desbloquea el portal
      if (n === ins.length && ins.length) {
        toast('🎉 ¡Espacio listo! Se desbloqueó tu Academia');
        render('preparacion'); window.scrollTo(0, 0);
      }
    });
    const pb = $('#printPrep'); if (pb) pb.onclick = () => window.print();
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
    const apply = () => { $('#leadList').innerHTML = leadRows(filtro === 'todos' ? state.db.leads : state.db.leads.filter(l => l.pais === filtro)); bindTake(); };
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
        try { await actions.crearLead(Object.fromEntries(new FormData(e.target))); toast(state.offline ? 'Solicitud guardada en esta demostración' : '✅ Solicitud publicada'); render('bolsa'); } catch { toast('⚠️ Error'); } };
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
        <div class="qz-opts">${p.opciones.map((o, i) => `<button type="button" class="qz-opt" data-i="${i}">${esc(o)}</button>`).join('')}</div>
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
const TITLES = { inicio: 'Inicio', academia: 'Aprender a usar mi máquina', preparacion: 'Preparar mi espacio', soporte: 'Necesito ayuda', bolsa: 'Quiero más clientes', plantillas: 'Banco de Diseños', certificado: 'Tu Certificado de Calidad' };
function render(route) {
  if (!views[route]) route = 'inicio';
  // Candado OBLIGATORIO: hasta completar la introducción/preparación, solo rutas libres.
  // Todo lo demás (academia, bolsa, plantillas, y cualquier sección nueva) va a la guía.
  if (!RUTAS_LIBRES.includes(route) && !prepEstado().completo) {
    toast('🔒 Primero completa tu guía «Primeros Pasos: prepara tu espacio»');
    route = 'preparacion';
    if (location.hash !== '#/preparacion') { location.hash = '#/preparacion'; return; }
  }
  // Sin menú: en cualquier pantalla que no sea el inicio, un solo camino de vuelta.
  const volver = route === 'inicio' ? ''
    : `<a class="volver" href="#/inicio"><span aria-hidden="true">←</span> Volver al inicio</a>
       <h1 class="pag-title">${esc(TITLES[route])}</h1>`;
  view.innerHTML = volver + views[route]();
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

/* Devuelve { estado:'ok', cliente } · { estado:'no_encontrado' } · { estado:'error' }.
   - modoDemo → valida contra data.js (comportamiento actual).
   - producción → llama al endpoint; existe:false = no_encontrado; red/503 = error. */
async function verificarCliente({ pais, doc }) {
  if (modoDemo()) {
    const cli = buscarClientePorDocumento(doc);
    return cli ? { estado: 'ok', cliente: cli } : { estado: 'no_encontrado' };
  }
  // NOTA PII: el documento viaja en la query del GET. Es un backend propio y
  // así lo define INTEGRACION_ODOO.md §6; la decisión sobre OTP/rate-limiting
  // (§9 SEGURIDAD) es de producto y se toma antes de activar producción.
  const base = VERIF.apiBase || '';
  const ep = VERIF.endpoint || '/api/cliente';
  const url = `${base}${ep}?pais=${encodeURIComponent(pais || '')}&doc=${encodeURIComponent(doc)}`;
  let r;
  try { r = await fetch(url); } catch { return { estado: 'error' }; }
  if (!r.ok) return { estado: 'error' };          // 400/503/… → no distinguir para el usuario
  let j;
  try { j = await r.json(); } catch { return { estado: 'error' }; }
  if (!j || !j.existe) return { estado: 'no_encontrado' };
  return { estado: 'ok', cliente: inyectarCliente(j.cliente, j.maquinas) };
}

function guardarSesion(doc, pais) {
  try { localStorage.setItem('c4v_sesion', JSON.stringify({ doc, pais: pais || null, exp: Date.now() + SESION_DIAS * 864e5 })); } catch {}
}
function leerSesion() {
  try {
    const s = JSON.parse(localStorage.getItem('c4v_sesion') || 'null');
    if (s && s.exp > Date.now()) return s;   // { doc, pais }
    localStorage.removeItem('c4v_sesion');
  } catch {}
  return null;
}
const waLink = (texto) => `https://wa.me/${CFG.whatsapp?.numero || ''}?text=${encodeURIComponent(texto || '')}`;
const docInfo = (paisCode, tipo) => {
  const p = (CFG.paises || []).find(x => x.code === paisCode) || (CFG.paises || [])[0];
  return (p && p[tipo]) || { doc: 'Documento', ej: '' };
};

function entrar(cliente) {
  state.ctx = cliente.id;
  $('#gate').hidden = true; $('#app').hidden = false;
  const info = docInfo(cliente.pais, cliente.tipo || 'persona');
  $('#me').innerHTML = `<strong>${esc(cliente.nombre)}</strong>${esc(info.doc)} ${esc(cliente.documento)}`;
  // Mientras la preparación NO esté completa, SIEMPRE se entra por ahí.
  // La idea: que quede clarísimo qué debe tener comprado y listo antes de instalar.
  let primeraVez = false;
  try {
    if (!localStorage.getItem('c4v_hola_' + cliente.id)) { localStorage.setItem('c4v_hola_' + cliente.id, '1'); primeraVez = true; }
  } catch {}
  const pe = prepEstado();
  if (!pe.completo) {
    // Cliente nuevo (o preparación a medias): SIEMPRE aterriza en la guía de Primeros Pasos,
    // sin importar el enlace/hash con el que haya entrado. No hay forma de saltarse la introducción.
    if (location.hash !== '#/preparacion') location.hash = '#/preparacion';
    setTimeout(() => toast(primeraVez
      ? '👋 ¡Bienvenido! Empieza aquí: deja tu espacio listo antes de continuar'
      : `📋 Sigues en ${pe.n} de ${pe.total} — completa tu preparación para desbloquear tu portal`), 500);
    render('preparacion');
    return;
  }
  render(currentRoute());
}

function initGate() {
  const gate = $('#gate'), form = $('#gateForm'), inp = $('#gateDoc'), err = $('#gateError');
  const tiposBox = $('#gateTipos'), paisesBox = $('#gatePaises'), docLabel = $('#gateDocLabel');
  const paises = CFG.paises || [];
  let tipo = 'persona', pais = paises[0]?.code || 'PE';

  // Paso 1 · Persona o Empresa (2 botones grandes)
  tiposBox.innerHTML = `
    <button type="button" role="radio" aria-checked="true" data-tipo="persona"><span class="bandera" aria-hidden="true">👤</span>Persona</button>
    <button type="button" role="radio" aria-checked="false" data-tipo="empresa"><span class="bandera" aria-hidden="true">🏢</span>Empresa</button>`;

  // Paso 2 · País (5 banderas)
  paisesBox.innerHTML = paises.map(p =>
    `<button type="button" role="radio" aria-checked="${p.code === pais}" data-pais="${p.code}">
       <span class="bandera" aria-hidden="true">${p.bandera}</span>${esc(p.nombre)}
     </button>`).join('');

  // Paso 3 · La etiqueta del documento cambia según tipo + país
  const actualizar = (enfocar) => {
    const info = docInfo(pais, tipo);
    docLabel.textContent = info.doc;
    inp.placeholder = info.ej;
    tiposBox.querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', b.dataset.tipo === tipo));
    paisesBox.querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', b.dataset.pais === pais));
    if (enfocar) inp.focus();
  };
  tiposBox.querySelectorAll('button').forEach(b => b.onclick = () => { tipo = b.dataset.tipo; actualizar(false); });
  paisesBox.querySelectorAll('button').forEach(b => b.onclick = () => { pais = b.dataset.pais; actualizar(true); });
  actualizar(false);
  $('#gateWa').href = waLink('Hola, quiero acceder a mi Central de Postventa C4V pero mi documento no está registrado.');

  // Documentos de ejemplo (solo demo — para poder entrar y probar)
  if (CFG.mostrarNumerosDemo) {
    const box = $('#gateDemo'); box.hidden = false;
    box.innerHTML = '<h2>Documentos de ejemplo (demostración)</h2>' + state.db.clientes.map(c => {
      const info = docInfo(c.pais, c.tipo || 'persona');
      return `<button type="button" data-doc="${esc(c.documento)}">${esc(info.doc)} ${esc(c.documento)}<span>${esc(c.nombre)} · ${c.tipo === 'empresa' ? '🏢 Empresa' : '👤 Persona'} · ${PAISES[c.pais] || c.pais}</span></button>`;
    }).join('');
    box.querySelectorAll('button').forEach(b => b.onclick = () => {
      const cli = buscarClientePorDocumento(normalizarDoc(b.dataset.doc));
      if (cli) { guardarSesion(normalizarDoc(cli.documento), cli.pais); entrar(cli); }
    });
  }

  const btn = form.querySelector('.gate-btn');
  const btnLabel = btn ? btn.textContent : '';
  const setCargando = (on) => {
    if (!btn) return;
    btn.disabled = on;
    btn.textContent = on ? 'Verificando…' : btnLabel;
    btn.setAttribute('aria-busy', on ? 'true' : 'false');
  };

  form.onsubmit = async (e) => {
    e.preventDefault(); err.hidden = true;
    const doc = normalizarDoc(inp.value);
    const info = docInfo(pais, tipo);
    if (doc.length < 5) {
      err.hidden = false; err.innerHTML = `Parece que falta parte de tu ${esc(info.doc)}. Escríbelo completo, como en el ejemplo.`; inp.focus(); return;
    }
    setCargando(true);
    let res;
    try { res = await verificarCliente({ pais, doc }); }
    catch { res = { estado: 'error' }; }
    setCargando(false);

    if (res.estado === 'ok') { guardarSesion(doc, pais); entrar(res.cliente); return; }

    err.hidden = false;
    if (res.estado === 'error') {
      // Falla de red / backend (503): no es culpa del documento.
      err.innerHTML = `No pudimos verificar tu documento en este momento. Revisa tu conexión e inténtalo de nuevo, o <a href="${waLink('Hola, no puedo entrar a mi Central de Postventa C4V (error al verificar). ¿Me ayudan?')}" target="_blank" rel="noopener">escríbenos por WhatsApp</a>.`;
    } else {
      err.innerHTML = `No encontramos tu ${esc(info.doc)} <strong>${esc(inp.value.trim())}</strong> entre nuestros clientes. Revísalo o <a href="${waLink('Hola, mi documento no aparece en la Central de Postventa C4V. ¿Me ayudan?')}" target="_blank" rel="noopener">escríbenos por WhatsApp</a> y te ayudamos.`;
    }
    err.focus?.();
  };

  gate.hidden = false; $('#app').hidden = true;
}

// ---------- agente de IA (ElevenLabs · A4) ----------
function initAgente() {
  const btn = $('#aiBtn'), panel = $('#aiPanel'), ag = CFG.agente || {};
  $('#aiName').textContent = ag.nombre || 'CeVi';
  const mic = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0"/><path d="M12 18v3"/></svg>';

  const waIcon = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.5 14.4c-.3-.2-1.7-.9-2-1-.3-.1-.5-.1-.6.2-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1-.3-.2-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.5-.5c.1-.2.2-.3.3-.5v-.5c-.1-.2-.6-1.6-.9-2.2-.2-.5-.4-.4-.6-.5h-.5c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1.1 2.8 1.2 3c.2.2 2.1 3.2 5.1 4.4 1.9.8 2.6.9 3.5.7.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3z"/><path d="M12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.4 1.3 4.9L2 22l5.3-1.4c1.4.8 3 1.2 4.7 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3.1.8.8-3-.2-.3c-.9-1.4-1.3-3-1.3-4.6C3.5 7.3 7.3 3.5 12 3.5S20.5 7.3 20.5 12 16.7 20.2 12 20.2z"/></svg>';
  const contenido = () => CFG.elevenlabsAgentId
    ? `<elevenlabs-convai agent-id="${esc(CFG.elevenlabsAgentId)}"></elevenlabs-convai>`
    : `<span class="ai-soon">Aún no disponible</span>
       <h3>${esc(ag.nombre || 'CeVi')} está en camino</h3>
       <p>Nuestro asistente por voz todavía no está activo. Pero no te quedas sin ayuda: escríbenos por WhatsApp y <strong>te responde una persona del equipo C4V</strong> — en español, los 365 días.</p>
       <a class="btn-wa" href="${waLink('Hola, necesito ayuda con mi máquina C4V.')}" target="_blank" rel="noopener">${waIcon}<span>Escribir por WhatsApp</span></a>`;

  btn.onclick = () => {
    const abrir = panel.hidden;
    panel.hidden = !abrir; btn.setAttribute('aria-expanded', abrir);
    if (!abrir) return;
    panel.innerHTML = `<div class="ai-inner"><div class="ai-avatar">${mic}</div><div>${contenido()}</div>
      <button class="ai-close" id="aiClose" aria-label="Cerrar">×</button></div>`;
    $('#aiClose').onclick = () => { panel.hidden = true; btn.setAttribute('aria-expanded', false); };
    // El widget de voz solo se carga si hay un agente configurado (nunca fingir que funciona).
    if (CFG.elevenlabsAgentId && !document.getElementById('el-convai')) {
      const s = document.createElement('script');
      s.id = 'el-convai'; s.src = 'https://unpkg.com/@elevenlabs/convai-widget-embed'; s.async = true;
      document.body.appendChild(s);
    }
  };
}

// ---------- init ----------
async function init() {
  state.db = await loadDB();
  $('#logoutBtn').onclick = () => { try { localStorage.removeItem('c4v_sesion'); } catch {} location.reload(); };
  initAgente();
  initGate();

  // Sesión recordada: entra directo, sin volver a pedir el documento.
  // En producción se re-verifica contra el endpoint (con el país guardado);
  // si falla, se queda en el gate sin ruido. En demo valida contra data.js.
  const ses = leerSesion();
  if (ses && ses.doc) {
    try {
      const res = await verificarCliente({ pais: ses.pais, doc: ses.doc });
      if (res.estado === 'ok') entrar(res.cliente);
    } catch {}
  }
}
init();
