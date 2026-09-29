/* Banco de Diseños (#/disenos). El catálogo (título, tipo, miniatura) se pide
   una sola vez al entrar al portal (init() lo llama junto con loadDB()) y
   vive en memoria; la descarga de cada archivo se pide al toque, firmada y
   con cupo (server: src/disenos.js — la cuenta de demostración solo baja las
   3 fichas de muestra, todo lo demás pide su cuenta real).
   Se carga antes que app.js; usa sus globales (state, esc, apiGet, apiPost,
   leerSesion, toast, icon, VERIF) solo cuando se abre la pantalla. */
(function () {
  let catalogo = null;   // null = aún no se pidió; [] = se pidió y vino vacío
  let pedido = null;     // promesa en curso, para no pedirlo dos veces a la vez
  let visibles = [];     // la lista que muestra la grilla ahora (para «Ver más»)

  function obtenerCatalogo() {
    if (catalogo) return Promise.resolve(catalogo);
    if (pedido) return pedido;
    pedido = (async () => {
      try {
        const r = await apiGet(`${VERIF.apiBase || ''}/api/disenos`);
        catalogo = (r && r.ok && Array.isArray(r.disenos)) ? r.disenos : [];
      } catch { catalogo = []; }
      pedido = null;
      return catalogo;
    })();
    return pedido;
  }
  // El catálogo se pide junto con el resto del portal: cuando se abre la
  // pantalla ya está listo casi siempre, sin un «Cargando…» de por medio. Si
  // igual se abre antes de que llegue (o la primera vez falló), en cuanto
  // esté listo se vuelve a pintar — si no, «Cargando…» se quedaba para siempre.
  function precargar() {
    obtenerCatalogo().then(() => { if (currentRoute().split('/')[0] === 'disenos') render(currentRoute()); });
  }

  const slug = (t) => String(t || 'otros').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'otros';

  // Para buscar sin tildes ni mayúsculas: «lampara» encuentra «Lámpara».
  const plano = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  // Orden natural: «Lazo 2» antes que «Lazo 10».
  const porTitulo = (a, b) => String(a.titulo).localeCompare(String(b.titulo), 'es', { numeric: true, sensitivity: 'base' });

  function agrupar(lista) {
    const m = new Map();
    lista.forEach(d => { const t = d.tipo || 'Otros'; (m.get(t) || m.set(t, []).get(t)).push(d); });
    m.forEach(xs => xs.sort(porTitulo));
    return m;
  }

  // Las grillas se pintan por tandas: 1.800 miniaturas de una vez hacen
  // lento el teléfono, y casi nadie baja más allá de las primeras.
  const TANDA = 48;
  function grilla(items) {
    const primeras = items.slice(0, TANDA).map(tarjeta).join('');
    const resto = items.length - TANDA;
    return `<div class="dis-grid">${primeras}</div>` + (resto > 0
      ? `<button type="button" class="btn ghost dis-mas" data-desde="${TANDA}">Ver ${Math.min(resto, TANDA)} más (quedan ${resto})</button>`
      : '');
  }

  function tarjeta(d) {
    const img = d.preview ? `assets/disenos/${esc(d.preview)}` : 'assets/disenos/sin-preview.jpg';
    return `<div class="dis-card">
      <img class="dis-prev" src="${img}" alt="" loading="lazy">
      <p class="dis-titulo">${esc(d.titulo)}</p>
      <button type="button" class="btn ghost sm dis-descargar" data-id="${esc(d.id)}">${icon('descarga')} Descargar</button>
    </div>`;
  }

  // Portada de cada categoría: una foto de la pieza terminada cuando la hay
  // (elegidas a mano; si falta, la primera con miniatura).
  const PORTADAS = {
    'Adhesivo / vinil / otro': 'c1-d00473', 'Antifaz / careta / cotillón': 'c2-d00460',
    'Base troquelada / molde para tejer o manualidad': 'c2-d00986', 'Bisutería (aretes, collares, anillos, brazaletes)': 'c1-d00640',
    'Bolso / cartera': 'c1-d00613', 'Caja / joyero / bandeja': 'c1-d00261', 'Cuadro / portarretrato': 'c1-d02515',
    'Esfera / adorno colgante navideño': 'c1-d02495', 'Invitación / tarjeta calada': 'c2-d03312', 'Llavero': 'c1-d01107',
    'Lámpara': 'c2-d02041', 'Mueble / estante / repisa': 'c1-d00007', 'Organizador / porta-objetos / exhibidor': 'c1-d00688',
    'Silueta / letrero / decoración plana': 'c1-d00897', 'Souvenir / adorno con base': 'c1-d00931', 'Topper para tortas': 'c1-d00668',
  };

  function vistaLista(lista) {
    const grupos = [...agrupar(lista)].sort((a, b) => b[1].length - a[1].length);
    return `
      <div class="dis-buscar">
        <input type="search" id="disBuscar" placeholder="Buscar por nombre, ocasión o tema…" autocomplete="off">
      </div>
      <div class="dis-grupos" id="disGrupos">
        ${grupos.map(([t, xs]) => {
          const muestra = xs.find(d => d.id === PORTADAS[t] && d.preview) || xs.find(d => d.preview);
          return `
          <a class="destino destino-curso" href="#/disenos/${slug(t)}">
            <span class="destino-dibujo">${muestra ? `<img src="assets/disenos/${esc(muestra.preview)}" alt="" loading="lazy">` : ''}</span>
            <span class="destino-txt"><strong>${esc(t)}</strong><small>${xs.length} diseño${xs.length === 1 ? '' : 's'}</small></span>
            <span class="destino-flecha" aria-hidden="true">›</span>
          </a>`;
        }).join('')}
      </div>
      <div id="disResultado" hidden></div>`;
  }

  function vistaGrupo(tipoSlug, lista) {
    const items = lista.filter(d => slug(d.tipo) === tipoSlug).sort(porTitulo);
    if (!items.length) return '<p class="bajada">No encontramos esa categoría. <a href="#/disenos">← Volver a Diseños</a></p>';
    visibles = items;
    return `<p class="muted dis-cuenta">${items.length} diseño${items.length === 1 ? '' : 's'}, de la A a la Z.</p>` + grilla(items);
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
        const q = plano(buscar.value.trim());
        const grupos = view.querySelector('#disGrupos'), res = view.querySelector('#disResultado');
        if (!q) { grupos.hidden = false; res.hidden = true; res.innerHTML = ''; return; }
        // Todas las palabras tienen que aparecer, en cualquier orden: «caja corazon» encuentra «Caja con corazón».
        const palabras = q.split(/\s+/);
        const items = (catalogo || []).filter(d => {
          const texto = plano([d.titulo, d.tipo, ...(d.ocasion || []), ...(d.tema || [])].join(' '));
          return palabras.every(p => texto.includes(p));
        }).sort(porTitulo);
        grupos.hidden = true; res.hidden = false;
        visibles = items;
        res.innerHTML = items.length
          ? `<p class="muted dis-cuenta">${items.length} diseño${items.length === 1 ? '' : 's'}.</p>` + grilla(items)
          : '<p class="muted">Nada con esas palabras. Prueba con una sola, por ejemplo «caja» o «navidad».</p>';
        bindDescargas(res);
      };
    }
    bindDescargas(view);
  }
  function bindDescargas(raiz) {
    raiz.querySelectorAll('.dis-descargar').forEach(b => { b.onclick = () => descargar(b.dataset.id, b); });
    raiz.querySelectorAll('.dis-mas').forEach(b => { b.onclick = () => verMas(b); });
  }
  function verMas(boton) {
    const desde = Number(boton.dataset.desde) || 0;
    const grid = boton.previousElementSibling;
    const tmp = document.createElement('div');
    tmp.innerHTML = visibles.slice(desde, desde + TANDA).map(tarjeta).join('');
    bindDescargas(tmp);
    grid.append(...tmp.children);
    const hasta = desde + TANDA, resto = visibles.length - hasta;
    if (resto > 0) { boton.dataset.desde = hasta; boton.textContent = `Ver ${Math.min(resto, TANDA)} más (quedan ${resto})`; }
    else boton.remove();
  }

  window.C4V_DISENOS = { vista, enlazar, precargar, tituloGrupo };
})();
