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
const PAISES = { PE: '🇵🇪 Perú', EC: '🇪🇨 Ecuador', BO: '🇧🇴 Bolivia' };
const ESTADO_TICKET = { nuevo: 'Recibido', asignado: 'Asignado', en_proceso: 'En atención', resuelto: 'Resuelto', cerrado: 'Cerrado' };

function toast(msg) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2600);
}
async function apiGet(url) { const r = await fetch(url); if (!r.ok) throw new Error('http'); return r.json(); }
function currentClient() { return state.db.clientes.find(c => c.id === state.ctx) || null; }

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
  inicio() {
    const d = state.db, cli = currentClient(), sop = d.soporte, bv = d.bienvenida;
    const maq = cli ? d.maquinas.find(m => m.cliente_id === cli.id) : d.maquinas[0];
    const cert = maq?.certificado?.estado;
    const certLine = cert === 'certificada'
      ? '<span class="badge ok">Certificada ✓</span> <span class="muted">Tu máquina está lista, con su Certificado de Calidad C4V.</span>'
      : '<span class="badge warn">En revisión y calibración</span> <span class="muted">La estamos probando y calibrando con piezas originales — te avisaremos cuando esté lista.</span>';
    const done = (id) => { try { return localStorage.getItem('c4v_onb_' + state.ctx + '_' + id) === '1'; } catch { return false; } };
    const hechos = d.onboarding.filter(o => done(o.id)).length, total = d.onboarding.length;
    const card = (href, ic, t, desc) => `<a class="action-card" href="${href}"><div class="ac-ico">${icon(ic)}</div><div><h3>${t}</h3><p>${desc}</p></div><div class="ac-arrow">→</div></a>`;
    return `
      <div class="hero">
        <h1>${cli ? `Hola, ${esc(cli.nombre.split(' ')[0])}. ` : ''}Gracias por ser parte de <em>C4V</em>.</h1>
        <p>${esc(bv.mensaje)}</p>
        <div class="hero-cta">
          <a class="btn primary" href="#/academia">Empezar mi capacitación</a>
          <a class="btn ghost" href="${esc(sop.wa_link)}" target="_blank" rel="noopener">Escríbenos por WhatsApp</a>
        </div>
      </div>

      ${maq ? `<h2 class="section-title">Tu máquina y tu certificado</h2>
      <div class="card mini">
        <div class="seal-sm">${SEAL}</div>
        <div style="flex:1;min-width:220px">
          <h3>Láser ${esc(maq.modelo)}</h3>
          <p class="muted" style="margin:2px 0">Código de máquina: <strong>${esc(maq.serie)}</strong> · ${esc(maq.area)} · ${PAISES[maq.pais] || maq.pais}</p>
          <p style="margin:10px 0 0">${certLine}</p>
          <a class="btn ghost sm" href="#/certificado" style="margin-top:12px">Ver mi certificado</a>
        </div></div>` : ''}

      <h2 class="section-title">Tus primeros pasos <span id="onbCount" style="text-transform:none;letter-spacing:0;color:var(--muted);font-weight:600">${hechos}/${total}</span></h2>
      <div class="card">
        <div class="bar" style="margin:0 0 16px"><i id="onbBar" style="width:${total ? Math.round(hechos / total * 100) : 0}%"></i></div>
        <div id="onbList">${d.onboarding.map(o => `<div class="onb-item" data-onb="${o.id}">
          <input type="checkbox" ${done(o.id) ? 'checked' : ''} aria-label="${esc(o.titulo)}">
          <div class="onb-body"><strong>${esc(o.titulo)}</strong><span>${esc(o.detalle)}</span></div>
          <a href="${o.href}" class="onb-go">Ir →</a></div>`).join('')}</div>
      </div>

      <h2 class="section-title">¿En qué te ayudamos hoy?</h2>
      <div class="actions">
        ${card('#/academia', 'academia', 'Academia', 'Cursos paso a paso, cómo preparar tu espacio y preguntas frecuentes.')}
        ${card('#/soporte', 'soporte', 'Soporte', '¿Algo no funciona? Te guiamos y, si hace falta, un técnico te atiende.')}
        ${card('#/bolsa', 'bolsa', 'Bolsa de Trabajos', 'Te pasamos clientes de corte. Gratis, por ser parte de C4V.')}
        ${card('#/plantillas', 'disenos', 'Banco de Diseños', 'Diseños listos para cortar y empezar a producir.')}
      </div>
      <h2 class="section-title">¿Necesitas ayuda ahora?</h2>
      <div class="help-card">${icon('help')}
        <div class="grow"><h3>Estamos para ayudarte</h3>
          <p>Escríbenos por WhatsApp ${esc(sop.whatsapp)} — soporte en español los 365 días. O abre un ticket en Soporte y te atiende el equipo de tu país.</p></div>
        <a class="btn primary sm" href="${esc(sop.wa_link)}" target="_blank" rel="noopener">WhatsApp</a></div>`;
  },

  academia() {
    const a = state.db.academia, faqs = state.db.faqs, m = state.db.modelos;
    const cursoCard = (c, i) => {
      const estado = c.estado === 'disponible' ? '<span class="badge ok">Disponible</span>' : c.estado === 'en_proceso' ? '<span class="badge warn">En construcción</span>' : '<span class="badge grey">Próximamente</span>';
      const nLes = c.modulos.reduce((s, m) => s + m.lecciones.length, 0);
      return `<div class="course"><button type="button" class="course-head" aria-expanded="false">
          <div class="course-ico">${i + 1}</div>
          <div style="flex:1"><h3>${esc(c.titulo)} ${estado}</h3>
            <div class="sub">${esc(c.nivel)} · ${c.modulos.length} módulos · ${nLes} lecciones — ${esc(c.descripcion)}</div></div>
          <span class="chev">＋</span></button>
        <div class="course-body">
          ${c.modulos.map((m, i) => `<div class="module">
            <h4><span class="num-mod">${i + 1}</span> ${esc(m.titulo)} ${m.quizzes ? `<span class="badge red" style="margin-left:auto">${m.quizzes} preguntas</span>` : ''}</h4>
            ${m.lecciones.length ? `<ul class="lessons">${m.lecciones.map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
          </div>`).join('')}
        </div></div>`;
    };
    const faqCats = [...new Set(faqs.map(f => f.categoria))];
    return `
      <div class="page-head"><h1>Academia</h1>
        <p>${esc(a.acceso)}</p></div>
      <p style="margin:0 0 16px"><a class="btn ghost sm" href="https://c4vschool.com" target="_blank" rel="noopener">Ir a C4V School ↗</a></p>
      <div class="chips-row">${a.ruta.map((r, i) => `<span class="chip">${i + 1}. ${esc(r)}</span>`).join('')}</div>

      <h2 class="section-title">Cursos por módulos</h2>
      ${a.cursos.map(cursoCard).join('')}

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
    return `
      <div class="page-head" style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap">
        <div><h1>Prepara tu espacio</h1><p style="margin:6px 0 0;max-width:64ch">${esc(p.intro)}</p></div>
        <button class="btn ghost sm" id="printPrep">🖨 Imprimir</button>
      </div>

      <h2 class="section-title">Checklist <span id="prepCount" style="text-transform:none;letter-spacing:0;color:var(--muted);font-weight:600">${hechos}/${total}</span></h2>
      <div class="card">
        <div class="bar" style="margin:0 0 16px"><i id="prepBar" style="width:${total ? Math.round(hechos / total * 100) : 0}%"></i></div>
        <div id="prepList">${p.checklist.map(c => `<div class="onb-item" data-prep="${c.id}"><input type="checkbox" ${done(c.id) ? 'checked' : ''} aria-label="${esc(c.t)}"><div class="onb-body"><strong>${esc(c.t)}</strong></div></div>`).join('')}</div>
      </div>

      <h2 class="section-title">Guías paso a paso</h2>
      <div class="grid cols-2">
        ${p.guias.map(g => `<div class="card guia"><div class="guia-thumb">${diag(g.key)}</div><h3>${esc(g.titulo)}</h3><ul class="ulist">${g.pasos.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('')}
      </div>

      <h2 class="section-title">Lista de compras</h2>
      <table><thead><tr><th>Ítem</th><th>Para qué</th><th>Especificación</th></tr></thead>
      <tbody>${p.compras.map(c => `<tr><td><strong>${esc(c.item)}</strong></td><td>${esc(c.para)}</td><td>${esc(c.spec)}</td></tr>`).join('')}</tbody></table>

      <div class="card" style="margin-top:20px"><h3>Según tu modelo</h3><p>${esc(p.modelos)}</p></div>`;
  },

  soporte() {
    const d = state.db, cli = currentClient(), sop = d.soporte;
    const maqs = cli ? d.maquinas.filter(m => m.cliente_id === cli.id) : d.maquinas;
    const maqOpts = maqs.map(m => `<option value="${esc(m.serie)}" data-pais="${m.pais}">${esc(m.modelo)} · ${esc(m.serie)}</option>`).join('');
    return `
      <div class="page-head"><h1>Soporte</h1>
        <p>Estamos para ayudarte. Prueba primero la guía rápida; si no se resuelve, abre un ticket y llega directo al equipo de tu país.</p></div>

      <div class="help-card" style="margin-bottom:24px">${icon('help')}
        <div class="grow"><h3>¿Es urgente? Escríbenos ahora</h3>
          <p>WhatsApp <strong>${esc(sop.whatsapp)}</strong> · ${esc(sop.horario)}. Te respondemos en español y te acompañamos hasta resolverlo.</p></div>
        <a class="btn primary sm" href="${esc(sop.wa_link)}" target="_blank" rel="noopener">WhatsApp</a>
      </div>

      <h2 class="section-title">Guía rápida: problemas comunes</h2>
      <div id="guiaList">
        ${d.soporte_guia.map(g => `<div class="faq-item guia"><button type="button" class="faq-q" aria-expanded="false"><span>${esc(g.titulo)}</span><span class="chev">＋</span></button>
          <div class="faq-a"><p style="margin:0 0 6px"><strong>Síntoma:</strong> ${esc(g.sintoma)}</p>
          <p style="margin:0 0 6px"><strong>Posibles causas:</strong> ${esc(g.causas)}</p>
          <p style="margin:0"><strong>Qué hacer:</strong> ${esc(g.accion)}</p></div></div>`).join('')}
      </div>

      <div class="grid cols-2" style="margin-top:24px">
        <div class="card"><h3>Abrir un ticket</h3>
          <form class="form" id="ticketForm" style="margin-top:12px">
            <div class="field"><label>¿Qué necesitas?</label>
              <select name="tipo"><option value="soporte">🛠️ Ayuda técnica</option><option value="comercial">💬 Comercial (cotizar, repuestos)</option></select></div>
            <div class="field"><label>Tu máquina</label><select name="serie" id="serieSel">${maqOpts || '<option value="">— sin máquina —</option>'}</select></div>
            <div class="field"><label>Asunto</label><input name="asunto" placeholder="Ej: el corte no atraviesa el material" required></div>
            <div class="field"><label>Cuéntanos qué pasa</label><textarea name="descripcion" placeholder="Describe el problema…"></textarea></div>
            <div class="field"><label>Prioridad</label><select name="prioridad"><option value="media">Normal</option><option value="alta">Urgente</option><option value="baja">Baja</option></select></div>
            <button class="btn primary" type="submit">Enviar ticket</button></form></div>
        <div><h3 class="section-title" style="margin-top:0">Tus tickets</h3><div class="list" id="ticketList">${ticketRows(cli ? d.tickets.filter(t => t.cliente_id === cli.id) : d.tickets, !cli)}</div></div>
      </div>`;
  },

  bolsa() {
    return `
      <div class="page-head"><h1>Bolsa de Trabajos</h1>
        <p><strong>Beneficio gratis, solo para clientes C4V.</strong> Cada día nos escriben personas pidiendo servicio de corte láser. Nosotros no damos ese servicio — fabricamos las máquinas — así que sus pedidos se publican aquí <strong>para ti</strong>: tómalos, contáctalos y produce. El contacto se revela al tomar el trabajo.</p></div>
      <div class="toolbar"><div class="filters">
          <button class="chip active" data-filter="todos">Todos</button>
          <button class="chip" data-filter="PE">🇵🇪 Perú</button>
          <button class="chip" data-filter="EC">🇪🇨 Ecuador</button>
          <button class="chip" data-filter="BO">🇧🇴 Bolivia</button></div>
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
      <div class="page-head"><h1>Banco de Diseños C4V</h1><p>${esc(pl.intro)}</p></div>
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
    const maq = cli ? state.db.maquinas.find(x => x.cliente_id === cli.id) : state.db.maquinas[0];
    return `
      <div class="cert-hero">
        <div class="cert-seal">${SEAL}</div>
        <div><h1>${esc(ci.nombre)}</h1>
          <p class="cert-lema">«${esc(ci.lema)}»</p>
          <p class="muted" style="max-width:52ch">${esc(ci.frase_ancla)}</p></div>
      </div>

      ${maq ? `<h2 class="section-title">Tu máquina</h2>
      <div class="card mini"><div style="flex:1;min-width:220px">
        <h3>Láser ${esc(maq.modelo)}</h3>
        <p class="muted">Código de máquina: <strong>${esc(maq.serie)}</strong></p>
        <p style="margin:8px 0 0">${maq.certificado?.estado === 'certificada' ? '<span class="badge ok">Certificada ✓</span>' : '<span class="badge warn">En revisión y calibración</span>'}</p>
      </div></div>` : ''}

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

// ---------- interacciones ----------
function bindAccordions(sel) { view.querySelectorAll(sel).forEach(it => { const q = it.querySelector('.faq-q, .course-head'); if (q) q.onclick = () => { const open = it.classList.toggle('open'); q.setAttribute('aria-expanded', open); }; }); }
function bind(route) {
  if (route === 'inicio') {
    view.querySelectorAll('.onb-item input').forEach(chk => chk.onchange = () => {
      const id = chk.closest('.onb-item').dataset.onb;
      try { chk.checked ? localStorage.setItem('c4v_onb_' + state.ctx + '_' + id, '1') : localStorage.removeItem('c4v_onb_' + state.ctx + '_' + id); } catch {}
      const ins = view.querySelectorAll('.onb-item input'), n = [...ins].filter(i => i.checked).length;
      $('#onbCount').textContent = n + '/' + ins.length;
      $('#onbBar').style.width = Math.round(n / ins.length * 100) + '%';
    });
  }
  if (route === 'academia') { bindAccordions('.faq-item'); bindAccordions('.course'); }
  if (route === 'preparacion') {
    view.querySelectorAll('.onb-item input').forEach(chk => chk.onchange = () => {
      const id = chk.closest('.onb-item').dataset.prep;
      try { chk.checked ? localStorage.setItem('c4v_prep_' + state.ctx + '_' + id, '1') : localStorage.removeItem('c4v_prep_' + state.ctx + '_' + id); } catch {}
      const ins = view.querySelectorAll('.onb-item input'), n = [...ins].filter(i => i.checked).length;
      $('#prepCount').textContent = n + '/' + ins.length;
      $('#prepBar').style.width = Math.round(n / ins.length * 100) + '%';
    });
    const pb = $('#printPrep'); if (pb) pb.onclick = () => window.print();
  }
  if (route === 'certificado') bindAccordions('.faq-item');
  if (route === 'soporte') {
    bindAccordions('.faq-item');
    const serieSel = $('#serieSel');
    $('#ticketForm').onsubmit = async (e) => {
      e.preventDefault(); const f = e.target;
      const pais = serieSel?.selectedOptions[0]?.dataset.pais || currentClient()?.pais || 'PE';
      try { await actions.crearTicket({ tipo: f.tipo.value, prioridad: f.prioridad.value, serie: f.serie.value, asunto: f.asunto.value, descripcion: f.descripcion.value, pais, cliente_id: currentClient()?.id || null });
        toast(state.offline ? 'Guardado en esta demostración (aún no llega a un equipo real)' : '✅ Ticket enviado al equipo de ' + pais); render('soporte'); } catch { toast('⚠️ No se pudo enviar'); }
    };
    view.querySelectorAll('select[data-ticket]').forEach(sel => sel.onchange = async () => {
      try { await actions.estadoTicket(sel.dataset.ticket, sel.value); toast('Estado actualizado'); } catch { toast('⚠️ Error'); } });
  }
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
          <div class="form-row"><div class="field"><label>País</label><select name="pais"><option>PE</option><option>EC</option><option>BO</option></select></div><div class="field"><label>Ciudad</label><input name="ciudad"></div></div>
          <div class="form-row"><div class="field"><label>Nombre del cliente</label><input name="contacto" placeholder="Nombre" required></div><div class="field"><label>Teléfono o email</label><input name="telefono" placeholder="+51 …"></div></div>
          <button class="btn primary" type="submit">Publicar</button></form></div>`;
      $('#lf').onsubmit = async (e) => { e.preventDefault();
        try { await actions.crearLead(Object.fromEntries(new FormData(e.target))); toast(state.offline ? 'Solicitud guardada en esta demostración' : '✅ Solicitud publicada'); render('bolsa'); } catch { toast('⚠️ Error'); } };
    };
    bindTake();
  }
}
function bindTake() {
  view.querySelectorAll('[data-take]').forEach(b => b.onclick = async () => {
    const cli = currentClient();
    if (!cli) { toast('Cambia "Viendo como" a un cliente para tomar el trabajo'); return; }
    try { await actions.tomarLead(b.dataset.take, cli.id); toast(state.offline ? 'Trabajo tomado (demostración: el contacto es de ejemplo)' : '🎉 ¡Trabajo tomado! Contacta al cliente'); render('bolsa'); } catch { toast('⚠️ Ese trabajo ya fue tomado'); }
  });
}

