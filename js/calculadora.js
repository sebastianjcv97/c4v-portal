/* Calculadora de servicio de corte láser (#/calculadora y #/calculadora/precios).
   El país y la moneda salen de la cuenta del cliente.
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
  // Los precios van siempre con sus decimales (S/ 3.00, $3,60): se ve que se pueden afinar. Chile y Colombia, sin centavos.
  const decimalesDe = (code) => (['CLP', 'COP'].includes(confPais(code).moneda) ? 0 : 2);
  const aDinero = (n, code) => (n == null ? '' : new Intl.NumberFormat(confPais(code).locale, { minimumFractionDigits: decimalesDe(code), maximumFractionDigits: decimalesDe(code) }).format(n));
  let seq = 0;
  const nuevoId = () => 'm' + Date.now().toString(36) + (seq++);
  const huella = (code) => { const c = confPais(code); return JSON.stringify([c.precioMinuto, c.materiales]); };

  function porDefecto(code) {
    const c = confPais(code), ej = conf().ejemplo || {};
    const materiales = c.materiales.map(([nombre, precio], i) => ({ id: 'm' + i, nombre, precio: aDinero(precio, code) }));
    return {
      minutos: aTexto(ej.minutos, code),
      precioMinuto: aDinero(c.precioMinuto, code),
      lineas: materiales.length ? [{ m: materiales[0].id, cant: aTexto(ej.planchas ?? 1, code) }] : [],
      materiales,
      base: huella(code),
      formato: 2
    };
  }
  /* Si C4V cambia un precio de referencia en config.js, le llega al cliente
     solo donde él no había escrito nada suyo: lo que cambió, se respeta. */
  function seguirReferencia(d, code) {
    const viejo = d.base ? JSON.parse(d.base) : [null, []];
    const nuevo = porDefecto(code);
    // Sin tocar = vacío o el mismo número de antes (se compara el número: «3» y «3.00» son lo mismo).
    const igual = (txt, n) => txt === '' || (n != null && leer(txt, true) === n);
    if (igual(d.precioMinuto, viejo[0])) d.precioMinuto = nuevo.precioMinuto;
    const antes = new Map(viejo[1] || []);
    d.materiales.forEach(m => {
      const n = nuevo.materiales.find(x => x.nombre === m.nombre);
      if (n && igual(m.precio, antes.get(m.nombre))) m.precio = n.precio;
    });
    d.base = nuevo.base;
  }
  function datos() {
    const code = calc.pais;
    const d = calc.porPais[code];
    if (!d || !Array.isArray(d.lineas) || !Array.isArray(d.materiales)) return (calc.porPais[code] = porDefecto(code));
    if (d.base !== huella(code)) { seguirReferencia(d, code); guardar(); }
    if (d.formato !== 2) {
      // Lo guardado antes, sin decimales («3»), pasa a verse como precio («3.00»).
      const f = (t) => { const n = leer(t, true); return n == null || Number.isNaN(n) ? t : aDinero(n, code); };
      d.precioMinuto = f(d.precioMinuto);
      d.materiales.forEach(m => { m.precio = f(m.precio); });
      d.formato = 2; guardar();
    }
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
      if (precio == null) { r.falta = `Falta el precio de ${nombreMat(mat)}: ponlo en «Configurar mis precios».`; pedir(`el precio de ${nombreMat(mat)}`); return r; }
      if (Number.isNaN(precio)) { r.falta = `Revisa el precio de ${nombreMat(mat)} en «Configurar mis precios».`; return r; }
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

  /* ---------- Pantalla ----------
     Dos pantallas: la calculadora (minutos, material y total) y «Configurar mis
     precios» (país, precio por minuto y de cada plancha), que se ponen una vez.
     Cada número tiene botones grandes − y + además de poder escribirse, y cada
     cosa tiene su color: el tiempo en azul, el MDF en madera, el acrílico en agua. */
  let pantalla = 'calc';
  const PASO_DINERO = { PEN: [0.05, 0.5], USD: [0.01, 0.1], BOB: [0.1, 1], CLP: [10, 100], COP: [50, 500] };
  const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICO = {
    reloj: svg('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2"/><path d="M9.5 2.5h5"/>'),
    planchas: svg('<path d="M3.5 8 12 4l8.5 4-8.5 4z"/><path d="M3.5 12l8.5 4 8.5-4"/><path d="M3.5 16l8.5 4 8.5-4"/>'),
    etiqueta: svg('<path d="M3.5 12.5v-8a1 1 0 0 1 1-1h8l8 8-9 9z"/><circle cx="8" cy="8" r="1.5"/>'),
    mas: svg('<path d="M12 5v14M5 12h14"/>')
  };
  const familia = (m) => /acr[ií]l/i.test(m.nombre) ? 'acrilico' : /mdf|madera|triplay|pino|cart[oó]n|balsa|melamin/i.test(m.nombre) ? 'madera' : 'otro';

  function stepper({ id, valor, unidad, prefijo, etiqueta, menos, mas, attrs = '' }) {
    return `
      <div class="calc-stepper">
        <button type="button" class="calc-btn-paso" data-paso="-1" data-para="${esc(id)}" aria-label="${esc(menos)}">−</button>
        <label class="calc-valor" for="${esc(id)}">${prefijo ? `<span class="calc-mon" aria-hidden="true">${esc(prefijo)}</span>` : ''}<input id="${esc(id)}" inputmode="decimal" autocomplete="off" aria-label="${esc(etiqueta)}" value="${esc(valor)}" placeholder="0" ${attrs}>${unidad ? `<span class="calc-medida" aria-hidden="true">${esc(unidad)}</span>` : ''}</label>
        <button type="button" class="calc-btn-paso" data-paso="1" data-para="${esc(id)}" aria-label="${esc(mas)}">+</button>
      </div>`;
  }

  // Cuánto sube o baja cada toque: un minuto, media plancha, y en dinero lo que tenga sentido en esa moneda.
  function pasoDe(input) {
    const [min, plancha] = PASO_DINERO[confPais(calc.pais).moneda] || [0.1, 1];
    if (input.id === 'calcMin') return 1;
    if (input.id === 'calcPm') return min;
    if (input.dataset.campo === 'precio') return plancha;
    return 0.5;
  }
  function tocarPaso(b) {
    const input = document.getElementById(b.dataset.para);
    if (!input) return;
    const esDinero = input.id === 'calcPm' || input.dataset.campo === 'precio';
    const actual = leer(input.value, esDinero);
    const paso = pasoDe(input);
    const decimales = (String(paso).split('.')[1] || '').length;
    let n = (Number.isNaN(actual) || actual == null ? 0 : actual) + paso * Number(b.dataset.paso);
    n = Math.max(0, Number((Math.round(n / paso) * paso).toFixed(decimales)));
    input.value = esDinero ? aDinero(n, calc.pais) : aTexto(n, calc.pais);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function actualizar() {
    const raiz = document.getElementById('calc');
    if (!raiz) return;
    const r = calcular(), d = datos();
    raiz.querySelectorAll('input[aria-invalid]').forEach(x => { x.removeAttribute('aria-invalid'); x.removeAttribute('aria-describedby'); });
    raiz.querySelectorAll('.calc-valor.mal').forEach(w => w.classList.remove('mal'));
    r.mal.forEach(({ id }) => {
      const x = document.getElementById(id);
      if (!x) return;
      x.setAttribute('aria-invalid', 'true');
      if (document.getElementById('calcDetalle')) x.setAttribute('aria-describedby', 'calcDetalle');
      x.closest('.calc-valor')?.classList.add('mal');
    });
    const pm = leer(d.precioMinuto, true), pmOk = pm != null && !Number.isNaN(pm);
    const pais = (listaPaises().find(p => p.code === calc.pais) || {}).nombre || calc.pais;
    poner(raiz.querySelector('#calcAjustesRes'), `${pais}, ${pmOk ? `${dinero(pm)} el minuto` : 'falta el precio por minuto'}`);
    if (pantalla !== 'calc') return;

    poner(raiz.querySelector('#calcUnitMin'), pmOk ? `${dinero(pm)} por minuto` : '');
    poner(raiz.querySelector('#calcCorte'), r.corte == null ? '—' : dinero(r.corte));
    const faltaMin = raiz.querySelector('#calcFaltaMin');
    poner(faltaMin, pmOk ? '' : 'Falta tu precio por minuto: ponlo en «Configurar mis precios».');
    faltaMin.hidden = pmOk;
    r.lineas.forEach(l => {
      const fila = raiz.querySelector(`.calc-card[data-i="${l.i}"]`);
      if (!fila) return;
      poner(fila.querySelector('[data-unit]'), l.precio != null && !Number.isNaN(l.precio) ? `${dinero(l.precio)} cada plancha` : '');
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
      poner(det, `Corte ${dinero(r.corte ?? 0)} más material ${dinero(r.material)}.`);
    }
    // Un solo aviso para lectores de pantalla, fuera de lo que se vuelve a pintar.
    poner(document.getElementById('calcAnuncio'), total.textContent === '—' ? det.textContent : `Total a cobrar ${total.textContent}`);
  }

  function pantallaCalculadora() {
    const d = datos(), code = calc.pais, plancha = conf().plancha || '';
    const varias = d.lineas.length > 1;
    const precioTile = (m) => { const n = leer(m.precio, true); return n == null || Number.isNaN(n) ? 'sin precio' : dinero(n); };
    return `
      <p class="bajada">Toca los botones <b>−</b> y <b>+</b> o escribe el número. Abajo te sale cuánto cobrar.</p>

      <section class="calc-card tiempo" aria-labelledby="calcTitMin">
        <div class="calc-card-cab"><span class="calc-card-ico">${ICO.reloj}</span><h2 id="calcTitMin">Minutos de corte</h2></div>
        <p class="calc-ayuda">Lo que tarda la máquina en cortar todo el trabajo.</p>
        ${stepper({ id: 'calcMin', valor: d.minutos, unidad: 'min', etiqueta: 'Minutos de corte', menos: 'Un minuto menos', mas: 'Un minuto más' })}
        <p class="calc-card-pie"><span id="calcUnitMin"></span><strong id="calcCorte" class="calc-monto"></strong></p>
        <p class="calc-falta" id="calcFaltaMin" hidden></p>
      </section>

      ${d.lineas.map((l, i) => {
        const mat = d.materiales.find(x => x.id === l.m);
        return `
      <section class="calc-card material" data-i="${i}" aria-labelledby="calcTitMat${i}">
        <div class="calc-card-cab">
          <span class="calc-card-ico">${ICO.planchas}</span><h2 id="calcTitMat${i}">${varias ? `Material ${i + 1}` : 'Material'}</h2>
          ${varias ? `<button type="button" class="calc-quitar" data-quitar-linea="${i}" aria-label="Quitar el material ${i + 1}">×</button>` : ''}
        </div>
        ${d.materiales.length ? `
        <div class="calc-tiles" role="group" aria-label="Elige el material">
          ${d.materiales.map(m => `<button type="button" class="calc-tile ${familia(m)}" data-linea="${i}" data-elige="${esc(m.id)}" aria-pressed="${m.id === l.m}"><span class="calc-tile-nom">${esc(nombreMat(m))}</span><span class="calc-tile-pre">${esc(precioTile(m))}</span></button>`).join('')}
        </div>` : '<p class="calc-falta">No tienes materiales: agrégalos en «Configurar mis precios».</p>'}
        <p class="calc-ayuda">¿Cuántas planchas de ${esc(plancha)}? Puede ser media: ${esc(aTexto(0.5, code))}.</p>
        ${stepper({ id: 'calcCant' + i, valor: l.cant, unidad: 'planchas', etiqueta: `Planchas de ${nombreMat(mat)}`, menos: 'Media plancha menos', mas: 'Media plancha más', attrs: `data-linea="${i}"` })}
        <p class="calc-card-pie"><span data-unit></span><strong class="calc-monto" data-sub></strong></p>
        <p class="calc-falta" data-falta hidden></p>
      </section>`;
      }).join('')}

      <button type="button" class="calc-otro" id="calcAddLinea">${ICO.mas}<span>Agregar otro material</span></button>

      <a class="calc-config" href="#/calculadora/precios">
        <span class="calc-config-ico">${ICO.etiqueta}</span>
        <span class="calc-config-txt"><strong>Configurar mis precios</strong><small id="calcAjustesRes"></small></span>
        <span class="calc-config-flecha" aria-hidden="true">›</span>
      </a>

      <div class="calc-total">
        <p class="calc-total-rot">Total a cobrar</p>
        <span id="calcTotal" class="calc-total-num"></span>
        <p id="calcDetalle" class="calc-total-det"></p>
      </div>`;
  }

  function pantallaPrecios() {
    const d = datos(), code = calc.pais, c = confPais(code), sym = simbolo(), plancha = conf().plancha || '';
    return `
      <p class="bajada">Pon tus precios una vez: se guardan en este teléfono y la calculadora los usa siempre.</p>

      <p class="calc-nota">${c.nota ? esc(c.nota) + ' ' : ''}Escribe tu precio o usa los botones − y +.</p>

      <section class="calc-card tiempo" aria-labelledby="calcTitPm">
        <div class="calc-card-cab"><span class="calc-card-ico">${ICO.reloj}</span><h2 id="calcTitPm">Precio por minuto</h2></div>
        <p class="calc-ayuda">Lo que cobras por cada minuto que corta la máquina.</p>
        ${stepper({ id: 'calcPm', valor: d.precioMinuto, prefijo: sym, etiqueta: 'Precio por minuto', menos: 'Bajar el precio por minuto', mas: 'Subir el precio por minuto' })}
      </section>

      <h2 class="section-h">Precio de cada plancha${plancha ? ` <span class="contador">${esc(plancha)}</span>` : ''}</h2>
      ${d.materiales.length ? d.materiales.map(m => `
      <section class="calc-card precio ${familia(m)}" data-id="${esc(m.id)}">
        <div class="calc-precio-cab">
          <input class="calc-nombre" data-mat="${esc(m.id)}" data-campo="nombre" aria-label="Nombre del material" autocomplete="off" maxlength="60" value="${esc(m.nombre)}" placeholder="Nombre del material">
          <button type="button" class="calc-quitar" data-quitar-mat="${esc(m.id)}" aria-label="${esc(etiquetaQuitar(m))}">×</button>
        </div>
        ${stepper({ id: 'calcPrecio-' + m.id, valor: m.precio, prefijo: sym, etiqueta: etiquetaPrecio(m), menos: 'Bajar el precio de ' + nombreMat(m), mas: 'Subir el precio de ' + nombreMat(m), attrs: `data-mat="${esc(m.id)}" data-campo="precio"` })}
      </section>`).join('') : '<p class="muted calc-vacio">No tienes materiales. Agrega el primero.</p>'}

      <button type="button" class="calc-otro" id="calcAddMat">${ICO.mas}<span>Agregar un material</span></button>

      <a class="btn primary calc-listo" href="#/calculadora">Listo</a>
      <button type="button" class="calc-reset" id="calcReset">${tienePrecios(code) ? 'Volver a los precios de referencia' : 'Borrar lo que escribí'}</button>`;
  }

  const cuerpo = () => (pantalla === 'precios' ? pantallaPrecios() : pantallaCalculadora());

  function pintar(enfocar) {
    const raiz = document.getElementById('calc');
    if (!raiz) return;
    raiz.innerHTML = cuerpo();
    actualizar();
    if (enfocar) { const x = raiz.querySelector(enfocar); if (x) x.focus(); }
  }

  function vista(sub) {
    pantalla = sub === 'precios' ? 'precios' : 'calc';
    // Se relee cada vez: otra pestaña pudo guardar cambios mientras tanto.
    const guardado = cargar();
    if (!calc || calcCtx !== state.ctx || guardado.pais || Object.keys(guardado.porPais).length) calc = guardado;
    calcCtx = state.ctx;
    // El país (y su moneda) sale de la cuenta del cliente: no se elige aquí.
    const cli = typeof currentClient === 'function' ? currentClient() : null;
    calc.pais = cli && conf().paises[cli.pais] ? cli.pais : 'PE';
    return `<section class="calc calc-${pantalla}"><div id="calc">${cuerpo()}</div><p id="calcAnuncio" class="sr-only" role="status" aria-live="polite"></p></section>`;
  }

  // Mantener apretado − o + repite, como en cualquier control de volumen.
  let repetir = null;
  const soltar = () => { clearTimeout(repetir); repetir = null; };
  ['pointerup', 'pointercancel', 'blur'].forEach(t => window.addEventListener(t, soltar));

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
          // Sin volver a pintar: así no se pierde el foco mientras escribe el nombre.
          const tarjeta = t.closest('.calc-card');
          if (tarjeta) tarjeta.className = `calc-card precio ${familia(m)}`;
          document.getElementById('calcPrecio-' + m.id)?.setAttribute('aria-label', etiquetaPrecio(m));
          raiz.querySelector(`[data-quitar-mat="${CSS.escape(m.id)}"]`)?.setAttribute('aria-label', etiquetaQuitar(m));
        }
      } else return;
      guardar(); actualizar();
    });

    raiz.addEventListener('change', (e) => {
      const t = e.target;
      if (t.tagName !== 'INPUT' || !(t.id === 'calcPm' || t.dataset.campo === 'precio')) return;
      const n = leer(t.value, true);
      if (n == null || Number.isNaN(n)) return;
      const f = aDinero(n, calc.pais);
      if (f !== t.value) { t.value = f; t.dispatchEvent(new Event('input', { bubbles: true })); }
    });

    raiz.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('[data-paso]');
      if (!b || e.button > 0) return;
      e.preventDefault();
      tocarPaso(b);
      soltar();
      repetir = setTimeout(function otra() { tocarPaso(b); repetir = setTimeout(otra, 90); }, 450);
    });

    raiz.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || !raiz.contains(b)) return;
      const d = datos();
      if (b.dataset.paso) {
        // Con el dedo o el mouse ya se contó en pointerdown; solo cuenta el clic del teclado (detail 0).
        if (e.detail === 0) tocarPaso(b);
      } else if (b.dataset.elige) {
        const l = d.lineas[+b.dataset.linea];
        if (l) { l.m = b.dataset.elige; guardar(); pintar(`[data-linea="${b.dataset.linea}"][data-elige="${CSS.escape(b.dataset.elige)}"]`); }
      } else if (b.id === 'calcAddLinea') {
        d.lineas.push({ m: d.materiales[0] ? d.materiales[0].id : '', cant: aTexto(1, calc.pais) });
        guardar(); pintar(`.calc-card[data-i="${d.lineas.length - 1}"] .calc-tile[aria-pressed="true"]`);
        document.getElementById(`calcTitMat${d.lineas.length - 1}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
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
          ? `¿Borrar tus precios de ${pais} y volver a los de referencia?`
          : `¿Borrar todo lo que escribiste para ${pais}?`;
        if (!confirm(pregunta)) return;
        calc.porPais[calc.pais] = porDefecto(calc.pais);
        guardar(); pintar('#calcPm');
      }
    });
  }

  window.C4V_CALC = { vista, enlazar };
})();
