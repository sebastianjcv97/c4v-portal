/* Calculadora de servicio de corte láser (#/calculadora).
   La cuenta de «tabla de precios.xlsx»: minutos × precio por minuto + planchas
   × precio de cada plancha. Una sola pantalla, sin configuración aparte: lo que
   el cliente escribe (su precio por minuto, el precio de cada material) queda
   guardado en su teléfono y sale la próxima vez. El país y la moneda salen de
   su cuenta; los precios de partida, de config.js.
   Se carga antes que app.js; usa sus globales (state, esc, currentClient) solo
   cuando se abre la pantalla. */
(function () {
  const conf = () => (window.C4V_CONFIG || {}).calculadora || { paises: {} };

  let calc = null;      // { v, pais, porPais: { PE: { minutos, precioMinuto, lineas, materiales, base, formato } } }
  let calcCtx;          // de qué cliente es `calc`

  const clave = () => 'c4v_calc_' + (state.ctx || 'anon');
  function cargar() {
    try {
      const s = JSON.parse(localStorage.getItem(clave()) || 'null');
      if (s && s.v === 1 && s.porPais && typeof s.porPais === 'object') return s;
    } catch {}
    return { v: 1, pais: null, porPais: {} };
  }
  // Solo escribe el país que se está usando: otra pestaña abierta no pisa los demás.
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
      precioMinuto: p.precioMinuto ?? null,
      materiales: p.materiales || base.map(([nombre]) => [nombre, null])
    };
  }
  // Cantidades como se escriben en ese país: 0.5 en Perú, 0,5 en los demás.
  const aTexto = (n, code) => (n == null ? '' : new Intl.NumberFormat(confPais(code).locale, { maximumFractionDigits: 2 }).format(n));
  // Los precios van siempre con sus decimales (S/ 3.00, $3,60). Chile y Colombia, sin centavos.
  const decimalesDe = (code) => (['CLP', 'COP'].includes(confPais(code).moneda) ? 0 : 2);
  const aDinero = (n, code) => (n == null ? '' : new Intl.NumberFormat(confPais(code).locale, { minimumFractionDigits: decimalesDe(code), maximumFractionDigits: decimalesDe(code) }).format(n));
  const huella = (code) => { const c = confPais(code); return JSON.stringify([c.precioMinuto, c.materiales, conf().ejemplo || {}]); };
  const OTRO = { id: 'otro', nombre: 'Otro material', precio: '' };

  function porDefecto(code) {
    const c = confPais(code), ej = conf().ejemplo || {};
    const materiales = c.materiales.map(([nombre, precio], i) => ({ id: 'm' + i, nombre, precio: aDinero(precio, code) }));
    return {
      minutos: aTexto(ej.minutos, code),
      precioMinuto: aDinero(c.precioMinuto, code),
      lineas: [{ m: materiales.length ? materiales[0].id : '', cant: aTexto(ej.planchas ?? 1, code) }],
      materiales: [...materiales, { ...OTRO }],
      base: huella(code),
      formato: 2
    };
  }
  /* Si C4V cambia un valor de partida en config.js, le llega al cliente solo
     donde no había escrito nada suyo: lo que cambió, se respeta. */
  function seguirReferencia(d, code) {
    const viejo = d.base ? JSON.parse(d.base) : [null, []];
    const nuevo = porDefecto(code);
    // Sin tocar = vacío o el mismo número de antes («3» y «3.00» son lo mismo).
    const igual = (txt, n, esDinero = true) => txt === '' || (n != null && leer(txt, esDinero) === n);
    if (igual(d.minutos, (viejo[2] || { minutos: 100 }).minutos, false)) d.minutos = nuevo.minutos;
    if (igual(d.precioMinuto, viejo[0])) d.precioMinuto = nuevo.precioMinuto;
    const antes = new Map(viejo[1] || []);
    d.materiales.forEach(m => {
      const n = nuevo.materiales.find(x => x.nombre === m.nombre && x.id !== 'otro');
      if (n && igual(m.precio, antes.get(m.nombre))) m.precio = n.precio;
    });
    d.base = nuevo.base;
  }
  function datos() {
    const code = calc.pais;
    const d = calc.porPais[code];
    if (!d || !Array.isArray(d.lineas) || !Array.isArray(d.materiales)) return (calc.porPais[code] = porDefecto(code));
    let cambio = false;
    if (d.base !== huella(code)) { seguirReferencia(d, code); cambio = true; }
    if (d.formato !== 2) {
      // Lo guardado antes, sin decimales («3»), pasa a verse como precio («3.00»).
      const f = (t) => { const n = leer(t, true); return n == null || Number.isNaN(n) ? t : aDinero(n, code); };
      d.precioMinuto = f(d.precioMinuto);
      d.materiales.forEach(m => { m.precio = f(m.precio); });
      d.formato = 2; cambio = true;
    }
    if (!d.materiales.some(m => m.id === 'otro')) { d.materiales.push({ ...OTRO }); cambio = true; }
    if (!d.lineas.length) { d.lineas.push({ m: '', cant: aTexto(1, code) }); cambio = true; }
    if (cambio) guardar();
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
  const nombreMat = (m) => (m && m.nombre.trim()) || 'el material';

  /* La cuenta. Vacío en minutos o planchas cuenta como cero; lo que falta es un
     precio para algo que sí se va a cobrar. `mal` son los números mal escritos. */
  function calcular() {
    const d = datos(), falta = [], mal = [];
    const pedir = (t) => { if (!falta.includes(t)) falta.push(t); };
    const min = leer(d.minutos, false), pm = leer(d.precioMinuto, true);
    if (Number.isNaN(min)) mal.push({ id: 'calcMin', que: 'los minutos' });
    if (Number.isNaN(pm)) mal.push({ id: 'calcPm', que: 'el precio por minuto' });
    let corte = 0;
    if (Number.isNaN(min)) corte = null;
    else if (min > 0) {
      if (pm == null) { pedir('el precio por minuto'); corte = null; }
      else if (Number.isNaN(pm)) corte = null;
      else corte = redondear(min * pm);
    }
    let material = 0;
    const lineas = d.lineas.map((l, i) => {
      const mat = d.materiales.find(x => x.id === l.m);
      const cant = leer(l.cant, false), precio = mat ? leer(mat.precio, true) : null;
      const r = { i, valor: null, falta: '' };
      if (Number.isNaN(cant)) { mal.push({ id: 'calcCant' + i, que: 'las planchas' }); return r; }
      if (mat && Number.isNaN(precio)) { mal.push({ id: 'calcPre' + i, que: `el precio de ${nombreMat(mat)}` }); return r; }
      if (!cant) { r.valor = 0; return r; }
      if (!mat) { r.falta = 'Elige el material en la lista.'; pedir('elegir el material'); return r; }
      if (precio == null) { r.falta = 'Escribe el precio de cada plancha.'; pedir(`el precio de ${nombreMat(mat)}`); return r; }
      r.valor = redondear(cant * precio); material += r.valor;
      return r;
    });
    material = redondear(material);
    return { corte, material, total: redondear((corte ?? 0) + material), lineas, falta, mal };
  }

  const juntar = (xs) => xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' y ' + xs[xs.length - 1];
  const poner = (el, t) => { if (el && el.textContent !== t) el.textContent = t; };

  // Solo toca los números: así no se pierde el foco mientras la persona escribe.
  function actualizar() {
    const raiz = document.getElementById('calc');
    if (!raiz) return;
    const r = calcular();
    raiz.querySelectorAll('input[aria-invalid]').forEach(x => { x.removeAttribute('aria-invalid'); x.removeAttribute('aria-describedby'); });
    raiz.querySelectorAll('.calc-caja.mal').forEach(w => w.classList.remove('mal'));
    r.mal.forEach(({ id }) => {
      const x = document.getElementById(id);
      if (!x) return;
      x.setAttribute('aria-invalid', 'true');
      x.setAttribute('aria-describedby', 'calcDetalle');
      x.closest('.calc-caja')?.classList.add('mal');
    });
    poner(raiz.querySelector('#calcCorte'), r.corte == null ? '—' : dinero(r.corte));
    r.lineas.forEach(l => {
      const fila = raiz.querySelector(`.calc-linea[data-i="${l.i}"]`);
      if (!fila) return;
      poner(fila.querySelector('[data-sub]'), l.valor != null ? dinero(l.valor) : '—');
      const aviso = fila.querySelector('[data-falta]');
      poner(aviso, l.falta); aviso.hidden = !l.falta;
    });
    const total = raiz.querySelector('#calcTotal'), det = raiz.querySelector('#calcDetalle');
    if (r.mal.length) {
      poner(total, '—');
      poner(det, `Revisa ${juntar(r.mal.map(x => x.que))}: no es un número.`);
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

  const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICO = {
    reloj: svg('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2"/><path d="M9.5 2.5h5"/>'),
    planchas: svg('<path d="M3.5 8 12 4l8.5 4-8.5 4z"/><path d="M3.5 12l8.5 4 8.5-4"/><path d="M3.5 16l8.5 4 8.5-4"/>'),
    mas: svg('<path d="M12 5v14M5 12h14"/>')
  };

  function cuerpo() {
    const d = datos(), sym = esc(simbolo()), plancha = conf().plancha || '';
    const varias = d.lineas.length > 1;
    const opciones = (sel) => (d.materiales.some(m => m.id === sel) ? '' : '<option value="" selected>Elige el material</option>')
      + d.materiales.map(m => `<option value="${esc(m.id)}"${m.id === sel ? ' selected' : ''}>${esc(m.nombre)}</option>`).join('');
    return `
      <p class="bajada">Escribe los minutos y el material. Abajo sale cuánto cobrar.</p>

      <section class="calc-card tiempo" aria-labelledby="calcTitMin">
        <div class="calc-card-cab"><span class="calc-card-ico">${ICO.reloj}</span><h2 id="calcTitMin">Tiempo de corte</h2></div>
        <div class="calc-campos">
          <label class="calc-campo" for="calcMin"><span>Minutos</span>
            <span class="calc-caja"><input id="calcMin" inputmode="decimal" autocomplete="off" value="${esc(d.minutos)}" placeholder="0"><span class="calc-mon" aria-hidden="true">min</span></span></label>
          <label class="calc-campo" for="calcPm"><span>Precio por minuto</span>
            <span class="calc-caja"><span class="calc-mon" aria-hidden="true">${sym}</span><input id="calcPm" inputmode="decimal" autocomplete="off" value="${esc(d.precioMinuto)}" placeholder="0"></span></label>
        </div>
        <p class="calc-sub"><span>Corte</span><strong id="calcCorte" class="calc-monto"></strong></p>
      </section>

      <section class="calc-card material" aria-labelledby="calcTitMat">
        <div class="calc-card-cab"><span class="calc-card-ico">${ICO.planchas}</span><h2 id="calcTitMat">Material</h2></div>
        <p class="calc-ayuda">Planchas de ${esc(plancha)}.</p>
        ${d.lineas.map((l, i) => {
          const mat = d.materiales.find(x => x.id === l.m);
          return `
        <div class="calc-linea" data-i="${i}">
          <div class="calc-linea-top">
            <label class="sr-only" for="calcMat${i}">Material</label>
            <select id="calcMat${i}" data-linea="${i}">${opciones(l.m)}</select>
            ${varias ? `<button type="button" class="calc-quitar" data-quitar-linea="${i}" aria-label="Quitar este material">×</button>` : ''}
          </div>
          <div class="calc-campos">
            <label class="calc-campo" for="calcCant${i}"><span>Planchas</span>
              <span class="calc-caja"><input id="calcCant${i}" data-linea="${i}" data-campo="cant" inputmode="decimal" autocomplete="off" value="${esc(l.cant)}" placeholder="0"></span></label>
            <label class="calc-campo" for="calcPre${i}"><span>Precio por plancha</span>
              <span class="calc-caja"><span class="calc-mon" aria-hidden="true">${sym}</span><input id="calcPre${i}" data-linea="${i}" data-campo="precio" inputmode="decimal" autocomplete="off" value="${esc(mat ? mat.precio : '')}" placeholder="0"${mat ? '' : ' disabled'}></span></label>
          </div>
          <p class="calc-sub"><span>Material</span><strong class="calc-monto" data-sub></strong></p>
          <p class="calc-falta" data-falta hidden></p>
        </div>`;
        }).join('')}
        <button type="button" class="calc-agregar" id="calcAddLinea">${ICO.mas}<span>Agregar material</span></button>
      </section>

      <div class="calc-total">
        <p class="calc-total-rot">Total a cobrar</p>
        <span id="calcTotal" class="calc-total-num"></span>
        <p id="calcDetalle" class="calc-total-det"></p>
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
    // El país (y su moneda) sale de la cuenta del cliente: no se elige aquí.
    const cli = typeof currentClient === 'function' ? currentClient() : null;
    calc.pais = cli && conf().paises[cli.pais] ? cli.pais : 'PE';
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
      else if (t.dataset.campo === 'cant') { const l = d.lineas[+t.dataset.linea]; if (l) l.cant = t.value; }
      else if (t.dataset.campo === 'precio') {
        // El precio es del material: queda guardado y sale igual en las otras filas de ese material.
        const l = d.lineas[+t.dataset.linea], m = l && d.materiales.find(x => x.id === l.m);
        if (!m) return;
        m.precio = t.value;
        d.lineas.forEach((o, j) => { const x = document.getElementById('calcPre' + j); if (o.m === m.id && x && x !== t) x.value = t.value; });
      } else return;
      guardar(); actualizar();
    });

    raiz.addEventListener('change', (e) => {
      const t = e.target, d = datos();
      if (t.tagName === 'SELECT' && t.dataset.linea != null) {
        const l = d.lineas[+t.dataset.linea];
        if (l) { l.m = t.value; guardar(); pintar('#' + t.id); }
        return;
      }
      // Al terminar de escribir un precio, se ve con sus decimales: «4» pasa a «4.00».
      if (t.tagName !== 'INPUT' || !(t.id === 'calcPm' || t.dataset.campo === 'precio')) return;
      const n = leer(t.value, true);
      if (n == null || Number.isNaN(n)) return;
      const f = aDinero(n, calc.pais);
      if (f !== t.value) { t.value = f; t.dispatchEvent(new Event('input', { bubbles: true })); }
    });

    raiz.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || !raiz.contains(b)) return;
      const d = datos();
      if (b.id === 'calcAddLinea') {
        // Sin cantidad todavía: no suma nada ni borra el total hasta que la llenen.
        d.lineas.push({ m: '', cant: '' });
        guardar(); pintar('#calcMat' + (d.lineas.length - 1));
      } else if (b.dataset.quitarLinea != null) {
        d.lineas.splice(+b.dataset.quitarLinea, 1);
        guardar(); pintar('#calcAddLinea');
      }
    });
  }

  window.C4V_CALC = { vista, enlazar };
})();