// ---------- router ----------
const TITLES = { inicio: 'Inicio', academia: 'Academia', preparacion: 'Prepara tu espacio', soporte: 'Soporte', bolsa: 'Bolsa de Trabajos', plantillas: 'Banco de Diseños', certificado: 'Certificado de Calidad C4V' };
function render(route) {
  if (!views[route]) route = 'inicio';
  view.innerHTML = views[route]();
  $('#topbarTitle').textContent = TITLES[route];
  document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('active', a.dataset.route === route));
  $('#sidebar')?.classList.remove('open');
  bind(route); window.scrollTo(0, 0);
}
const currentRoute = () => (location.hash.replace('#/', '') || 'inicio');
window.addEventListener('hashchange', () => render(currentRoute()));
window.toast = toast;

// ---------- identidad: tu teléfono es tu llave (A5) ----------
/* Normalización E.164 según A5_IDENTIDAD_Y_PLANTILLAS.md §3:
   quitar espacios/-/()/. · quitar 0 inicial de larga distancia · anteponer código de país · guardar con "+" */
function normalizarTelefono(raw, prefijoPais) {
  let d = String(raw || '').replace(/[\s\-().]/g, '').replace(/\D/g, '');
  d = d.replace(/^0+/, '');                                  // Ecuador: 0987… → 987…
  if (prefijoPais && !d.startsWith(prefijoPais)) d = prefijoPais + d;
  return d ? '+' + d : '';
}
const paisDePrefijo = (p) => (CFG.paises || []).find(x => x.prefijo === p)?.code || 'PE';

