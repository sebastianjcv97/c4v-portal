/* Banco de Diseños (#/disenos). El catálogo (título, tipo, miniatura) se pide
   una sola vez al entrar al portal (init() lo llama junto con loadDB()) y
   vive en memoria; la descarga de cada archivo se pide al toque, firmada y
   con cupo (server: src/disenos.js — la cuenta de demostración solo baja las
   3 fichas de muestra, todo lo demás pide su cuenta real).
   Se carga antes que app.js; usa sus globales (state, esc, apiGet, apiPost,
   leerSesion, toast, icon, VERIF) solo cuando se abre la pantalla. */
(function () {
  let catalogo = null;   // null = aún no se pidió; [] = se pidió y vino vacío

  async function obtenerCatalogo() {
    if (catalogo) return catalogo;
    try {
      const r = await apiGet(`${VERIF.apiBase || ''}/api/disenos`);
      catalogo = (r && r.ok && Array.isArray(r.disenos)) ? r.disenos : [];
    } catch { catalogo = []; }
    return catalogo;
  }
  // El catálogo se pide junto con el resto del portal: cuando se abre la
  // pantalla ya está listo casi siempre, sin un «Cargando…» de por medio.
  function precargar() { obtenerCatalogo(); }

  const slug = (t) => String(t || 'otros').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'otros';

  function agrupar(lista) {
    const m = new Map();
    lista.forEach(d => { const t = d.tipo || 'Otros'; (m.get(t) || m.set(t, []).get(t)).push(d); });
    return m;
  }

  function tarjeta(d) {
    const img = d.preview ? `assets/disenos/${esc(d.preview)}` : 'assets/disenos/_sinpreview.jpg';
    return `<div class="dis-card">
      <img class="dis-prev" src="${img}" alt="" loading="lazy">
      <p class="dis-titulo">${esc(d.titulo)}</p>
      <button type="button" class="btn ghost sm dis-descargar" data-id="${esc(d.id)}">${icon('descarga')} Descargar</button>
    </div>`;
  }

  function vistaLista(lista) {
    const grupos = [...agrupar(lista)].sort((a, b) => b[1].length - a[1].length);
    return `
      <div class="dis-buscar">
        <input type="search" id="disBuscar" placeholder="Buscar por nombre, ocasión o tema…" autocomplete="off">
      </div>
      <div class="dis-grupos" id="disGrupos">
        ${grupos.map(([t, xs]) => `
          <a class="destino" href="#/disenos/${slug(t)}">
            <span class="destino-txt"><strong>${esc(t)}</strong><small>${xs.length} diseño${xs.length === 1 ? '' : 's'}</small></span>
            <span class="destino-flecha" aria-hidden="true">›</span>
          </a>`).join('')}
      </div>
      <div id="disResultado" hidden></div>`;
  }

  function vistaGrupo(tipoSlug, lista) {
    const items = lista.filter(d => slug(d.tipo) === tipoSlug);
    if (!items.length) return '<p class="bajada">No encontramos esa categoría. <a href="#/disenos">← Volver a Diseños</a></p>';
    return `<div class="dis-grid">${items.map(tarjeta).join('')}</div>`;
  }

  function vista(sub) {
    if (!catalogo) { precargar(); return '<p class="muted">Cargando diseños…</p>'; }
    if (!catalogo.length) return '<p class="bajada">No hay diseños disponibles ahora mismo.</p>';
    return sub ? vistaGrupo(sub, catalogo) : vistaLista(catalogo);
  }

  // El nombre de la categoría para el título de la pantalla (app.js lo usa si existe).
  function tituloGrupo(tipoSlug) {
    const d = (catalogo || []).find(x => slug(x.tipo) === tipoSlug);
    return d ? d.tipo : null;
  }

  async function descargar(id, boton) {
    const ses = leerSesion();
    if (!ses?.t) { toast('Entra con tu celular para descargar diseños.'); return; }
    const original = boton.innerHTML;
    boton.disabled = true; boton.textContent = 'Preparando…';
    /* La pestaña se abre YA, dentro del toque: Safari de iPhone bloquea un
       window.open que llega después de esperar a la red (igual que las guías). */
    const pestana = window.open('', '_blank');
    if (pestana) pestana.opener = null;
    try {
      const r = await apiPost(`/api/disenos/${encodeURIComponent(id)}/descargar`, { token: ses.t });
      if (!r.json?.ok || !r.json.url) {
        if (pestana) pestana.close();
        toast(r.json?.error || 'No se pudo preparar la descarga.');
        return;
      }
      if (pestana) pestana.location.href = (VERIF.apiBase || '') + r.json.url;
      else location.href = (VERIF.apiBase || '') + r.json.url;
    } catch {
      if (pestana) pestana.close();
      toast('No se pudo preparar la descarga. Revisa tu internet e inténtalo otra vez.');
    } finally {
      boton.disabled = false; boton.innerHTML = original;
    }
  }

  function enlazar() {
    const buscar = view.querySelector('#disBuscar');
    if (buscar) {
      buscar.oninput = () => {
        const q = buscar.value.trim().toLowerCase();
        const grupos = view.querySelector('#disGrupos'), res = view.querySelector('#disResultado');
        if (!q) { grupos.hidden = false; res.hidden = true; res.innerHTML = ''; return; }
        const items = (catalogo || []).filter(d => [d.titulo, d.tipo, ...(d.ocasion || []), ...(d.tema || [])]
          .some(x => String(x || '').toLowerCase().includes(q)));
        grupos.hidden = true; res.hidden = false;
        res.innerHTML = items.length ? `<div class="dis-grid">${items.map(tarjeta).join('')}</div>` : '<p class="muted">Nada con esas palabras.</p>';
        bindDescargas(res);
      };
    }
    bindDescargas(view);
  }
  function bindDescargas(raiz) {
    raiz.querySelectorAll('.dis-descargar').forEach(b => { b.onclick = () => descargar(b.dataset.id, b); });
  }

  window.C4V_DISENOS = { vista, enlazar, precargar, tituloGrupo };
})();
