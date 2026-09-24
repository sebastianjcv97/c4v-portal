/* Calculadora de servicio de corte láser (#/calculadora).
   La misma cuenta que la hoja «tabla de precios.xlsx»: minutos de corte × precio
   por minuto + planchas × precio de la plancha. Todos los números se pueden
   cambiar y lo que el cliente escribe se guarda en su teléfono, aparte por país
   (cada país tiene su moneda). Los precios de partida están en config.js.
   Se carga antes que app.js; usa sus globales (state, esc, currentClient) solo
   cuando se abre la pantalla. */
(function () {
  const conf = () => (window.C4V_CONFIG || {}).calculadora || { paises: {} };
  const listaPaises = () => ((window.C4V_CONFIG || {}).paises || []).filter(p => conf().paises[p.code]);

  let calc = null;      // { v, pais, porPais: { PE: { minutos, precioMinuto, lineas, materiales, base } } }
  let calcCtx;          // de qué cliente es `calc`

  const clave = () => 'c4v_calc_' + (state.ctx || 'anon');
  function cargar() {
    try {
      const s = JSON.parse(localStorage.getItem(clave()) || 'null');
      if (s && s.v === 1 && s.porPais && typeof s.porPais === 'object') return s;
    } catch {}
    return { v: 1, pais: null, porPais: {} };
  }
  // Solo escribe el país que se está editando: otra pestaña abierta no pisa los demás.
  function guardar() {
    try {
      const s = cargar();
      s.pais = calc.pais;
      s.porPais[calc.pais] = calc.porPais[calc.pais];
      localStorage.setItem(clave(), JSON.stringify(s));
      calc.porPais = { ...s.porPais };
    } catch {}
  }

  // Un país sin lista propia usa los materiales de Perú, pero sin precio.
  function confPais(code) {
    const todos = conf().paises, p = todos[code] || todos.PE || {};
    const base = (todos.PE && todos.PE.materiales) || [];
    return {
      moneda: p.moneda || 'PEN',
      locale: p.locale || 'es-PE',
      nota: p.nota || '',
      precioMinuto: p.precioMinuto ?? null,
      materiales: p.materiales || base.map(([nombre]) => [nombre, null])
    };
  }
  const tienePrecios = (code) => confPais(code).precioMinuto != null;
  // Los precios de partida se escriben como se escriben en ese país: 9.300 en Colombia, 3,6 en Ecuador.
  const aTexto = (n, code) => (n == null ? '' : new Intl.NumberFormat(confPais(code).locale, { maximumFractionDigits: 2 }).format(n));
  let seq = 0;
  const nuevoId = () => 'm' + Date.now().toString(36) + (seq++);
  const huella = (code) => { const c = confPais(code); return JSON.stringify([c.precioMinuto, c.materiales]); };

  function porDefecto(code) {
    const c = confPais(code), ej = conf().ejemplo || {};
    const materiales = c.materiales.map(([nombre, precio], i) => ({ id: 'm' + i, nombre, precio: aTexto(precio, code) }));
    return {
      minutos: aTexto(ej.minutos, code),
      precioMinuto: aTexto(c.precioMinuto, code),
      lineas: materiales.length ? [{ m: materiales[0].id, cant: aTexto(ej.planchas ?? 1, code) }] : [],
      materiales,
      base: huella(code)
    };
  }
  /* Si C4V cambia un precio de referencia en config.js, le llega al cliente
     solo donde él no había escrito nada suyo: lo que cambió, se respeta. */
  function seguirReferencia(d, code) {
    const viejo = d.base ? JSON.parse(d.base) : [null, []];
    const nuevo = porDefecto(code);
    if (d.precioMinuto === '' || d.precioMinuto === aTexto(viejo[0], code)) d.precioMinuto = nuevo.precioMinuto;
    const antes = new Map((viejo[1] || []).map(([n, p]) => [n, aTexto(p, code)]));
    d.materiales.forEach(m => {
      const n = nuevo.materiales.find(x => x.nombre === m.nombre);
      if (n && (m.precio === '' || m.precio === antes.get(m.nombre))) m.precio = n.precio;
    });
    d.base = nuevo.base;
  }
  function datos() {
    const code = calc.pais;
    const d = calc.porPais[code];
    if (!d || !Array.isArray(d.lineas) || !Array.isArray(d.materiales)) return (calc.porPais[code] = porDefecto(code));
    if (d.base !== huella(code)) { seguirReferencia(d, code); guardar(); }
    return d;
  }

  // Chile y Colombia no usan centavos.
  const sinCentavos = () => ['CLP', 'COP'].includes(confPais(calc.pais).moneda);
  /* '' → null (vacío), lo que no es un número → NaN, si no el número.
     Se lee como la pantalla escribe el dinero: en Perú la coma separa miles
     (1,500) y en los demás países el punto (1.500). El otro signo es decimal.
     Grupos exactos de tres cifras son miles; si no, el signo es decimal (0,8 y 0.8). */
  function leer(txt, esDinero) {
    let s = String(txt ?? '').trim().replace(/\s/g, '');
    if (!s) return null;
    const miles = confPais(calc.pais).locale === 'es-PE' ? ',' : '.';
    const dec = miles === ',' ? '.' : ',';
    if (new RegExp(`^[1-9]\\d{0,2}(\\${miles}\\d{3})+(\\${dec}\\d*)?$`).test(s)) s = s.split(miles).join('');
    else if (esDinero && sinCentavos() && /^[1-9]\d{0,2}(,\d{3})+$/.test(s)) s = s.replace(/,/g, '');
    s = s.replace(',', '.');
    if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }
  // Se redondea cada parte como se muestra, para que el detalle sume el total.
  const redondear = (n) => Number(new Intl.NumberFormat('en-US', { useGrouping: false, maximumFractionDigits: sinCentavos() ? 0 : 2 }).format(n));
  function dinero(n) {
    const c = confPais(calc.pais), d = sinCentavos() ? 0 : 2;
    try { return new Intl.NumberFormat(c.locale, { style: 'currency', currency: c.moneda, minimumFractionDigits: d, maximumFractionDigits: d }).format(n); }
    catch { return c.moneda + ' ' + n.toFixed(d); }
  }
  function simbolo() {
    const c = confPais(calc.pais);
    try { return new Intl.NumberFormat(c.locale, { style: 'currency', currency: c.moneda }).formatToParts(0).find(p => p.type === 'currency').value; }
    catch { return c.moneda; }
  }
  const nombreMat = (m) => (m && m.nombre.trim()) || 'Material sin nombre';
  const etiquetaPrecio = (m) => 'Precio de ' + nombreMat(m);
  const etiquetaQuitar = (m) => 'Quitar ' + nombreMat(m) + ' de tus precios';

  /* La cuenta. Vacío en minutos o planchas cuenta como cero; lo que falta es un
     precio para algo que sí se va a cobrar. `mal` son los números mal escritos. */
  function calcular() {
    const d = datos(), falta = [], mal = [];
    const pedir = (t) => { if (!falta.includes(t)) falta.push(t); };
    const min = leer(d.minutos, false), pm = leer(d.precioMinuto, true);
    if (Number.isNaN(min)) mal.push({ id: 'calcMin', que: 'los minutos de corte' });
    if (Number.isNaN(pm)) mal.push({ id: 'calcPm', que: 'el precio por minuto' });
    let corte = 0;
    if (Number.isNaN(min)) corte = null;
    else if (min > 0) {
      if (pm == null) { pedir('tu precio por minuto'); corte = null; }
      else if (Number.isNaN(pm)) corte = null;
      else corte = redondear(min * pm);
    }
    let material = 0;
    const lineas = d.lineas.map((l, i) => {
      const mat = d.materiales.find(x => x.id === l.m);
      const cant = leer(l.cant, false), precio = mat ? leer(mat.precio, true) : null;
      const r = { i, precio, valor: null, falta: '' };
      if (Number.isNaN(cant)) { mal.push({ id: 'calcCant' + i, que: mat ? `las planchas de ${nombreMat(mat)}` : 'las planchas' }); return r; }
      if (!cant) { r.valor = 0; return r; }
      if (!mat) { r.falta = 'Elige el material.'; pedir('elegir un material'); return r; }
      if (precio == null) { r.falta = `Pon el precio de ${nombreMat(mat)} en «Tus precios».`; pedir(`el precio de ${nombreMat(mat)}`); return r; }
      if (Number.isNaN(precio)) { r.falta = `Revisa el precio de ${nombreMat(mat)} en «Tus precios».`; return r; }
      r.valor = redondear(cant * precio); material += r.valor;
      return r;
    });
    // Un precio mal escrito se marca aunque el material no esté en esta cotización.
    d.materiales.forEach(m => {
      if (Number.isNaN(leer(m.precio, true))) mal.push({ id: 'calcPrecio-' + m.id, que: `el precio de ${nombreMat(m)}`, usado: d.lineas.some(l => l.m === m.id && leer(l.cant, false) > 0) });
    });
    material = redondear(material);
    const bloquea = mal.filter(x => !x.id.startsWith('calcPrecio-') || x.usado);
    return { corte, material, total: redondear((corte ?? 0) + material), lineas, falta, mal, bloquea };
  }

  const juntar = (xs) => xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' y ' + xs[xs.length - 1];
  const poner = (el, t) => { if (el && el.textContent !== t) el.textContent = t; };

  // Solo toca los números: así no se pierde el foco mientras la persona escribe.
  function actualizar() {
    const raiz = document.getElementById('calc');
    if (!raiz) return;
    const r = calcular();
    raiz.querySelectorAll('input[aria-invalid]').forEach(x => { x.removeAttribute('aria-invalid'); x.removeAttribute('aria-describedby'); });
    raiz.querySelectorAll('.calc-dinero.mal').forEach(w => w.classList.remove('mal'));
    r.mal.forEach(({ id }) => {
      const x = document.getElementById(id);
      if (!x) return;
      x.setAttribute('aria-invalid', 'true');
      x.setAttribute('aria-describedby', 'calcDetalle');
      const caja = x.closest('.calc-dinero');
      if (caja) caja.classList.add('mal');
    });
    poner(raiz.querySelector('#calcCorte'), r.corte == null ? '—' : dinero(r.corte));
    r.lineas.forEach(l => {
      const fila = raiz.querySelector(`.calc-linea[data-i="${l.i}"]`);
      if (!fila) return;
      poner(fila.querySelector('[data-unit]'), l.precio != null && !Number.isNaN(l.precio) ? `× ${dinero(l.precio)}` : '');
      poner(fila.querySelector('[data-sub]'), l.valor != null ? dinero(l.valor) : '—');
      const aviso = fila.querySelector('[data-falta]');
      poner(aviso, l.falta); aviso.hidden = !l.falta;
    });
    const total = raiz.querySelector('#calcTotal'), det = raiz.querySelector('#calcDetalle');
    if (r.bloquea.length) {
      poner(total, '—');
      poner(det, `Revisa ${juntar(r.bloquea.map(x => x.que))}: no es un número.`);
    } else if (r.falta.length) {
      poner(total, '—');
      poner(det, `Falta ${juntar(r.falta)}.`);
    } else {
      poner(total, dinero(r.total));
      poner(det, `Corte ${dinero(r.corte ?? 0)} más material ${dinero(r.material)}.` +
        (r.mal.length ? ` Revisa ${juntar(r.mal.map(x => x.que))} en «Tus precios».` : ''));
    }
    // Un solo aviso para lectores de pantalla, fuera de lo que se vuelve a pintar.
    poner(document.getElementById('calcAnuncio'), total.textContent === '—' ? det.textContent : `Total a cobrar ${total.textContent}`);
  }

  function cuerpo() {
    const d = datos(), sym = esc(simbolo()), code = calc.pais, c = confPais(code);
    const pais = listaPaises().find(p => p.code === code);
    const plancha = conf().plancha || '';
    const opciones = (sel) => (d.materiales.length ? '' : '<option value="">Primero agrega un material abajo</option>')
      + (d.materiales.length && !d.materiales.some(m => m.id === sel) ? '<option value="" selected>Elige el material</option>' : '')
      + d.materiales.map(m => `<option value="${esc(m.id)}"${m.id === sel ? ' selected' : ''}>${esc(nombreMat(m))}</option>`).join('');
    const moneda = (p) => { try { return new Intl.DisplayNames(['es'], { type: 'currency' }).of(conf().paises[p.code].moneda); } catch { return conf().paises[p.code].moneda; } };

    return `
      <p class="bajada">Cotiza un trabajo en segundos: el tiempo de corte más el material. Cambia cualquier número, se guarda en este teléfono.</p>

      <div class="field calc-pais">
        <label for="calcPais">País</label>
        <select id="calcPais">${listaPaises().map(p => `<option value="${esc(p.code)}"${p.code === code ? ' selected' : ''}>${esc(p.nombre)}, ${esc(moneda(p))}</option>`).join('')}</select>
      </div>
      ${tienePrecios(code)
        ? (c.nota ? `<p class="calc-nota">${esc(c.nota)}</p>` : '')
        : `<p class="calc-aviso">Todavía no tenemos precios de referencia para ${esc(pais ? pais.nombre : code)}. Pon los tuyos: tu precio por minuto aquí abajo y el de cada plancha en «Tus precios».</p>`}

      <h2 class="section-h">Tiempo de corte</h2>
      <div class="calc-bloque">
        <div class="calc-fila">
          <label for="calcMin">Minutos de corte</label>
          <input id="calcMin" class="calc-num" inputmode="decimal" autocomplete="off" value="${esc(d.minutos)}" placeholder="0">
        </div>
        <div class="calc-fila">
          <label for="calcPm">Precio por minuto</label>
          <label class="calc-dinero" for="calcPm"><span class="calc-mon" aria-hidden="true">${sym}</span><input id="calcPm" inputmode="decimal" autocomplete="off" value="${esc(d.precioMinuto)}" placeholder="0"></label>
        </div>
        <p class="calc-sub"><span>Corte</span><span id="calcCorte" class="calc-monto"></span></p>
      </div>

      <h2 class="section-h">Material</h2>
      <div class="calc-bloque">
        ${d.lineas.map((l, i) => `
        <div class="calc-linea" data-i="${i}">
          <div class="calc-linea-top">
            <label class="sr-only" for="calcMat${i}">Material</label>
            <select id="calcMat${i}" data-linea="${i}">${opciones(l.m)}</select>
            <button type="button" class="calc-quitar" data-quitar-linea="${i}" aria-label="Quitar este material de la cotización">×</button>
          </div>
          <div class="calc-linea-fila">
            <span class="calc-cant">
              <label for="calcCant${i}">Planchas</label>
              <input id="calcCant${i}" class="calc-num-sm" data-linea="${i}" inputmode="decimal" autocomplete="off" value="${esc(l.cant)}" placeholder="0">
              <span class="calc-unit" data-unit></span>
            </span>
            <span class="calc-monto" data-sub></span>
          </div>
          <p class="calc-falta" data-falta hidden></p>
        </div>`).join('')}
        <button type="button" class="btn ghost sm calc-agregar" id="calcAddLinea">Agregar otro material</button>
      </div>

      <div class="calc-total">
        <p class="calc-total-rot">Total a cobrar</p>
        <span id="calcTotal" class="calc-total-num"></span>
        <p id="calcDetalle" class="calc-total-det"></p>
      </div>

      <h2 class="section-h">Tus precios por plancha${plancha ? ` <span class="contador">${esc(plancha)}</span>` : ''}</h2>
      <div class="calc-bloque">
        ${d.materiales.length ? d.materiales.map(m => `
        <div class="calc-precio" data-id="${esc(m.id)}">
          <input class="calc-nombre" data-mat="${esc(m.id)}" data-campo="nombre" aria-label="Nombre del material" autocomplete="off" maxlength="60" value="${esc(m.nombre)}" placeholder="Nombre del material">
          <label class="calc-dinero" for="calcPrecio-${esc(m.id)}"><span class="calc-mon" aria-hidden="true">${sym}</span><input id="calcPrecio-${esc(m.id)}" data-mat="${esc(m.id)}" data-campo="precio" inputmode="decimal" autocomplete="off" aria-label="${esc(etiquetaPrecio(m))}" value="${esc(m.precio)}" placeholder="0"></label>
          <button type="button" class="calc-quitar" data-quitar-mat="${esc(m.id)}" aria-label="${esc(etiquetaQuitar(m))}">×</button>
        </div>`).join('') : '<p class="muted calc-vacio">No tienes materiales. Agrega el primero.</p>'}
      </div>
      <div class="calc-acciones">
        <button type="button" class="btn ghost sm" id="calcAddMat">Agregar material</button>
        <button type="button" class="calc-reset" id="calcReset">${tienePrecios(code) ? 'Volver a los precios de referencia' : 'Borrar lo que escribí'}</button>
      </div>`;
  }

  function pintar(enfocar) {
    const raiz = document.getElementById('calc');
    if (!raiz) return;
    raiz.innerHTML = cuerpo();
    actualizar();
    if (enfocar) { const x = raiz.querySelector(enfocar); if (x) x.focus(); }
  }

  function vista() {
    // Se relee cada vez: otra pestaña pudo guardar cambios mientras tanto.
    const guardado = cargar();
    if (!calc || calcCtx !== state.ctx || guardado.pais || Object.keys(guardado.porPais).length) calc = guardado;
    calcCtx = state.ctx;
    if (!calc.pais || !conf().paises[calc.pais]) {
      const cli = typeof currentClient === 'function' ? currentClient() : null;
      calc.pais = cli && conf().paises[cli.pais] ? cli.pais : 'PE';
    }
    return `<section class="calc"><div id="calc">${cuerpo()}</div><p id="calcAnuncio" class="sr-only" role="status" aria-live="polite"></p></section>`;
  }

  function enlazar() {
    const raiz = document.getElementById('calc');
    if (!raiz) return;
    actualizar();

    raiz.addEventListener('input', (e) => {
      const t = e.target, d = datos();
      if (t.id === 'calcMin') d.minutos = t.value;
      else if (t.id === 'calcPm') d.precioMinuto = t.value;
      else if (t.dataset.linea != null && t.tagName === 'INPUT') { const l = d.lineas[+t.dataset.linea]; if (l) l.cant = t.value; }
      else if (t.dataset.mat) {
        const m = d.materiales.find(x => x.id === t.dataset.mat);
        if (!m) return;
        m[t.dataset.campo] = t.value;
        if (t.dataset.campo === 'nombre') {
          // El nombre nuevo se ve ya en los desplegables, sin volver a pintar (no se pierde el foco).
          raiz.querySelectorAll(`option[value="${CSS.escape(m.id)}"]`).forEach(o => { o.textContent = nombreMat(m); });
          document.getElementById('calcPrecio-' + m.id)?.setAttribute('aria-label', etiquetaPrecio(m));
          raiz.querySelector(`[data-quitar-mat="${CSS.escape(m.id)}"]`)?.setAttribute('aria-label', etiquetaQuitar(m));
        }
      } else return;
      guardar(); actualizar();
    });

    raiz.addEventListener('change', (e) => {
      const t = e.target, d = datos();
      if (t.id === 'calcPais') { calc.pais = t.value; guardar(); pintar('#calcPais'); return; }
      if (t.tagName === 'SELECT' && t.dataset.linea != null) {
        const l = d.lineas[+t.dataset.linea];
        if (l) { l.m = t.value; guardar(); pintar('#' + t.id); }
      }
    });

    raiz.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || !raiz.contains(b)) return;
      const d = datos();
      if (b.id === 'calcAddLinea') {
        d.lineas.push({ m: d.materiales[0] ? d.materiales[0].id : '', cant: '1' });
        guardar(); pintar('#calcMat' + (d.lineas.length - 1));
      } else if (b.dataset.quitarLinea != null) {
        d.lineas.splice(+b.dataset.quitarLinea, 1);
        guardar(); pintar('#calcAddLinea');
      } else if (b.id === 'calcAddMat') {
        const id = nuevoId();
        d.materiales.push({ id, nombre: '', precio: '' });
        guardar(); pintar(`.calc-nombre[data-mat="${id}"]`);
      } else if (b.dataset.quitarMat) {
        const id = b.dataset.quitarMat;
        d.materiales = d.materiales.filter(m => m.id !== id);
        d.lineas.forEach(l => { if (l.m === id) l.m = ''; });
        guardar(); pintar('#calcAddMat');
      } else if (b.id === 'calcReset') {
        const pais = (listaPaises().find(p => p.code === calc.pais) || {}).nombre || calc.pais;
        const pregunta = tienePrecios(calc.pais)
          ? `¿Borrar tus cambios de ${pais} y volver a los precios de referencia?`
          : `¿Borrar todo lo que escribiste para ${pais}?`;
        if (!confirm(pregunta)) return;
        calc.porPais[calc.pais] = porDefecto(calc.pais);
        guardar(); pintar('#calcMin');
      }
    });
  }

  window.C4V_CALC = { vista, enlazar };
})();