function buscarClientePorTelefono(tel) {
  // v1 (demo): busca en los datos locales. v2: consulta a Odoo vía A6.
  return state.db.clientes.find(c => normalizarTelefono(c.telefono, '') === tel) || null;
}
function guardarSesion(tel) {
  try { localStorage.setItem('c4v_sesion', JSON.stringify({ tel, exp: Date.now() + SESION_DIAS * 864e5 })); } catch {}
}
function leerSesion() {
  try {
    const s = JSON.parse(localStorage.getItem('c4v_sesion') || 'null');
    if (s && s.exp > Date.now()) return s.tel;
    localStorage.removeItem('c4v_sesion');
  } catch {}
  return null;
}
const waLink = (texto) => `https://wa.me/${CFG.whatsapp?.numero || ''}?text=${encodeURIComponent(texto || '')}`;

function entrar(cliente, tel) {
  state.ctx = cliente.id; state.telefono = tel;
  $('#gate').hidden = true; $('#app').hidden = false;
  $('#me').innerHTML = `<strong>${esc(cliente.nombre)}</strong>${esc(tel)}`;
  render(currentRoute());
}

function initGate() {
  const gate = $('#gate'), form = $('#gateForm'), sel = $('#gateCountry'), inp = $('#gatePhone'), err = $('#gateError');
  const paises = CFG.paises || [];

  sel.innerHTML = paises.map(p => `<option value="${p.prefijo}">${p.bandera} +${p.prefijo}</option>`).join('');
  const setEjemplo = () => { inp.placeholder = paises.find(p => p.prefijo === sel.value)?.ejemplo || ''; };
  sel.onchange = setEjemplo; setEjemplo();
  $('#gateWa').href = waLink('Hola, quiero acceder a mi Central de Postventa C4V pero mi número no está registrado.');

  // Números de ejemplo (solo demo — para poder entrar y probar)
  if (CFG.mostrarNumerosDemo) {
    const box = $('#gateDemo'); box.hidden = false;
    box.innerHTML = '<h2>Números de ejemplo (demostración)</h2>' + state.db.clientes.map(c =>
      `<button type="button" data-tel="${esc(c.telefono)}">${esc(c.telefono)}<span>${esc(c.nombre)} · ${PAISES[c.pais] || c.pais}</span></button>`).join('');
    box.querySelectorAll('button').forEach(b => b.onclick = () => {
      const tel = normalizarTelefono(b.dataset.tel, '');
      const cli = buscarClientePorTelefono(tel);
      if (cli) { guardarSesion(tel); entrar(cli, tel); }
    });
  }

  form.onsubmit = (e) => {
    e.preventDefault(); err.hidden = true;
    const tel = normalizarTelefono(inp.value, sel.value);
    if (normalizarTelefono(inp.value, '').length < 7) {
      err.hidden = false; err.innerHTML = 'Escribe tu número completo, solo los dígitos.'; return;
    }
    const cli = buscarClientePorTelefono(tel);
    if (!cli) {
      err.hidden = false;
      err.innerHTML = `No encontramos <strong>${esc(tel)}</strong> entre nuestros clientes. Revisa el número o <a href="${waLink('Hola, mi número no aparece en la Central de Postventa C4V. ¿Me ayudan?')}" target="_blank" rel="noopener">escríbenos por WhatsApp</a> y te ayudamos.`;
      return;
    }
    guardarSesion(tel); entrar(cli, tel);
  };

  gate.hidden = false; $('#app').hidden = true;
}

// ---------- agente de IA (ElevenLabs · A4) ----------
function initAgente() {
  const btn = $('#aiBtn'), panel = $('#aiPanel'), ag = CFG.agente || {};
  $('#aiName').textContent = ag.nombre || 'CeVi';
  const mic = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0"/><path d="M12 18v3"/></svg>';

  const contenido = () => CFG.elevenlabsAgentId
    ? `<elevenlabs-convai agent-id="${esc(CFG.elevenlabsAgentId)}"></elevenlabs-convai>`
    : `<span class="ai-soon">Aún no disponible</span>
       <h3>${esc(ag.nombre || 'CeVi')} está en camino</h3>
       <p>${esc(ag.descripcion || '')} Todavía no está activo. Mientras tanto, escríbenos por WhatsApp: te responde una persona del equipo C4V.</p>
       <a class="btn primary sm" href="${waLink('Hola, necesito ayuda con mi máquina C4V.')}" target="_blank" rel="noopener">Escribir por WhatsApp</a>`;

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
  $('#menuBtn').onclick = () => { const open = $('#sidebar').classList.toggle('open'); $('#menuBtn').setAttribute('aria-expanded', open); };
  $('#logoutBtn').onclick = () => { try { localStorage.removeItem('c4v_sesion'); } catch {} location.reload(); };
  initAgente();
  initGate();

  // Sesión recordada: entra directo, sin volver a pedir el número.
  const tel = leerSesion();
  const cli = tel && buscarClientePorTelefono(tel);
  if (cli) entrar(cli, tel);
}
init();
