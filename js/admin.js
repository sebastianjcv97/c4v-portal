/* Panel interno C4V (/admin).
   Página estática: habla con la API del portal (C4V_CONFIG.verificacion.apiBase;
   vacío en localhost, donde el mismo servidor sirve página y API).

   Seguridad, sin excepciones:
   - Todo lo que viene de la API (nombres, comentarios, reclamos) lo escribe la
     gente desde un formulario público. Se pinta SOLO con textContent y
     createElement. Aquí no hay innerHTML.
   - Enlaces externos solo si empiezan con https://erp.c4vlaser.com/ (Odoo) o
     https://wa.me/ (WhatsApp).
   - El token vive en sessionStorage ('c4v_admin'): se borra al cerrar la
     pestaña. Cualquier 401 o sesion_invalida lo borra y vuelve a pedir usuario. */
(function () {
  'use strict';

  /* ================= Configuración ================= */
  const CFG = window.C4V_CONFIG || {};
  const API = String((CFG.verificacion && CFG.verificacion.apiBase) || '').replace(/\/+$/, '');
  const CLAVE_SESION = 'c4v_admin';
  const PREFIJO_ODOO = 'https://erp.c4vlaser.com/';
  const PREFIJO_WA = 'https://wa.me/';

  const PAISES = { PE: 'Perú', EC: 'Ecuador', BO: 'Bolivia', CL: 'Chile', CO: 'Colombia' };
  const PREFIJOS = { PE: '51', EC: '593', BO: '591', CL: '56', CO: '57' };
  (Array.isArray(CFG.paises) ? CFG.paises : []).forEach(function (p) {
    if (p && PAISES[p.code] && p.nombre) PAISES[p.code] = p.nombre;
  });
  const ORDEN_PAISES = ['PE', 'EC', 'BO', 'CL', 'CO'];

  const EVIDENCIA = {
    venta_confirmada: 'Venta confirmada',
    comprobante_pdf: 'Comprobante adjunto',
    facturado: 'Facturado',
    factura_odoo: 'Factura en Odoo',
    entregada: 'Máquina entregada'
  };
  const VIA = { pedido: 'Coincide el pedido', comprobante: 'Coincide el comprobante', odoo: 'Encontrado en Odoo' };
  const ESTADO_SOL = { pendiente: 'Pendiente', aprobada: 'Aprobada', rechazada: 'Rechazada' };
  const ORIGEN = { solicitud: 'Por solicitud', manual: 'Dado desde el panel', panel: 'Dado desde el panel', admin: 'Dado desde el panel' };
  const ESTADO_REC = { recibido: 'Recibido', en_proceso: 'En proceso', respondido: 'Respondido' };
  const TIPO_REC = { reclamo: 'Reclamo', queja: 'Queja' };
  const PRIORIDAD = ['Baja', 'Media', 'Alta', 'Urgente'];
  const ROL = { admin: 'Administrador', equipo: 'Equipo' };
  const ACCIONES = {
    acceso_intento: 'Intento de ingreso',
    acceso_solicitado: 'Pidió código',
    acceso_ok: 'Entró al portal',
    acceso_fallido: 'Ingreso fallido',
    sesion_reanudada: 'Volvió a abrir el portal',
    datos_vistos: 'Vio sus datos',
    consentimiento: 'Aceptó los términos',
    salida: 'Salió del portal',
    solicitud_telefono: 'Pidió acceso',
    solicitud_acceso: 'Pidió acceso',
    solicitud_creada: 'Pidió acceso',
    solicitud_aprobada: 'Aprobó una solicitud',
    solicitud_rechazada: 'Rechazó una solicitud',
    solicitud_buscar: 'Buscó de nuevo la referencia',
    acceso_creado: 'Dio acceso',
    acceso_revocado: 'Revocó un acceso',
    reclamo_creado: 'Registró un reclamo',
    reclamo_consultado: 'Consultó su reclamo',
    reclamo_respondido: 'Respondió un reclamo',
    mantenimiento_hecho: 'Marcó un mantenimiento',
    mantenimiento_deshecho: 'Desmarcó un mantenimiento',
    mantenimiento_entrega: 'Registró una entrega',
    guia_enviada: 'Envió una guía',
    admin_login: 'Entró al panel',
    admin_login_ok: 'Entró al panel',
    admin_login_fallido: 'Falló al entrar al panel',
    admin_clave: 'Cambió su contraseña',
    admin_clave_cambiada: 'Cambió su contraseña',
    usuario_creado: 'Creó un usuario',
    usuario_reiniciado: 'Dio una contraseña nueva',
    usuario_activado: 'Activó un usuario',
    usuario_desactivado: 'Desactivó un usuario',
    sync: 'Sincronizó con Odoo',
    sync_odoo: 'Sincronizó con Odoo',
    // Nombres que usa el API (src/admin/rutas.js)
    admin_salir: 'Salió del panel',
    admin_solicitud_aprobada: 'Aprobó una solicitud',
    admin_solicitud_rechazada: 'Rechazó una solicitud',
    admin_acceso_creado: 'Dio acceso',
    admin_acceso_revocado: 'Revocó un acceso',
    admin_usuario_creado: 'Creó un usuario',
    admin_usuario_clave_reiniciada: 'Dio una contraseña nueva',
    admin_usuario_activado: 'Activó un usuario',
    admin_usuario_desactivado: 'Desactivó un usuario',
    admin_reclamo_respondido: 'Respondió un reclamo',
    admin_reclamo_en_proceso: 'Marcó un reclamo en proceso',
    admin_consulta: 'Consultó datos de clientes',
    admin_sync: 'Sincronizó con Odoo'
  };
  const RESULTADOS = {
    ok: 'Correcto', denegado: 'Denegado', no_encontrado: 'No encontrado', limite: 'Límite', error: 'Error', fallido: 'Falló',
    codigo_enviado_sms: 'Código enviado por SMS', telefono_no_encontrado: 'Número no registrado', telefono_compartido: 'Número en dos fichas',
    envio_sms_fallo: 'El SMS no salió', incorrecto: 'Código incorrecto', vencido: 'Código vencido', usado: 'Código ya usado',
    bloqueado: 'Bloqueado', espera: 'Pidió otro código muy rápido', sin_acceso: 'Número sin acceso',
    limite_numero: 'Tope de códigos del número', servicio: 'Twilio no respondió', sin_correo_robot: 'Registrada sin correo (robot)',
    creada: 'Solicitud creada', descartada_robot: 'Descartada (robot)', descartada_tope_numero: 'Descartada (ya tenía 3 pendientes)',
    descartada_tope_diario: 'Descartada (tope del día)'
  };
  const RESULTADOS_MALOS = { denegado: 1, error: 1, fallido: 1, limite: 1, limite_numero: 1, servicio: 1, envio_sms_fallo: 1, bloqueado: 1, incorrecto: 1, sin_acceso: 1 };

  const MENSAJES_HTTP = {
    400: 'Revisa los datos e intenta de nuevo.',
    403: 'No tienes permiso para hacer esto.',
    404: 'No se encontró. Puede que alguien más ya lo haya cambiado: actualiza la lista.',
    409: 'Ya había un cambio que choca con este. Actualiza la lista y revisa.',
    429: 'Demasiados intentos seguidos. Espera un momento y vuelve a intentar.',
    503: 'El servicio no responde en este momento. Intenta en unos minutos.'
  };

  /* ================= Estado ================= */
  const S = {
    token: null,
    usuario: null,
    tab: null,
    vista: 'arranque',
    claveForzada: false,
    focoAntes: null,
    resSeq: 0,
    sol: { estado: 'pendiente', lista: [], seq: 0 },
    acc: { estado: 'activos', lista: [], seq: 0 },
    cli: { q: '', solo: false, seq: 0, buscado: false },
    tk: { vista: 'abiertos', equipo: '', seq: 0 },
    rec: { estado: 'pendientes', seq: 0 },
    act: { tipo: 'todo', seq: 0 },
    eq: { seq: 0 }
  };

  /* ================= Utilidades de DOM ================= */
  const $ = function (sel, raiz) { return (raiz || document).querySelector(sel); };
  const $$ = function (sel, raiz) { return Array.from((raiz || document).querySelectorAll(sel)); };
  const arr = function (v) { return Array.isArray(v) ? v : []; };
  const enc = encodeURIComponent;

  /* Crea un elemento. Los hijos que son texto entran como nodos de texto:
     nunca se interpretan como HTML. 'href' no se acepta aquí a propósito:
     los enlaces se crean solo con enlace(), que exige una URL ya validada. */
  function el(tag, props) {
    const n = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        const v = props[k];
        if (v === undefined || v === null || v === false) return;
        if (k === 'class') n.className = v;
        else if (k === 'on') Object.keys(v).forEach(function (ev) { n.addEventListener(ev, v[ev]); });
        else if (k === 'value') n.value = v;
        else if (k === 'href' || k === 'src' || k === 'style' || k.indexOf('on') === 0) throw new Error('Atributo no permitido en el(): ' + k);
        else if (k === 'checked' || k === 'disabled' || k === 'hidden' || k === 'readOnly' || k === 'required' || k === 'open') n[k] = true;
        else n.setAttribute(k, v === true ? '' : String(v));
      });
    }
    poner(n, Array.prototype.slice.call(arguments, 2));
    return n;
  }
  function poner(n, hijos) {
    (function recorrer(lista) {
      lista.forEach(function (h) {
        if (h === undefined || h === null || h === false || h === '') return;
        if (Array.isArray(h)) return recorrer(h);
        n.appendChild(h instanceof Node ? h : document.createTextNode(String(h)));
      });
    })(hijos);
    return n;
  }
  function frag() {
    const f = document.createDocumentFragment();
    poner(f, Array.prototype.slice.call(arguments));
    return f;
  }

  /* Solo devuelve la URL si empieza con el prefijo permitido y es https. */
  function urlSegura(u, prefijo) {
    if (typeof u !== 'string') return null;
    u = u.trim();
    if (u.indexOf(prefijo) !== 0 || /[\s\u0000-\u001f\\]/.test(u)) return null;
    try {
      const x = new URL(u);
      return x.protocol === 'https:' && x.href.indexOf(prefijo) === 0 ? x.href : null;
    } catch (e) { return null; }
  }
  function enlace(urlValidada, texto, clase, etiquetaAccesible) {
    const a = el('a', { class: clase || 'enlace', target: '_blank', rel: 'noopener noreferrer', 'aria-label': etiquetaAccesible }, texto);
    a.href = urlValidada;
    return a;
  }
  function enlaceOdoo(url, texto, clase) {
    const u = urlSegura(url, PREFIJO_ODOO);
    return u ? enlace(u, texto || 'Ver en Odoo', clase) : null;
  }
  /* Solo con número internacional (+51…): sin el código de país wa.me abriría otro número. */
  function waDeTelefono(e164) {
    if (!/^\s*\+/.test(String(e164 || ''))) return null;
    const d = String(e164 || '').replace(/\D/g, '');
    return d.length >= 8 && d.length <= 15 ? PREFIJO_WA + d : null;
  }
  function celular(legible, e164) {
    const wa = waDeTelefono(e164 || legible);
    const texto = legible || e164;
    if (!texto) return null;
    return el('span', { class: 'celular' }, texto, wa && ' ', wa && enlace(wa, 'WhatsApp', 'enlace enlace-wa', 'Escribir por WhatsApp al ' + texto));
  }

  /* ================= Formatos ================= */
  const fFechaHora = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const fFecha = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });
  const fHora = new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit' });
  const fRel = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
  const fNum = new Intl.NumberFormat('es-PE');
  const fMonto = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function aFecha(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
      const p = v.split('-').map(Number);
      return new Date(p[0], p[1] - 1, p[2]);   // fecha sin hora: día local, no medianoche UTC
    }
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  function fechaHora(v) { const d = aFecha(v); return d ? fFechaHora.format(d) : ''; }
  function fecha(v) { const d = aFecha(v); return d ? fFecha.format(d) : ''; }
  function hora(v) { const d = aFecha(v); return d ? fHora.format(d) : ''; }
  function hace(v) {
    const d = aFecha(v);
    if (!d) return '';
    const s = (d.getTime() - Date.now()) / 1000;
    const a = Math.abs(s);
    if (a < 60) return 'hace un momento';
    if (a < 3600) return fRel.format(Math.round(s / 60), 'minute');
    if (a < 86400) return fRel.format(Math.round(s / 3600), 'hour');
    if (a < 86400 * 30) return fRel.format(Math.round(s / 86400), 'day');
    return 'el ' + fecha(v);
  }
  function numero(v) {
    const n = Number(v);
    return v === null || v === undefined || v === '' || !isFinite(n) ? '–' : fNum.format(n);
  }
  function pl(n, uno, varios) { return fNum.format(n) + ' ' + (n === 1 ? uno : varios); }
  /* Cierra la oración sin duplicar el punto (los nombres de empresa terminan en "S.A.C."). */
  function conPunto(t) { t = String(t || '').trim(); return /[.!?]$/.test(t) ? t : t + '.'; }
  function limpio(o) {
    const r = {};
    Object.keys(o).forEach(function (k) { if (o[k] !== undefined && o[k] !== null && o[k] !== '') r[k] = o[k]; });
    return r;
  }

  /* ================= API ================= */
  function ErrorApi(mensaje, status, datos) {
    const e = new Error(mensaje);
    e.status = status;
    e.datos = datos || null;
    return e;
  }

  async function api(metodo, ruta, cuerpo, opc) {
    opc = opc || {};
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (S.token && !opc.esLogin) headers.Authorization = 'Bearer ' + S.token;
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    const reloj = ctrl ? setTimeout(function () { ctrl.abort(); }, opc.espera || 30000) : null;
    let res;
    try {
      res = await fetch(API + ruta, {
        method: metodo,
        headers: headers,
        body: metodo === 'GET' ? undefined : JSON.stringify(cuerpo || {}),
        cache: 'no-store',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        signal: ctrl ? ctrl.signal : undefined
      });
    } catch (e) {
      throw ErrorApi(e && e.name === 'AbortError'
        ? 'El servidor tardó demasiado en responder. Intenta de nuevo.'
        : 'No se pudo conectar con el servidor. Revisa tu internet e intenta de nuevo.', 0);
    } finally {
      if (reloj) clearTimeout(reloj);
    }
    let datos = null;
    try { datos = await res.json(); } catch (e) { datos = null; }

    if (!opc.esLogin && (res.status === 401 || (datos && datos.sesion_invalida))) {
      sesionVencida();
      const e = ErrorApi('Tu sesión se cerró. Entra de nuevo.', 401, datos);
      e.sesion = true;   // ya se volvió al ingreso: quien lo reciba no debe mostrar nada
      throw e;
    }
    if (!res.ok || !datos || datos.ok === false) {
      const texto = datos && typeof datos.error === 'string' && datos.error.trim();
      const porDefecto = opc.esLogin && res.status === 401
        ? 'Usuario o contraseña incorrectos.'
        : (MENSAJES_HTTP[res.status] || 'Algo falló (error ' + res.status + '). Intenta de nuevo.');
      throw ErrorApi(texto || porDefecto, res.status, datos);
    }
    return datos;
  }

  /* Desactiva el botón mientras la petición está en vuelo. */
  async function ocupado(boton, textoOcupado, fn) {
    if (!boton || boton.getAttribute('aria-busy') === 'true') return;
    const original = boton.textContent;
    boton.disabled = true;
    boton.setAttribute('aria-busy', 'true');
    if (textoOcupado) boton.textContent = textoOcupado;
    try {
      return await fn();
    } finally {
      boton.disabled = false;
      boton.removeAttribute('aria-busy');
      if (textoOcupado) boton.textContent = original;
    }
  }

  function mostrarError(nodo, err) {
    if (err && err.sesion) return;
    nodo.textContent = typeof err === 'string' ? err : (err && err.message) || 'Algo falló. Intenta de nuevo.';
    nodo.hidden = false;
  }
  function ocultar(nodo) { nodo.hidden = true; nodo.textContent = ''; }

  let notaReloj = null;
  function nota(texto, larga) {
    const n = $('#notaFlotante');
    n.textContent = texto;
    n.hidden = false;
    clearTimeout(notaReloj);
    notaReloj = setTimeout(function () { n.hidden = true; }, larga ? 7000 : 4000);
  }

  /* ================= Sesión ================= */
  function leerToken() { try { return sessionStorage.getItem(CLAVE_SESION); } catch (e) { return null; } }
  function guardarToken(t) {
    S.token = t || null;
    try {
      if (t) sessionStorage.setItem(CLAVE_SESION, t);
      else sessionStorage.removeItem(CLAVE_SESION);
    } catch (e) { /* sin sessionStorage: la sesión dura lo que dure la página */ }
  }
  function esAdmin() { return !!(S.usuario && S.usuario.rol === 'admin'); }

  const vistas = {
    arranque: $('#vistaArranque'),
    login: $('#vistaLogin'),
    clave: $('#vistaClave'),
    panel: $('#vistaPanel')
  };
  function mostrarVista(nombre) {
    Object.keys(vistas).forEach(function (k) { vistas[k].hidden = k !== nombre; });
    S.vista = nombre;
  }

  function sesionVencida() {
    if (S.vista === 'login' && !S.token) return;
    cerrarSesion('Tu sesión venció o se cerró. Entra de nuevo.');
  }

  function cerrarSesion(mensaje) {
    guardarToken(null);
    S.usuario = null;
    if (dlg.open) { alCerrarDlg = null; dlg.close(); }
    limpiarPanel();
    mostrarLogin(mensaje);
  }

  /* Que no queden datos de clientes en la página después de salir. */
  function limpiarPanel() {
    ['#listaSolicitudes', '#listaAccesos', '#listaClientes', '#listaTickets', '#listaReclamos', '#listaEquipo', '#cajaActividad']
      .forEach(function (s) { $(s).replaceChildren(); });
    $$('.lista-info').forEach(function (n) { n.className = 'lista-info'; n.replaceChildren(); });
    ['#resSolicitudes', '#resAccesos', '#resElegibles', '#resReclamos', '#resSync'].forEach(function (s) { $(s).textContent = '…'; });
    $('#contSolicitudes').hidden = true;
    $('#contReclamos').hidden = true;
    $('#barraUsuario').textContent = '';
    $('#syncEstado').textContent = '';
    $('#cliQ').value = '';
    S.cli.q = ''; S.cli.buscado = false;
    [S.sol, S.acc, S.cli, S.tk, S.rec, S.act, S.eq].forEach(function (t) { t.seq++; });
    S.resSeq++;
  }

  function mostrarLogin(mensaje) {
    const aviso = $('#loginAviso');
    if (mensaje) { aviso.textContent = mensaje; aviso.hidden = false; } else ocultar(aviso);
    ocultar($('#loginError'));
    $('#loginClave').value = '';
    mostrarVista('login');
    document.title = 'Entrar | Panel C4V';
    ($('#loginUsuario').value ? $('#loginClave') : $('#loginUsuario')).focus();
  }

  $('#formLogin').addEventListener('submit', async function (e) {
    e.preventDefault();
    const usuario = $('#loginUsuario').value.trim();
    const clave = $('#loginClave').value;
    const error = $('#loginError');
    ocultar(error);
    if (!usuario || !clave) { mostrarError(error, 'Escribe tu usuario y tu contraseña.'); return; }
    await ocupado($('#loginBoton'), 'Entrando…', async function () {
      try {
        const r = await api('POST', '/api/admin/login', { usuario: usuario, clave: clave }, { esLogin: true });
        if (!r.token || !r.usuario) throw ErrorApi('La respuesta del servidor no trae la sesión. Avisa a Sebastián.', 0);
        guardarToken(r.token);
        S.usuario = r.usuario;
        $('#loginClave').value = '';
        ocultar($('#loginAviso'));
        entrar();
      } catch (err) {
        mostrarError(error, err);
        $('#loginClave').select();
      }
    });
  });

  function entrar() {
    if (S.usuario && S.usuario.debe_cambiar) mostrarClave(true);
    else iniciarPanel();
  }

  /* ---------- Cambiar contraseña ---------- */
  function mostrarClave(forzada) {
    S.claveForzada = !!forzada;
    $('#formClave').reset();
    $$('#formClave .input').forEach(function (i) { i.removeAttribute('aria-invalid'); });
    ocultar($('#claveError'));
    $('#claveUsuario').value = (S.usuario && S.usuario.usuario) || '';
    $('#claveIntro').textContent = forzada
      ? 'Entraste con una contraseña temporal. Antes de seguir, elige una tuya.'
      : 'Escribe tu contraseña actual y la nueva.';
    $('#claveCancelar').hidden = forzada;
    $('#claveSalir').hidden = !forzada;
    mostrarVista('clave');
    document.title = 'Cambia tu contraseña | Panel C4V';
    $('#claveActual').focus();
  }

  $('#formClave').addEventListener('submit', async function (e) {
    e.preventDefault();
    const actual = $('#claveActual');
    const nueva = $('#claveNueva');
    const repite = $('#claveRepite');
    const error = $('#claveError');
    [actual, nueva, repite].forEach(function (i) { i.removeAttribute('aria-invalid'); });
    ocultar(error);
    let malo = null;
    let texto = '';
    if (!actual.value) { malo = actual; texto = 'Escribe tu contraseña actual.'; }
    else if (nueva.value.length < 10) { malo = nueva; texto = 'La contraseña nueva debe tener al menos 10 caracteres.'; }
    else if (nueva.value !== repite.value) { malo = repite; texto = 'Las dos contraseñas nuevas no coinciden.'; }
    else if (nueva.value === actual.value) { malo = nueva; texto = 'La contraseña nueva tiene que ser distinta de la actual.'; }
    if (malo) {
      malo.setAttribute('aria-invalid', 'true');
      mostrarError(error, texto);
      malo.focus();
      return;
    }
    await ocupado($('#claveBoton'), 'Guardando…', async function () {
      try {
        const r = await api('POST', '/api/admin/clave', { actual: actual.value, nueva: nueva.value });
        if (r.token) guardarToken(r.token);
        if (S.usuario) S.usuario.debe_cambiar = false;
        $('#formClave').reset();
        if (S.claveForzada) {
          iniciarPanel();
        } else {
          mostrarVista('panel');
          ruta(false);
        }
        nota('Listo, tu contraseña quedó cambiada.');
      } catch (err) {
        mostrarError(error, err);
      }
    });
  });
  $('#claveCancelar').addEventListener('click', function () { mostrarVista('panel'); ruta(false); });
  $('#claveSalir').addEventListener('click', function () { cerrarSesion('Saliste del panel.'); });
  $('#btnCambiarClave').addEventListener('click', function () { mostrarClave(false); });
  // Salir también invalida el token en el servidor (si no, seguiría valiendo hasta 12 h).
  $('#btnSalir').addEventListener('click', function () {
    const t = S.token;
    if (t) api('POST', '/api/admin/salir', {}).catch(function () {});
    cerrarSesion('Saliste del panel.');
  });

  /* ================= Panel y pestañas ================= */
  const TABS = {
    solicitudes: { titulo: 'Solicitudes', cargar: cargarSolicitudes },
    accesos: { titulo: 'Accesos', cargar: cargarAccesos },
    clientes: { titulo: 'Clientes', cargar: cargarClientes },
    tickets: { titulo: 'Tickets', cargar: cargarTickets },
    reclamos: { titulo: 'Libro de Reclamaciones', cargar: cargarReclamos },
    actividad: { titulo: 'Actividad', cargar: cargarActividad },
    equipo: { titulo: 'Equipo', cargar: cargarEquipo, soloAdmin: true }
  };

  function iniciarPanel() {
    const u = S.usuario || {};
    $('#barraUsuario').textContent = (u.nombre || u.usuario || '') + (u.rol === 'admin' ? ' (administrador)' : '');
    $('#tabEquipo').hidden = !esAdmin();
    $('#bloqueSync').hidden = !esAdmin();
    mostrarVista('panel');
    cargarResumen();
    ruta(false);
  }

  function tabDesdeHash() {
    let h = '';
    try { h = decodeURIComponent(location.hash.slice(1)); } catch (e) { h = ''; }
    if (Object.prototype.hasOwnProperty.call(TABS, h) && (!TABS[h].soloAdmin || esAdmin())) return h;
    return 'solicitudes';
  }

  function ruta(delUsuario) {
    if (S.vista !== 'panel') return;
    const t = tabDesdeHash();
    if (location.hash !== '#' + t) history.replaceState(null, '', '#' + t);
    S.tab = t;
    $$('.pestanas a').forEach(function (a) {
      if (a.dataset.tab === t) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    $$('[data-panel]').forEach(function (p) { p.hidden = p.dataset.panel !== t; });
    document.title = TABS[t].titulo + ' | Panel C4V';
    TABS[t].cargar();
    if (delUsuario) focoTab();
  }
  function focoTab() {
    const h = S.tab && $('[data-panel="' + S.tab + '"] h2');
    if (h && S.vista === 'panel') h.focus({ preventScroll: true });
  }
  window.addEventListener('hashchange', function () { ruta(true); });
  /* Clic en la pestaña que ya está abierta: recarga. */
  $$('.pestanas a').forEach(function (a) {
    a.addEventListener('click', function () {
      if (a.dataset.tab === S.tab) { TABS[S.tab].cargar(); cargarResumen(); }
    });
  });
  $$('[data-recargar]').forEach(function (b) {
    b.addEventListener('click', function () {
      const t = TABS[b.dataset.recargar];
      if (t) t.cargar();
      cargarResumen();
    });
  });

  /* Tras aprobar, rechazar, revocar, responder…: resumen y lista al día. */
  function trasCambio() {
    cargarResumen();
    if (S.tab && TABS[S.tab]) TABS[S.tab].cargar();
  }

  /* ---------- Resumen ---------- */
  async function cargarResumen() {
    const n = ++S.resSeq;
    try {
      const r = await api('GET', '/api/admin/resumen');
      if (n !== S.resSeq) return;
      pintarResumen(r);
      $('#resError').hidden = true;
    } catch (err) {
      if (err.sesion || n !== S.resSeq) return;
      $('#resError').textContent = 'No se pudo cargar el resumen. ' + err.message;
      $('#resError').hidden = false;
    }
  }

  function pintarResumen(r) {
    $('#resSolicitudes').textContent = numero(r.solicitudes_pendientes);
    $('#resAccesos').textContent = numero(r.accesos_activos);
    $('#resElegibles').textContent = numero(r.clientes_elegibles);
    $('#resElegiblesEt').textContent = 'clientes con acceso automático' +
      (r.clientes_elegibles_con_telefono !== undefined && r.clientes_elegibles_con_telefono !== null
        ? ', ' + numero(r.clientes_elegibles_con_telefono) + ' con celular' : '');

    const pend = Number(r.reclamos_pendientes) || 0;
    const venc = Number(r.reclamos_vencidos) || 0;
    $('#resReclamos').textContent = numero(r.reclamos_pendientes);
    const et = $('#resReclamosEt');
    et.replaceChildren(pend === 1 ? 'reclamo por responder' : 'reclamos por responder');
    if (venc > 0) poner(et, [', ', el('strong', null, venc === 1 ? '1 vencido' : fNum.format(venc) + ' vencidos')]);
    $('#resReclamosItem').classList.toggle('res-urgente', venc > 0);

    const sync = $('#resSync');
    sync.textContent = r.ultimo_sync ? hace(r.ultimo_sync) : 'Nunca';
    if (r.ultimo_sync) sync.title = fechaHora(r.ultimo_sync); else sync.removeAttribute('title');

    const sol = Number(r.solicitudes_pendientes) || 0;
    const cs = $('#contSolicitudes');
    cs.hidden = sol <= 0;
    cs.replaceChildren(fNum.format(sol), el('span', { class: 'sr' }, sol === 1 ? ' pendiente' : ' pendientes'));
    const cr = $('#contReclamos');
    cr.hidden = venc <= 0;
    cr.replaceChildren(fNum.format(venc), el('span', { class: 'sr' }, venc === 1 ? ' vencido' : ' vencidos'));
  }

  /* ---------- Piezas comunes de las listas ---------- */
  function listaOcupada(lista, info) {
    lista.setAttribute('aria-busy', 'true');
    if (!lista.childElementCount) { info.className = 'lista-info'; info.replaceChildren('Cargando…'); }
  }
  function listaLista(lista) { lista.removeAttribute('aria-busy'); }
  function infoTexto(info, texto, vacia) {
    info.className = 'lista-info' + (vacia ? ' vacia' : '');
    info.replaceChildren(texto);
  }
  function infoError(info, err, reintentar) {
    if (err.sesion) return;
    info.className = 'lista-info';
    info.replaceChildren(el('div', { class: 'error' },
      el('span', null, err.message),
      reintentar && el('button', { class: 'btn btn-chico', type: 'button', on: { click: reintentar } }, 'Reintentar')));
  }

  function pares(items, clase) {
    const dl = el('dl', { class: 'pares' + (clase ? ' ' + clase : '') });
    items.forEach(function (it) {
      if (!it) return;
      const v = it[1];
      if (v === undefined || v === null || v === '' || v === false || (Array.isArray(v) && !v.length)) return;
      dl.appendChild(el('div', { class: it[2] ? 'ancho' : null }, el('dt', null, it[0]), el('dd', null, v)));
    });
    return dl.childElementCount ? dl : null;
  }
  function chip(texto, tipo) { return el('span', { class: 'chip' + (tipo ? ' chip-' + tipo : '') }, texto); }
  function meta(etiqueta, valor) { return valor ? el('span', null, etiqueta + ' ', el('b', null, valor)) : null; }
  function quien(nombre, cuando) {
    const partes = [];
    if (nombre) partes.push(nombre);
    if (cuando) partes.push(fechaHora(cuando));
    return partes.join(', ');
  }
  function textoMaquina(m) {
    if (!m) return '';
    if (typeof m === 'string' || typeof m === 'number') return String(m);
    return [m.modelo || 'Máquina', m.serie ? 'serie ' + m.serie : '', m.pedido ? 'pedido ' + m.pedido : ''].filter(Boolean).join(', ');
  }

  /* Un cliente de Odoo, sea candidato de una solicitud o resultado de búsqueda. */
  function fichaCliente(c) {
    const maqs = arr(c.maquinas).map(textoMaquina).filter(Boolean);
    const tels = arr(c.telefonos);
    const pedido = c.pedido || arr(c.pedidos).join(', ');
    const comprobante = c.comprobante || arr(c.comprobantes).join(', ');
    const chips = el('span', { class: 'chips' },
      c.es_cliente_maquina ? chip('Acceso automático', 'ok') : chip('Sin acceso automático'),
      c.coincide_telefono === true ? chip('Mismo celular', 'info') : null,
      c.coincide_telefono === false ? chip('Celular distinto') : null,
      c.via ? chip(VIA[c.via] || c.via) : null);
    return frag(
      el('span', { class: 'cand-cab' }, el('span', { class: 'cand-nombre' }, c.nombre || 'Sin nombre'), chips),
      el('span', { class: 'linea-meta' },
        meta('Documento', c.documento),
        meta('Pedido', pedido),
        meta('Comprobante', comprobante),
        meta('Empresa', c.empresa),
        meta(maqs.length === 1 ? 'Máquina' : 'Máquinas', maqs.join('; ')),
        meta(tels.length === 1 ? 'Celular' : 'Celulares', tels.join(', '))));
  }

  /* ================= Diálogo ================= */
  const dlg = $('#dlg');
  let alCerrarDlg = null;

  function abrirDialogo(titulo, contenido, opc) {
    opc = opc || {};
    $('#dlgTitulo').textContent = titulo;
    $('#dlgCuerpo').replaceChildren(contenido);
    alCerrarDlg = opc.alCerrar || null;
    if (!dlg.open) {
      S.focoAntes = document.activeElement;
      dlg.showModal();
    }
    dlg.scrollTop = 0;
    const primero = opc.foco || $('#dlgCuerpo').querySelector('input:not([type=hidden]):not([readonly]):not([disabled]), textarea:not([readonly]), select');
    (primero || $('#dlgCerrar')).focus();
  }
  function dialogoOcupado() { return !!dlg.querySelector('[aria-busy="true"]'); }
  function cerrarDialogo() { if (!dialogoOcupado()) dlg.close(); }
  $('#dlgCerrar').addEventListener('click', cerrarDialogo);
  dlg.addEventListener('cancel', function (e) { if (dialogoOcupado()) e.preventDefault(); });
  dlg.addEventListener('close', function () {
    $('#dlgCuerpo').replaceChildren();   // la contraseña temporal no se queda en la página
    const f = alCerrarDlg;
    alCerrarDlg = null;
    if (f) f();
    const antes = S.focoAntes;
    S.focoAntes = null;
    if (antes && antes.isConnected && !antes.closest('[hidden]') && typeof antes.focus === 'function') antes.focus();
    else focoTab();
  });

  function campo(o) {
    const input = o.area
      ? el('textarea', { class: 'input', id: o.id, rows: o.filas || 4, maxlength: o.max, placeholder: o.placeholder })
      : el('input', {
        class: 'input', id: o.id, type: o.tipo || 'text', maxlength: o.max, placeholder: o.placeholder,
        autocomplete: o.autocompletar || 'off', inputmode: o.inputmode, autocapitalize: o.autocapitalize,
        spellcheck: o.spellcheck
      });
    if (o.valor) input.value = o.valor;
    if (o.requerido) input.required = true;
    const idAyuda = o.ayuda ? o.id + 'Ayuda' : null;
    if (idAyuda) input.setAttribute('aria-describedby', idAyuda);
    const nodo = el('div', { class: 'campo' },
      el('label', { for: o.id }, o.etiqueta, o.opcional ? el('span', { class: 'opcional' }, ' (opcional)') : null),
      input,
      o.ayuda ? el('p', { class: 'ayuda', id: idAyuda }, o.ayuda) : null);
    return { nodo: nodo, input: input, valor: function () { return input.value.trim(); } };
  }
  function botonesDialogo(principal, textoCancelar) {
    return el('div', { class: 'dlg-acciones' },
      principal,
      el('button', { class: 'btn', type: 'button', on: { click: cerrarDialogo } }, textoCancelar || 'Cancelar'));
  }

  async function copiar(texto) {
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(texto); return true; }
    } catch (e) { /* sigue con el plan B */ }
    try {
      const ta = el('textarea', { class: 'sr', readonly: true, 'aria-hidden': 'true' });
      ta.value = texto;
      (dlg.open ? dlg : document.body).appendChild(ta);   // dentro del diálogo: lo de afuera está inerte
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (e) { return false; }
  }
  function botonCopiar(texto, etiqueta) {
    const b = el('button', { class: 'btn', type: 'button' }, etiqueta);
    let reloj = null;
    b.addEventListener('click', async function () {
      const ok = await copiar(texto);
      b.textContent = ok ? 'Copiado' : 'No se pudo copiar: selecciónalo a mano';
      clearTimeout(reloj);
      reloj = setTimeout(function () { b.textContent = etiqueta; }, 2500);
    });
    return b;
  }

  /* Resultado de una acción, con el mensaje listo para enviar a la persona. */
  function vistaResultado(o) {
    const cont = el('div', { class: 'resultado' });
    cont.appendChild(el('p', { class: 'resultado-ok' }, o.mensaje));
    if (o.extra) cont.appendChild(o.extra);
    const acciones = el('div', { class: 'dlg-acciones' });
    const aviso = o.aviso;
    if (aviso && typeof aviso.texto === 'string' && aviso.texto) {
      const ta = el('textarea', { class: 'input texto-cliente', id: 'txtAviso', readonly: true, rows: 7 });
      ta.value = aviso.texto;
      cont.appendChild(el('div', { class: 'campo' }, el('label', { for: 'txtAviso' }, 'Mensaje para avisarle'), ta));
      const wa = urlSegura(aviso.wa_link, PREFIJO_WA);
      if (wa) acciones.appendChild(enlace(wa, 'Avisar por WhatsApp', 'btn btn-wa'));
      else cont.appendChild(el('p', { class: 'ayuda' }, 'No hay enlace de WhatsApp para este número. Copia el mensaje y envíalo tú.'));
      acciones.appendChild(botonCopiar(aviso.texto, 'Copiar texto'));
    }
    acciones.appendChild(el('button', { class: 'btn', type: 'button', on: { click: cerrarDialogo } }, 'Listo'));
    cont.appendChild(acciones);
    abrirDialogo(o.titulo, cont, { foco: acciones.firstChild });
  }

  /* ---------- Selector de cliente: nunca elige solo ---------- */
  let selSeq = 0;
  function selectorCliente(o) {
    const grupo = 'sel' + (++selSeq);
    const candidatos = arr(o.candidatos);
    let elegido = o.preelegido || null;
    const elegidoTxt = el('p', { class: 'elegido', 'aria-live': 'polite' });

    function actualizar() {
      if (elegido) {
        elegidoTxt.className = 'elegido listo';
        elegidoTxt.replaceChildren('Se vinculará a ', el('strong', null, elegido.nombre || 'Sin nombre'),
          elegido.documento ? ' (' + elegido.documento + ')' : '', '.');
      } else {
        elegidoTxt.className = 'elegido';
        elegidoTxt.replaceChildren('Todavía no elegiste un cliente.');
      }
      if (o.alCambiar) o.alCambiar(elegido);
    }
    function opcion(c, marcado) {
      const id = grupo + '-' + (++selSeq);
      const input = el('input', { type: 'radio', name: grupo, id: id, value: String(c.odoo_partner_id), checked: marcado });
      input.addEventListener('change', function () { if (input.checked) { elegido = c; actualizar(); } });
      return el('label', { class: 'opcion', for: id }, input, el('span', null, fichaCliente(c)));
    }

    const q = el('input', {
      class: 'input', id: grupo + 'q', type: 'search', autocomplete: 'off', spellcheck: 'false',
      placeholder: 'Nombre, DNI/RUC, celular, pedido o comprobante'
    });
    const btnBuscar = el('button', { class: 'btn', type: 'button' }, 'Buscar');
    const estado = el('p', { class: 'ayuda', role: 'status' });
    const resultados = el('div', { class: 'opciones' });

    async function buscar() {
      const t = q.value.trim();
      if (t.length < 2) { estado.textContent = 'Escribe al menos 2 letras o números.'; q.focus(); return; }
      await ocupado(btnBuscar, 'Buscando…', async function () {
        try {
          const r = await api('GET', '/api/admin/clientes?q=' + enc(t));
          const cs = arr(r.clientes);
          resultados.replaceChildren.apply(resultados, cs.map(function (c) {
            return opcion(c, !!(elegido && String(elegido.odoo_partner_id) === String(c.odoo_partner_id) && !candidatos.includes(elegido)));
          }));
          estado.textContent = cs.length
            ? pl(cs.length, 'resultado', 'resultados') + '. Elige uno.' + (cs.length >= 30 ? ' Se muestran los primeros 30.' : '')
            : 'Sin resultados. Prueba con otro dato.';
          /* Si el elegido venía de una búsqueda anterior y ya no está en pantalla, se suelta. */
          if (elegido && !nodo.querySelector('input[name="' + grupo + '"]:checked')) { elegido = null; actualizar(); }
        } catch (err) {
          if (!err.sesion) estado.textContent = err.message;
        }
      });
    }
    q.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); buscar(); } });
    btnBuscar.addEventListener('click', buscar);

    const nodo = el('fieldset', { class: 'selector' },
      el('legend', null, o.leyenda || '¿De qué cliente es?'),
      candidatos.length
        ? [el('p', { class: 'sel-grupo-et' }, o.etiquetaSugeridos || (candidatos.length === 1 ? 'Sugerido por la referencia' : 'Sugeridos por la referencia')),
          el('div', { class: 'opciones' }, candidatos.map(function (c) { return opcion(c, c === o.preelegido); }))]
        : el('p', { class: 'ayuda' }, o.textoSinSugeridos || 'No hay clientes sugeridos. Búscalo aquí abajo.'),
      el('label', { class: 'sel-grupo-et', for: grupo + 'q' }, candidatos.length ? 'O busca otro cliente' : 'Buscar cliente'),
      el('div', { class: 'sel-buscar' }, q, btnBuscar),
      estado,
      resultados,
      elegidoTxt);

    return {
      nodo: nodo,
      valor: function () { return elegido; },
      iniciar: actualizar
    };
  }

  /* ================= Solicitudes ================= */
  const NOMBRE_SOL = {
    pendiente: ['solicitud pendiente', 'solicitudes pendientes'],
    aprobada: ['solicitud aprobada', 'solicitudes aprobadas'],
    rechazada: ['solicitud rechazada', 'solicitudes rechazadas'],
    todas: ['solicitud', 'solicitudes']
  };
  const VACIO_SOL = {
    pendiente: 'No hay solicitudes pendientes. Cuando alguien pida acceso desde el portal, aparecerá aquí.',
    aprobada: 'Todavía no hay solicitudes aprobadas.',
    rechazada: 'No hay solicitudes rechazadas.',
    todas: 'Todavía no llegó ninguna solicitud.'
  };

  async function cargarSolicitudes() {
    const st = S.sol;
    const n = ++st.seq;
    const lista = $('#listaSolicitudes');
    const info = $('#infoSolicitudes');
    listaOcupada(lista, info);
    try {
      const r = await api('GET', '/api/admin/solicitudes?estado=' + enc(st.estado));
      if (n !== st.seq) return;
      st.lista = arr(r.solicitudes);
      lista.replaceChildren.apply(lista, st.lista.map(filaSolicitud));
      const nom = NOMBRE_SOL[st.estado] || NOMBRE_SOL.todas;
      if (!st.lista.length) infoTexto(info, VACIO_SOL[st.estado] || VACIO_SOL.todas, true);
      else infoTexto(info, pl(st.lista.length, nom[0], nom[1]));
    } catch (err) {
      if (n === st.seq) infoError(info, err, cargarSolicitudes);
    } finally {
      if (n === st.seq) listaLista(lista);
    }
  }
  $$('input[name="solEstado"]').forEach(function (r) {
    r.addEventListener('change', function () { if (r.checked) { S.sol.estado = r.value; $('#listaSolicitudes').replaceChildren(); cargarSolicitudes(); } });
  });

  function alertaYaTiene(y) {
    if (!y) return null;
    const como = y.tipo === 'titular' ? 'titular' : 'persona autorizada';
    return el('p', { class: 'alerta' },
      'Este celular ya entra al portal como ' + como + ' de ', el('strong', null, y.cliente_nombre || 'otro cliente'),
      '. Revisa antes de aprobar: no puede tener acceso activo a dos fichas.');
  }

  function filaSolicitud(s) {
    const pendiente = s.estado === 'pendiente';
    const li = el('li', { class: 'fila' + (pendiente ? '' : ' fila-apagada'), 'data-id': s.id });
    li.appendChild(el('div', { class: 'fila-cab' },
      el('h3', { class: 'fila-titulo' }, s.nombre || 'Sin nombre'),
      !pendiente ? chip(ESTADO_SOL[s.estado] || s.estado, s.estado === 'aprobada' ? 'ok' : null) : null,
      Number(s.veces) > 1 ? chip('La envió ' + s.veces + ' veces', 'alerta') : null,
      el('span', { class: 'fila-fecha' }, 'Recibida ' + hace(s.creado_en) + ' (' + fechaHora(s.creado_en) + ')')));

    const izq = el('div', null,
      pares([
        ['Celular', celular(s.telefono, s.telefono_e164)],
        ['País', PAISES[s.pais] || s.pais],
        ['Referencia que escribió', s.referencia ? el('span', { class: 'mono' }, s.referencia) : null],
        ['Comentario', s.comentario ? el('p', { class: 'cita' }, s.comentario) : null, true]
      ]),
      pendiente ? alertaYaTiene(s.ya_tiene_acceso) : null,
      resolucion(s),
      pendiente ? bloqueSugerencia(s) : null);

    let acciones = null;
    if (pendiente) {
      acciones = el('div', { class: 'acciones acciones-col' },
        el('button', { class: 'btn btn-oscuro', type: 'button', on: { click: function () { dialogoAprobar(s); } } }, 'Aprobar'),
        el('button', { class: 'btn', type: 'button', on: { click: function () { dialogoRechazar(s); } } }, 'Rechazar'),
        el('button', { class: 'btn btn-texto', type: 'button', 'data-accion': 'buscar', on: { click: function (e) { buscarDeNuevo(s, e.currentTarget); } } }, 'Buscar de nuevo'));
    }
    li.appendChild(el('div', { class: 'fila-cuerpo' }, izq, acciones));
    return li;
  }

  function resolucion(s) {
    if (s.estado === 'pendiente') return null;
    const verbo = s.estado === 'aprobada' ? 'Aprobada' : s.estado === 'rechazada' ? 'Rechazada' : 'Resuelta';
    return el('div', { class: 'linea-meta' },
      el('span', null, verbo + (s.revisado_por ? ' por ' : ''), s.revisado_por ? el('b', null, s.revisado_por) : null,
        s.resuelto_en ? ', ' + fechaHora(s.resuelto_en) : ''),
      s.estado === 'aprobada' && s.cliente_nombre ? meta('Vinculada a', s.cliente_nombre) : null,
      s.nota ? meta('Nota:', s.nota) : null);
  }

  function bloqueSugerencia(s) {
    const sug = s.sugerencia || {};
    const cands = arr(sug.candidatos);
    const titulo = cands.length === 0 ? 'Ningún cliente coincide con la referencia'
      : cands.length === 1 ? 'Posible cliente' : cands.length + ' posibles clientes';
    return el('div', { class: 'sugerencia' },
      el('div', { class: 'sug-cab' },
        el('p', { class: 'sug-titulo' }, titulo),
        sug.buscado_en ? el('p', { class: 'sug-pie', title: fechaHora(sug.buscado_en) }, 'Buscado ' + hace(sug.buscado_en)) : null),
      cands.length
        ? el('ul', { class: 'candidatos' }, cands.map(function (c) { return el('li', { class: 'candidato' }, fichaCliente(c)); }))
        : el('p', { class: 'sug-vacio' }, 'Prueba con “Buscar de nuevo”, que también busca en Odoo, o busca el cliente por nombre o documento al aprobar.'));
  }

  async function buscarDeNuevo(s, boton) {
    await ocupado(boton, 'Buscando…', async function () {
      try {
        const r = await api('POST', '/api/admin/solicitudes/' + enc(s.id) + '/buscar', {}, { espera: 60000 });
        s.sugerencia = r.sugerencia || { candidatos: [] };
        const viejo = boton.closest('li.fila');
        if (viejo && viejo.isConnected) {
          const nuevo = filaSolicitud(s);
          viejo.replaceWith(nuevo);
          const b = nuevo.querySelector('[data-accion="buscar"]');
          if (b) b.focus();
        }
        const n = arr(s.sugerencia.candidatos).length;
        nota(n ? 'Búsqueda lista: ' + pl(n, 'posible cliente', 'posibles clientes') + '.' : 'Búsqueda lista: ningún cliente coincide.');
      } catch (err) {
        if (!err.sesion) nota(err.message, true);
      }
    });
  }

  function resumenSolicitud(s) {
    return el('div', { class: 'dlg-resumen' },
      el('p', null, el('strong', null, s.nombre || 'Sin nombre')),
      pares([
        ['Celular', s.telefono || s.telefono_e164],
        ['Referencia que escribió', s.referencia ? el('span', { class: 'mono' }, s.referencia) : null],
        ['Comentario', s.comentario ? el('p', { class: 'cita' }, s.comentario) : null, true]
      ]));
  }

  function dialogoAprobar(s) {
    const error = el('p', { class: 'error', role: 'alert', hidden: true });
    const boton = el('button', { class: 'btn btn-primario', type: 'submit', disabled: true }, 'Aprobar acceso');
    const sel = selectorCliente({
      candidatos: arr(s.sugerencia && s.sugerencia.candidatos),
      leyenda: '¿De qué cliente es este celular?',
      alCambiar: function (c) { boton.disabled = !c; }
    });
    const relacion = campo({ id: 'apRelacion', etiqueta: 'Relación con el cliente', opcional: true, max: 80,
      ayuda: 'Por ejemplo: hijo del dueño, socia, operario del taller.' });
    const notaI = campo({ id: 'apNota', etiqueta: 'Nota interna', opcional: true, area: true, filas: 3, max: 500,
      ayuda: 'Solo la ve el equipo.' });
    const form = el('form', { class: 'dlg-form', method: 'post', novalidate: true },
      resumenSolicitud(s),
      alertaYaTiene(s.ya_tiene_acceso),
      sel.nodo, relacion.nodo, notaI.nodo, error,
      botonesDialogo(boton));
    sel.iniciar();
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      const c = sel.valor();
      ocultar(error);
      if (!c) { mostrarError(error, 'Elige a qué cliente pertenece este celular.'); return; }
      await ocupado(boton, 'Aprobando…', async function () {
        try {
          const r = await api('POST', '/api/admin/solicitudes/' + enc(s.id) + '/aprobar', limpio({
            odoo_partner_id: c.odoo_partner_id,
            relacion: relacion.valor(),
            nota: notaI.valor()
          }));
          vistaResultado({
            titulo: 'Acceso aprobado',
            mensaje: conPunto((s.nombre || 'La persona') + ' ya puede entrar al portal con su celular y ver la ficha de ' + (c.nombre || 'ese cliente')),
            aviso: r.aviso
          });
          trasCambio();
        } catch (err) {
          mostrarError(error, err);
        }
      });
    });
    abrirDialogo('Aprobar acceso', form);
  }

  function dialogoRechazar(s) {
    const error = el('p', { class: 'error', role: 'alert', hidden: true });
    const boton = el('button', { class: 'btn btn-primario', type: 'submit' }, 'Rechazar solicitud');
    const notaI = campo({ id: 'reNota', etiqueta: 'Nota interna', opcional: true, area: true, filas: 3, max: 500,
      ayuda: 'Por qué se rechaza. Solo la ve el equipo.' });
    const form = el('form', { class: 'dlg-form', method: 'post', novalidate: true },
      resumenSolicitud(s),
      el('p', { class: 'dlg-texto' }, 'La persona no podrá entrar con este celular. Si vuelve a pedir acceso, llegará como una solicitud nueva.'),
      notaI.nodo, error,
      botonesDialogo(boton));
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      ocultar(error);
      await ocupado(boton, 'Rechazando…', async function () {
        try {
          const r = await api('POST', '/api/admin/solicitudes/' + enc(s.id) + '/rechazar', { nota: notaI.valor() });
          vistaResultado({
            titulo: 'Solicitud rechazada',
            mensaje: conPunto('Rechazaste la solicitud de ' + (s.nombre || 'esta persona')),
            aviso: r.aviso
          });
          trasCambio();
        } catch (err) {
          mostrarError(error, err);
        }
      });
    });
    abrirDialogo('Rechazar solicitud', form);
  }

  /* ================= Accesos ================= */
  async function cargarAccesos() {
    const st = S.acc;
    const n = ++st.seq;
    const lista = $('#listaAccesos');
    const info = $('#infoAccesos');
    listaOcupada(lista, info);
    try {
      const r = await api('GET', '/api/admin/accesos?estado=' + enc(st.estado));
      if (n !== st.seq) return;
      st.lista = arr(r.accesos);
      lista.replaceChildren.apply(lista, st.lista.map(filaAcceso));
      if (!st.lista.length) {
        infoTexto(info, st.estado === 'activos'
          ? 'Nadie tiene acceso aprobado todavía. Se crean al aprobar una solicitud o con “Dar acceso”.'
          : 'No hay accesos revocados.', true);
      } else {
        infoTexto(info, st.estado === 'activos'
          ? pl(st.lista.length, 'acceso activo', 'accesos activos')
          : pl(st.lista.length, 'acceso revocado', 'accesos revocados'));
      }
    } catch (err) {
      if (n === st.seq) infoError(info, err, cargarAccesos);
    } finally {
      if (n === st.seq) listaLista(lista);
    }
  }
  $$('input[name="accEstado"]').forEach(function (r) {
    r.addEventListener('change', function () { if (r.checked) { S.acc.estado = r.value; $('#listaAccesos').replaceChildren(); cargarAccesos(); } });
  });
  $('#btnDarAcceso').addEventListener('click', function () { dialogoDarAcceso(null); });

  function filaAcceso(a) {
    const activo = a.activo !== false && !a.revocado_en;
    const li = el('li', { class: 'fila' + (activo ? '' : ' fila-apagada') });
    li.appendChild(el('div', { class: 'fila-cab' },
      el('h3', { class: 'fila-titulo' }, a.nombre || 'Sin nombre'),
      a.origen ? chip(ORIGEN[a.origen] || a.origen) : null,
      activo ? null : chip('Revocado'),
      a.aprobado_en ? el('span', { class: 'fila-fecha', title: fechaHora(a.aprobado_en) }, 'Desde el ' + fecha(a.aprobado_en)) : null));
    const izq = pares([
      ['Celular', celular(a.telefono, a.telefono_e164)],
      ['Relación', a.relacion],
      ['Cliente', a.cliente_nombre],
      ['Aprobado por', quien(a.aprobado_por, a.aprobado_en)],
      activo ? null : ['Revocado por', quien(a.revocado_por, a.revocado_en)],
      ['Nota', a.nota, true]
    ]);
    const acciones = activo
      ? el('div', { class: 'acciones' },
        el('button', { class: 'btn btn-peligro', type: 'button', on: { click: function () { dialogoRevocar(a); } } }, 'Revocar'))
      : null;
    li.appendChild(el('div', { class: 'fila-cuerpo' }, izq, acciones));
    return li;
  }

  function dialogoRevocar(a) {
    const error = el('p', { class: 'error', role: 'alert', hidden: true });
    const boton = el('button', { class: 'btn btn-primario', type: 'submit' }, 'Revocar acceso');
    const notaI = campo({ id: 'rvNota', etiqueta: 'Nota interna', opcional: true, area: true, filas: 3, max: 500,
      ayuda: 'Por qué se revoca. Solo la ve el equipo.' });
    const form = el('form', { class: 'dlg-form', method: 'post', novalidate: true },
      el('div', null,
        el('p', { class: 'dlg-texto' }, el('strong', null, a.nombre || 'Esta persona'), ' ya no podrá entrar al portal con el ',
          a.telefono || a.telefono_e164 || 'celular registrado', '.'),
        el('p', { class: 'dlg-texto' }, 'Si ahora mismo tiene el portal abierto, su sesión se cierra al instante. ',
          a.cliente_nombre ? 'La cuenta de ' + a.cliente_nombre + ' y los demás accesos no cambian.' : 'Los demás accesos no cambian.')),
      notaI.nodo, error,
      botonesDialogo(boton));
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      ocultar(error);
      await ocupado(boton, 'Revocando…', async function () {
        try {
          await api('POST', '/api/admin/accesos/' + enc(a.id) + '/revocar', limpio({ nota: notaI.valor() }));
          alCerrarDlg = null;
          dlg.close();
          nota(conPunto('Revocaste el acceso de ' + (a.nombre || 'la persona')));
          trasCambio();
        } catch (err) {
          mostrarError(error, err);
        }
      });
    });
    abrirDialogo('Revocar acceso', form);
  }

  function dialogoDarAcceso(clientePre) {
    const error = el('p', { class: 'error', role: 'alert', hidden: true });
    const boton = el('button', { class: 'btn btn-primario', type: 'submit', disabled: !clientePre }, 'Dar acceso');
    const pais = el('select', { class: 'input', id: 'daPais' },
      ORDEN_PAISES.map(function (c) { return el('option', { value: c }, PAISES[c] + ' (+' + PREFIJOS[c] + ')'); }));
    if (clientePre && PREFIJOS[clientePre.pais]) pais.value = clientePre.pais;
    const tel = campo({ id: 'daTel', etiqueta: 'Celular', tipo: 'tel', inputmode: 'tel', autocompletar: 'off', max: 20,
      ayuda: 'Sin el código de país. Ejemplo: 995 547 575.' });
    const nombre = campo({ id: 'daNombre', etiqueta: 'Nombre de la persona', max: 120, autocompletar: 'off' });
    const relacion = campo({ id: 'daRelacion', etiqueta: 'Relación con el cliente', opcional: true, max: 80,
      ayuda: 'Por ejemplo: hijo del dueño, socia, operario del taller.' });
    const sel = selectorCliente({
      candidatos: clientePre ? [clientePre] : [],
      preelegido: clientePre,
      etiquetaSugeridos: 'Cliente elegido',
      textoSinSugeridos: 'Busca al cliente que compró la máquina.',
      leyenda: '¿A qué cliente representa?',
      alCambiar: function (c) { boton.disabled = !c; }
    });
    const form = el('form', { class: 'dlg-form', method: 'post', novalidate: true },
      el('p', { class: 'dlg-texto' }, 'La persona entrará al portal con su celular y verá lo mismo que el cliente, con el documento enmascarado.'),
      el('div', { class: 'fila-campos' },
        el('div', { class: 'campo' }, el('label', { for: 'daPais' }, 'País'), pais),
        tel.nodo),
      nombre.nodo, relacion.nodo, sel.nodo, error,
      botonesDialogo(boton));
    sel.iniciar();
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      ocultar(error);
      [tel.input, nombre.input].forEach(function (i) { i.removeAttribute('aria-invalid'); });
      const c = sel.valor();
      const digitos = tel.valor().replace(/\D/g, '');
      if (digitos.length < 7) { tel.input.setAttribute('aria-invalid', 'true'); mostrarError(error, 'Escribe el número de celular completo.'); tel.input.focus(); return; }
      if (nombre.valor().length < 3) { nombre.input.setAttribute('aria-invalid', 'true'); mostrarError(error, 'Escribe el nombre de la persona.'); nombre.input.focus(); return; }
      if (!c) { mostrarError(error, 'Elige a qué cliente representa.'); return; }
      await ocupado(boton, 'Guardando…', async function () {
        try {
          const r = await api('POST', '/api/admin/accesos', limpio({
            pais: pais.value,
            telefono: digitos,
            odoo_partner_id: c.odoo_partner_id,
            nombre: nombre.valor(),
            relacion: relacion.valor()
          }));
          const numeroTxt = (r.acceso && r.acceso.telefono) || '+' + PREFIJOS[pais.value] + ' ' + digitos;
          vistaResultado({
            titulo: 'Acceso creado',
            mensaje: conPunto(nombre.valor() + ' ya puede entrar al portal con el ' + numeroTxt + ' y ver la ficha de ' + (c.nombre || 'ese cliente')),
            aviso: r.aviso
          });
          trasCambio();
        } catch (err) {
          mostrarError(error, err);
        }
      });
    });
    abrirDialogo('Dar acceso', form, { foco: tel.input });
  }

  /* ================= Clientes ================= */
  function cargarClientes() {
    if (S.cli.buscado) buscarClientes();
    else if (!$('#listaClientes').childElementCount) {
      infoTexto($('#infoClientes'), 'Escribe un nombre, DNI/RUC, celular, pedido o comprobante y pulsa Buscar.', true);
    }
  }

  async function buscarClientes() {
    const st = S.cli;
    const lista = $('#listaClientes');
    const info = $('#infoClientes');
    if (!st.q && !st.solo) {
      st.buscado = false;
      lista.replaceChildren();
      infoTexto(info, 'Escribe un nombre, DNI/RUC, celular, pedido o comprobante y pulsa Buscar.', true);
      return;
    }
    if (st.q && st.q.length < 2) { infoTexto(info, 'Escribe al menos 2 letras o números.'); return; }
    st.buscado = true;
    const n = ++st.seq;
    listaOcupada(lista, info);
    const boton = $('#cliBuscar');
    boton.disabled = true;
    boton.setAttribute('aria-busy', 'true');
    try {
      const r = await api('GET', '/api/admin/clientes?q=' + enc(st.q) + (st.solo ? '&solo_elegibles=1' : ''));
      if (n !== st.seq) return;
      const cs = arr(r.clientes);
      lista.replaceChildren.apply(lista, cs.map(filaCliente));
      if (!cs.length) infoTexto(info, 'No hay clientes con ese dato' + (st.solo ? ' entre los que tienen acceso automático' : '') + '.', true);
      else infoTexto(info, pl(cs.length, 'cliente', 'clientes') + (cs.length >= 30 ? '. Se muestran los primeros 30: afina la búsqueda si no está el que buscas.' : ''));
    } catch (err) {
      if (n === st.seq) infoError(info, err, buscarClientes);
    } finally {
      if (n === st.seq) listaLista(lista);
      boton.disabled = false;
      boton.removeAttribute('aria-busy');
    }
  }
  $('#formClientes').addEventListener('submit', function (e) {
    e.preventDefault();
    S.cli.q = $('#cliQ').value.trim();
    S.cli.solo = $('#cliSoloElegibles').checked;
    buscarClientes();
  });
  $('#cliSoloElegibles').addEventListener('change', function () {
    S.cli.solo = $('#cliSoloElegibles').checked;
    S.cli.q = $('#cliQ').value.trim();
    if (S.cli.buscado || S.cli.solo) buscarClientes();
  });

  function filaCliente(c) {
    const li = el('li', { class: 'fila' });
    const maqs = arr(c.maquinas);
    const evid = arr(c.evidencia);
    const accesos = Number(c.accesos_activos) || 0;
    li.appendChild(el('div', { class: 'fila-cab' },
      el('h3', { class: 'fila-titulo' }, c.nombre || 'Sin nombre'),
      el('span', { class: 'chips' },
        c.es_cliente_maquina ? chip('Acceso automático', 'ok') : chip('Sin acceso automático'),
        c.source === 'manual' ? chip('Cuenta manual') : null,
        accesos > 0 ? chip(accesos === 1 ? '1 persona autorizada' : accesos + ' personas autorizadas', 'info') : null),
      c.pais ? el('span', { class: 'fila-fecha' }, PAISES[c.pais] || c.pais) : null));
    const izq = pares([
      ['Documento', c.documento],
      [arr(c.telefonos).length === 1 ? 'Celular' : 'Celulares', arr(c.telefonos).join(', ')],
      ['Última compra', fecha(c.ultima_compra)],
      [maqs.length === 1 ? 'Máquina' : 'Máquinas', maqs.length ? el('ul', { class: 'maquinas' }, maqs.map(function (m) { return el('li', null, textoMaquina(m)); })) : null],
      ['Prueba de compra', evid.length ? el('span', { class: 'chips' }, evid.map(function (x) { return chip(EVIDENCIA[x] || x); })) : null],
      ['Pedidos', arr(c.pedidos).join(', ')],
      ['Comprobantes', arr(c.comprobantes).join(', ')],
      !c.es_cliente_maquina && c.excluido_motivo ? ['Por qué no entra solo', c.excluido_motivo, true] : null
    ]);
    const acciones = el('div', { class: 'acciones acciones-col' },
      enlaceOdoo(c.odoo_url, 'Ver en Odoo', 'btn'),
      el('button', { class: 'btn', type: 'button', on: { click: function () { dialogoDarAcceso(c); } } }, 'Dar acceso a alguien'));
    li.appendChild(el('div', { class: 'fila-cuerpo' }, izq || el('p', { class: 'sutil' }, 'Sin más datos.'), acciones));
    return li;
  }

  /* Sincronizar con Odoo (solo admin). Tarda de 20 a 60 s. */
  $('#btnSync').addEventListener('click', async function () {
    const boton = $('#btnSync');
    const estado = $('#syncEstado');
    const reloj = $('#syncReloj');
    const t0 = Date.now();
    estado.textContent = 'Sincronizando con Odoo. Puede tardar hasta un minuto; puedes seguir usando el panel.';
    reloj.textContent = '0 s';
    const tic = setInterval(function () { reloj.textContent = Math.round((Date.now() - t0) / 1000) + ' s'; }, 1000);
    await ocupado(boton, 'Sincronizando…', async function () {
      try {
        const r = await api('POST', '/api/admin/sync', {}, { espera: 150000 });
        const x = r.resumen || {};
        const partes = [];
        if (x.elegibles !== undefined) partes.push(numero(x.elegibles) + ' clientes con acceso automático');
        if (x.con_telefono !== undefined) partes.push(numero(x.con_telefono) + ' con celular');
        if (x.desmarcados !== undefined) partes.push(numero(x.desmarcados) + (Number(x.desmarcados) === 1 ? ' dejó de tener acceso automático' : ' dejaron de tener acceso automático'));
        estado.textContent = 'Listo' + (x.duracion_s !== undefined ? ' en ' + numero(Math.round(x.duracion_s)) + ' s' : '') + '. ' +
          (partes.length ? partes.join(', ') + '.' : '');
        cargarResumen();
        if (S.cli.buscado) buscarClientes();
      } catch (err) {
        if (!err.sesion) estado.textContent = 'No se pudo sincronizar. ' + err.message;
      } finally {
        clearInterval(tic);
        reloj.textContent = '';
      }
    });
  });

  /* ================= Tickets (Odoo, solo lectura) ================= */
  async function cargarTickets() {
    const st = S.tk;
    const n = ++st.seq;
    const lista = $('#listaTickets');
    const info = $('#infoTickets');
    listaOcupada(lista, info);
    try {
      const r = await api('GET', '/api/admin/tickets?vista=' + enc(st.vista) + (st.equipo ? '&equipo=' + enc(st.equipo) : ''), null, { espera: 45000 });
      if (n !== st.seq) return;
      pintarEquipos(arr(r.equipos));
      const ts = arr(r.tickets);
      lista.replaceChildren.apply(lista, ts.map(filaTicket));
      const cuando = r.actualizado_en ? ' ' + conPunto('Leído de Odoo a las ' + hora(r.actualizado_en)) : '';
      if (!ts.length) {
        infoTexto(info, (st.vista === 'sin_asignar' ? 'No hay tickets sin asignar.' : st.vista === 'abiertos' ? 'No hay tickets abiertos.' : 'No hay tickets.') + cuando, true);
      } else {
        infoTexto(info, pl(ts.length, 'ticket', 'tickets') + '.' + cuando);
      }
    } catch (err) {
      if (n !== st.seq || err.sesion) return;
      if (err.status === 503) {
        lista.replaceChildren();
        info.className = 'lista-info vacia';
        info.replaceChildren(el('div', { class: 'vacio-servicio' },
          el('p', null, el('strong', null, 'Odoo no responde en este momento.')),
          el('p', null, 'Los tickets se leen directo de Odoo. Prueba de nuevo en unos minutos.'),
          err.message && err.message !== MENSAJES_HTTP[503] ? el('p', { class: 'sutil' }, err.message) : null,
          el('p', null, el('button', { class: 'btn btn-chico', type: 'button', on: { click: cargarTickets } }, 'Reintentar'))));
      } else {
        infoError(info, err, cargarTickets);
      }
    } finally {
      if (n === st.seq) listaLista(lista);
    }
  }
  function pintarEquipos(equipos) {
    const sel = $('#tkEquipo');
    const actual = S.tk.equipo;
    const opciones = [el('option', { value: '' }, 'Todos los equipos')].concat(equipos.map(function (e) {
      return el('option', { value: String(e.id) }, e.nombre || 'Equipo ' + e.id);
    }));
    sel.replaceChildren.apply(sel, opciones);
    sel.value = actual;
    if (sel.value !== actual) { sel.value = ''; }
  }
  $$('input[name="tkVista"]').forEach(function (r) {
    r.addEventListener('change', function () { if (r.checked) { S.tk.vista = r.value; $('#listaTickets').replaceChildren(); cargarTickets(); } });
  });
  $('#tkEquipo').addEventListener('change', function () { S.tk.equipo = $('#tkEquipo').value; $('#listaTickets').replaceChildren(); cargarTickets(); });

  function prioridad(p) {
    let n = parseInt(p, 10);
    if (!isFinite(n) || n < 0) n = 0;
    if (n > 3) n = 3;
    return el('span', { class: 'prioridad prioridad-' + n },
      el('span', { class: 'estrellas', 'aria-hidden': 'true' }, el('b', null, '★'.repeat(n)), '☆'.repeat(3 - n)),
      el('span', { class: 'prioridad-texto' }, 'Prioridad ' + PRIORIDAD[n].toLowerCase()));
  }

  function filaTicket(t) {
    const li = el('li', { class: 'fila' + (t.cerrado ? ' fila-apagada' : '') + (Number(t.prioridad) >= 3 && !t.cerrado ? ' fila-urgente' : '') });
    li.appendChild(el('div', { class: 'fila-cab' },
      t.ref ? el('span', { class: 'fila-ref' }, t.ref) : null,
      el('h3', { class: 'fila-titulo' }, t.asunto || 'Sin asunto'),
      el('span', { class: 'fila-fecha', title: fechaHora(t.actualizado_en) }, t.actualizado_en ? 'Movido ' + hace(t.actualizado_en) : '')));
    const etiquetas = arr(t.etiquetas);
    const izq = el('div', null,
      el('div', { class: 'linea-meta' },
        prioridad(t.prioridad),
        t.etapa ? chip(t.etapa, t.cerrado ? null : 'info') : null,
        t.cerrado ? chip('Cerrado') : null,
        etiquetas.length ? el('span', { class: 'chips' }, etiquetas.map(function (x) { return chip(x); })) : null),
      pares([
        ['Cliente', t.cliente],
        ['Celular', t.telefono ? celular(t.telefono, t.telefono) : null],
        ['Equipo', t.equipo],
        ['Asignado', t.asignado ? t.asignado : el('span', { class: 'sin-asignar' }, 'Sin asignar')],
        ['Creado', fechaHora(t.creado_en)],
        ['Actualizado', fechaHora(t.actualizado_en)]
      ]));
    const acciones = el('div', { class: 'acciones' }, enlaceOdoo(t.odoo_url, 'Abrir en Odoo', 'btn'));
    li.appendChild(el('div', { class: 'fila-cuerpo' }, izq, acciones.childElementCount ? acciones : null));
    return li;
  }

  /* ================= Libro de Reclamaciones ================= */
  async function cargarReclamos() {
    const st = S.rec;
    const n = ++st.seq;
    const lista = $('#listaReclamos');
    const info = $('#infoReclamos');
    listaOcupada(lista, info);
    try {
      const r = await api('GET', '/api/admin/reclamos?estado=' + enc(st.estado));
      if (n !== st.seq) return;
      const rs = arr(r.reclamos).slice().sort(ordenReclamos);
      lista.replaceChildren.apply(lista, rs.map(filaReclamo));
      const venc = rs.filter(function (x) { return x.vencido && x.estado !== 'respondido'; }).length;
      if (!rs.length) {
        infoTexto(info, st.estado === 'pendientes' ? 'No hay reclamos por responder.' : 'Todavía no hay reclamos.', true);
      } else {
        info.className = 'lista-info';
        info.replaceChildren();
        poner(info, [pl(rs.length, st.estado === 'pendientes' ? 'hoja por responder' : 'hoja', st.estado === 'pendientes' ? 'hojas por responder' : 'hojas'),
          venc ? el('span', { class: 'plazo-vencido' }, ', ' + (venc === 1 ? '1 vencida' : venc + ' vencidas')) : null, '.']);
      }
    } catch (err) {
      if (n === st.seq) infoError(info, err, cargarReclamos);
    } finally {
      if (n === st.seq) listaLista(lista);
    }
  }
  function ordenReclamos(a, b) {
    const ra = a.estado === 'respondido' ? 1 : 0;
    const rb = b.estado === 'respondido' ? 1 : 0;
    if (ra !== rb) return ra - rb;
    if (!ra) {
      const va = a.vencido ? 0 : 1;
      const vb = b.vencido ? 0 : 1;
      if (va !== vb) return va - vb;
      const da = isFinite(Number(a.dias_restantes)) ? Number(a.dias_restantes) : 999;
      const db = isFinite(Number(b.dias_restantes)) ? Number(b.dias_restantes) : 999;
      if (da !== db) return da - db;
    }
    return String(b.creado_en || '').localeCompare(String(a.creado_en || ''));
  }
  $$('input[name="recEstado"]').forEach(function (r) {
    r.addEventListener('change', function () { if (r.checked) { S.rec.estado = r.value; $('#listaReclamos').replaceChildren(); cargarReclamos(); } });
  });

  function estadoPlazo(r) {
    if (r.estado === 'respondido') return null;
    const d = Number(r.dias_restantes);
    if (r.vencido) {
      return el('span', { class: 'plazo plazo-vencido' }, 'Vencido' + (isFinite(d) && d < 0 ? ' hace ' + pl(-d, 'día', 'días') : ''));
    }
    if (!isFinite(d) || r.dias_restantes === null || r.dias_restantes === undefined) return null;
    const texto = d <= 0 ? 'Vence hoy' : d === 1 ? 'Queda 1 día' : 'Quedan ' + d + ' días';
    return el('span', { class: 'plazo' + (d <= 3 ? ' plazo-pronto' : '') }, texto);
  }

  function lineaPlazo(r) {
    const est = estadoPlazo(r);
    if (!r.plazo_respuesta) return est;
    return el('span', null, 'Responder hasta el ' + fecha(r.plazo_respuesta), est ? '. ' : '', est);
  }

  function filaReclamo(r) {
    const abierto = r.estado !== 'respondido';
    const d = Number(r.dias_restantes);
    const clase = !abierto ? ' fila-apagada' : r.vencido ? ' fila-urgente' : (isFinite(d) && d <= 3 && r.dias_restantes !== null ? ' fila-alerta' : '');
    const li = el('li', { class: 'fila' + clase });
    li.appendChild(el('div', { class: 'fila-cab' },
      r.codigo ? el('span', { class: 'fila-ref' }, r.codigo) : null,
      el('h3', { class: 'fila-titulo' }, r.nombre || 'Sin nombre'),
      el('span', { class: 'chips' },
        r.tipo ? chip(TIPO_REC[r.tipo] || r.tipo) : null,
        r.vencido && abierto ? chip('Vencido', 'urgente') : null,
        chip(ESTADO_REC[r.estado] || r.estado || 'Sin estado', r.estado === 'respondido' ? 'ok' : null)),
      el('span', { class: 'fila-fecha', title: fechaHora(r.creado_en) }, 'Recibido el ' + fecha(r.creado_en))));

    const plazo = lineaPlazo(r);

    const detalle = el('details', { class: 'detalle' },
      el('summary', null, 'Leer la hoja completa'),
      el('div', { class: 'detalle-cuerpo' },
        pares([
          ['Detalle', r.detalle ? el('p', { class: 'texto-largo' }, r.detalle) : null, true],
          ['Lo que pide', r.pedido ? el('p', { class: 'texto-largo' }, r.pedido) : null, true],
          ['Documento', r.documento],
          ['Empresa', r.empresa],
          ['Correo', r.email],
          ['Celular', r.telefono],
          // Si el consumidor perdió la constancia, el equipo se la puede dictar.
          ['Clave de consulta', r.clave_consulta ? String(r.clave_consulta).replace(/^(.{4})(.{4})$/, '$1-$2') : null]
        ]),
        r.respuesta ? el('div', { class: 'respuesta' },
          el('p', { class: 'sutil' }, 'Respuesta' + (r.respondido_por || r.respondido_en ? ' de ' + quien(r.respondido_por, r.respondido_en) : '')),
          el('p', { class: 'texto-largo' }, r.respuesta)) : null));

    const izq = el('div', null,
      pares([
        ['Plazo', plazo],
        ['Bien contratado', r.bien_descripcion],
        ['Monto', montoTexto(r.monto)],
        ['Correo', r.email]
      ]),
      detalle);
    const acciones = abierto
      ? el('div', { class: 'acciones' },
        el('button', { class: 'btn btn-oscuro', type: 'button', on: { click: function () { dialogoResponder(r); } } }, 'Responder'))
      : null;
    li.appendChild(el('div', { class: 'fila-cuerpo' }, izq, acciones));
    return li;
  }
  function montoTexto(m) {
    if (m === null || m === undefined || m === '') return '';
    const n = Number(m);
    return isFinite(n) && String(m).trim() !== '' ? fMonto.format(n) : String(m);
  }

  function dialogoResponder(r) {
    const error = el('p', { class: 'error', role: 'alert', hidden: true });
    const boton = el('button', { class: 'btn btn-primario', type: 'submit' }, 'Guardar respuesta');
    const radios = el('fieldset', { class: 'radios' },
      el('legend', null, 'Estado'),
      el('label', { class: 'radio' }, el('input', { type: 'radio', name: 'rsEstado', value: 'respondido', checked: true }), 'Respondido'),
      el('label', { class: 'radio' }, el('input', { type: 'radio', name: 'rsEstado', value: 'en_proceso' }), 'En proceso'));
    const resp = campo({ id: 'rsTexto', etiqueta: 'Respuesta al cliente', area: true, filas: 7, max: 4000,
      ayuda: r.email
        ? 'El sistema intentará enviarle una copia a ' + r.email + '.'
        : 'Esta hoja no tiene correo: avísale al cliente por otro medio.' });
    if (r.respuesta) resp.input.value = r.respuesta;
    const form = el('form', { class: 'dlg-form', method: 'post', novalidate: true },
      el('div', { class: 'dlg-resumen' },
        el('p', null, el('strong', null, r.nombre || 'Sin nombre'), r.codigo ? ' ' : '', r.codigo ? el('span', { class: 'mono' }, r.codigo) : null),
        r.plazo_respuesta ? el('p', { class: 'sutil' }, lineaPlazo(r)) : null,
        r.detalle ? el('details', { class: 'detalle' }, el('summary', null, 'Ver lo que escribió'),
          el('div', { class: 'detalle-cuerpo' }, el('p', { class: 'texto-largo' }, r.detalle), r.pedido ? el('p', { class: 'texto-largo' }, el('strong', null, 'Pide: '), r.pedido) : null)) : null),
      radios,
      el('p', { class: 'ayuda' }, '“En proceso” guarda un borrador interno: el cliente no lo ve hasta que marques “Respondido”, que cierra la hoja y, si dejó correo, se la envía.'),
      resp.nodo, error,
      botonesDialogo(boton));
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      ocultar(error);
      resp.input.removeAttribute('aria-invalid');
      const estado = (form.querySelector('input[name="rsEstado"]:checked') || {}).value;
      const texto = resp.valor();
      if (!estado) { mostrarError(error, 'Elige el estado.'); return; }
      if (estado === 'respondido' && texto.length < 10) {
        resp.input.setAttribute('aria-invalid', 'true');
        mostrarError(error, 'Escribe la respuesta para el cliente.');
        resp.input.focus();
        return;
      }
      await ocupado(boton, 'Guardando…', async function () {
        try {
          const x = await api('POST', '/api/admin/reclamos/' + enc(r.codigo) + '/responder', { estado: estado, respuesta: texto });
          const correo = x.correo_enviado
            ? el('p', { class: 'resultado-ok' }, 'Se envió la copia por correo' + (r.email ? ' a ' + r.email : '') + '.')
            : el('p', { class: 'resultado-ok resultado-mal' }, 'No se envió copia por correo' + (r.email ? '' : ' (la hoja no tiene correo)') + '. Avísale al cliente por otro medio.');
          vistaResultado({
            titulo: estado === 'respondido' ? 'Reclamo respondido' : 'Avance guardado',
            mensaje: estado === 'respondido'
              ? 'La hoja ' + (r.codigo || '') + ' quedó como respondida.'
              : 'La hoja ' + (r.codigo || '') + ' quedó en proceso. Sigue contando el plazo.',
            extra: correo
          });
          trasCambio();
        } catch (err) {
          mostrarError(error, err);
        }
      });
    });
    abrirDialogo('Responder reclamo', form, { foco: resp.input });
  }

  /* ================= Actividad ================= */
  async function cargarActividad() {
    const st = S.act;
    const n = ++st.seq;
    const caja = $('#cajaActividad');
    const info = $('#infoActividad');
    listaOcupada(caja, info);
    try {
      const r = await api('GET', '/api/admin/actividad?tipo=' + enc(st.tipo));
      if (n !== st.seq) return;
      const ev = arr(r.eventos);
      if (!ev.length) {
        caja.replaceChildren();
        infoTexto(info, 'No hay movimientos registrados.', true);
        return;
      }
      infoTexto(info, ev.length >= 200 ? 'Últimos 200 movimientos.' : pl(ev.length, 'movimiento', 'movimientos') + '.');
      const cols = [['Fecha', 'col-fecha'], ['Acción', 'col-accion'], ['Resultado', ''], ['Quién', ''], ['País', ''], ['Detalle', 'col-detalle'], ['IP', '']];
      const tabla = el('table', { class: 'tabla' },
        el('caption', { class: 'sr' }, 'Movimientos, del más reciente al más antiguo'),
        el('thead', null, el('tr', null, cols.map(function (c) { return el('th', { scope: 'col', class: c[1] || null }, c[0]); }))),
        el('tbody', null, ev.map(function (e) {
          const res = e.resultado ? (RESULTADOS[e.resultado] || e.resultado) : '';
          const celdas = [
            [fechaHora(e.creado_en), 'col-fecha'],
            [e.accion ? (ACCIONES[e.accion] || e.accion) : '', 'col-accion'],
            [res, RESULTADOS_MALOS[e.resultado] ? 'res-malo' : e.resultado === 'ok' ? 'res-bueno' : ''],
            [e.actor || '', ''],
            [e.pais ? (PAISES[e.pais] || e.pais) : '', ''],
            [e.detalle || '', 'col-detalle'],
            [e.ip || '', 'mono']
          ];
          return el('tr', null, celdas.map(function (c, i) {
            const vacio = c[0] === '' || c[0] === null || c[0] === undefined;
            return el('td', { 'data-et': cols[i][0], class: [c[1], vacio ? 'vacio-celda' : ''].filter(Boolean).join(' ') || null, title: i === 1 && e.accion && ACCIONES[e.accion] ? e.accion : null }, vacio ? '' : c[0]);
          }));
        })));
      caja.replaceChildren(tabla);
    } catch (err) {
      if (n === st.seq) infoError(info, err, cargarActividad);
    } finally {
      if (n === st.seq) listaLista(caja);
    }
  }
  $$('input[name="actTipo"]').forEach(function (r) {
    r.addEventListener('change', function () { if (r.checked) { S.act.tipo = r.value; $('#cajaActividad').replaceChildren(); cargarActividad(); } });
  });

  /* ================= Equipo (solo admin) ================= */
  async function cargarEquipo() {
    if (!esAdmin()) return;
    const st = S.eq;
    const n = ++st.seq;
    const lista = $('#listaEquipo');
    const info = $('#infoEquipo');
    listaOcupada(lista, info);
    try {
      const r = await api('GET', '/api/admin/usuarios');
      if (n !== st.seq) return;
      const us = arr(r.usuarios);
      lista.replaceChildren.apply(lista, us.map(filaUsuario));
      const activos = us.filter(function (u) { return u.activo !== false; }).length;
      infoTexto(info, us.length ? pl(us.length, 'usuario', 'usuarios') + ', ' + pl(activos, 'activo', 'activos') + '.' : 'No hay usuarios.', !us.length);
    } catch (err) {
      if (n === st.seq) infoError(info, err, cargarEquipo);
    } finally {
      if (n === st.seq) listaLista(lista);
    }
  }
  $('#btnNuevoUsuario').addEventListener('click', dialogoNuevoUsuario);

  function esYo(u) { return !!(S.usuario && (String(u.id) === String(S.usuario.id) || u.usuario === S.usuario.usuario)); }

  function filaUsuario(u) {
    const activo = u.activo !== false;
    const yo = esYo(u);
    const li = el('li', { class: 'fila' + (activo ? '' : ' fila-apagada') });
    li.appendChild(el('div', { class: 'fila-cab' },
      el('h3', { class: 'fila-titulo' }, u.nombre || u.usuario || 'Sin nombre'),
      el('span', { class: 'chips' },
        chip(ROL[u.rol] || u.rol || 'Sin rol', u.rol === 'admin' ? 'oscuro' : null),
        activo ? null : chip('Inactivo'),
        yo ? chip('Tú', 'info') : null)));
    const izq = pares([
      ['Usuario', u.usuario ? el('span', { class: 'mono' }, u.usuario) : null],
      ['Último ingreso', u.ultimo_ingreso ? hace(u.ultimo_ingreso) : 'Nunca entró'],
      ['Creado', quien(u.creado_por ? 'por ' + u.creado_por : '', u.creado_en)]
    ]);
    // A un administrador (tú incluido) no se le reinicia desde aquí: cambia la suya con «Cambiar contraseña».
    const acciones = el('div', { class: 'acciones' },
      u.rol === 'admin' ? null : el('button', { class: 'btn', type: 'button', on: { click: function () { dialogoReiniciar(u); } } }, 'Nueva contraseña'),
      yo ? null : el('button', {
        class: activo ? 'btn btn-peligro' : 'btn', type: 'button',
        on: { click: function () { dialogoActivo(u, !activo); } }
      }, activo ? 'Desactivar' : 'Activar'));
    li.appendChild(el('div', { class: 'fila-cuerpo' }, izq, acciones));
    return li;
  }

  function vistaClaveTemporal(o) {
    const extra = el('div', { class: 'resultado' },
      pares([['Usuario', o.usuario ? el('span', { class: 'mono' }, o.usuario) : null], ['Nombre', o.nombre]]),
      el('div', { class: 'campo' },
        el('p', { class: 'campo-et', id: 'ctEt' }, 'Contraseña temporal'),
        el('p', { class: 'clave-temporal', 'aria-labelledby': 'ctEt' }, o.clave || '')),
      el('p', { class: 'alerta' }, 'Solo se muestra esta vez. Pásasela por un canal privado. Al entrar por primera vez, el panel le pedirá cambiarla.'));
    const cont = el('div', { class: 'resultado' });
    cont.appendChild(el('p', { class: 'resultado-ok' }, o.mensaje));
    cont.appendChild(extra);
    const copiarBtn = botonCopiar(o.clave || '', 'Copiar contraseña');
    cont.appendChild(el('div', { class: 'dlg-acciones' }, copiarBtn,
      el('button', { class: 'btn', type: 'button', on: { click: cerrarDialogo } }, 'Ya la copié')));
    abrirDialogo(o.titulo, cont, { foco: copiarBtn });
  }

  function dialogoNuevoUsuario() {
    const error = el('p', { class: 'error', role: 'alert', hidden: true });
    const boton = el('button', { class: 'btn btn-primario', type: 'submit' }, 'Crear usuario');
    const usuario = campo({ id: 'nuUsuario', etiqueta: 'Usuario', max: 40, autocapitalize: 'none', spellcheck: 'false',
      ayuda: 'Con lo que entrará. En minúsculas, sin espacios. Por ejemplo: martin.' });
    const nombre = campo({ id: 'nuNombre', etiqueta: 'Nombre', max: 80, ayuda: 'Así aparecerá en la actividad.' });
    const rol = el('fieldset', { class: 'radios' },
      el('legend', null, 'Rol'),
      el('label', { class: 'radio' }, el('input', { type: 'radio', name: 'nuRol', value: 'equipo', checked: true }), 'Equipo'),
      el('label', { class: 'radio' }, el('input', { type: 'radio', name: 'nuRol', value: 'admin' }), 'Administrador'));
    const form = el('form', { class: 'dlg-form', method: 'post', novalidate: true },
      usuario.nodo, nombre.nodo, rol,
      el('p', { class: 'ayuda' }, 'Equipo: revisa solicitudes, accesos, tickets y reclamos. Administrador: además maneja el equipo y sincroniza con Odoo.'),
      error,
      botonesDialogo(boton));
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      ocultar(error);
      const u = usuario.valor().toLowerCase();
      const nom = nombre.valor();
      const r0 = (form.querySelector('input[name="nuRol"]:checked') || {}).value;
      if (!/^[a-z0-9._-]{3,40}$/.test(u)) { usuario.input.setAttribute('aria-invalid', 'true'); mostrarError(error, 'El usuario debe tener de 3 a 40 letras minúsculas, números, punto, guion o guion bajo, sin espacios.'); usuario.input.focus(); return; }
      usuario.input.removeAttribute('aria-invalid');
      if (nom.length < 2) { nombre.input.setAttribute('aria-invalid', 'true'); mostrarError(error, 'Escribe el nombre.'); nombre.input.focus(); return; }
      nombre.input.removeAttribute('aria-invalid');
      await ocupado(boton, 'Creando…', async function () {
        try {
          const r = await api('POST', '/api/admin/usuarios', { usuario: u, nombre: nom, rol: r0 });
          const ru = r.usuario && typeof r.usuario === 'object' ? r.usuario : null;
          vistaClaveTemporal({
            titulo: 'Usuario creado',
            mensaje: 'Listo, ' + ((ru && ru.nombre) || nom) + ' ya tiene usuario.',
            usuario: (ru && ru.usuario) || (typeof r.usuario === 'string' ? r.usuario : u),
            nombre: (ru && ru.nombre) || nom,
            clave: r.clave_temporal
          });
          cargarEquipo();
        } catch (err) {
          mostrarError(error, err);
        }
      });
    });
    abrirDialogo('Nuevo usuario', form);
  }

  function dialogoReiniciar(u) {
    const error = el('p', { class: 'error', role: 'alert', hidden: true });
    const boton = el('button', { class: 'btn btn-primario', type: 'submit' }, 'Crear contraseña nueva');
    const form = el('form', { class: 'dlg-form', method: 'post', novalidate: true },
      el('p', { class: 'dlg-texto' }, 'Se creará una contraseña temporal para ', el('strong', null, u.nombre || u.usuario),
        '. La que tiene ahora deja de servir y, al entrar, tendrá que elegir una nueva.'),
      error,
      botonesDialogo(boton));
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      ocultar(error);
      await ocupado(boton, 'Creando…', async function () {
        try {
          const r = await api('POST', '/api/admin/usuarios/' + enc(u.id) + '/reiniciar', {});
          vistaClaveTemporal({
            titulo: 'Contraseña nueva',
            mensaje: 'Listo, esta es la contraseña temporal de ' + (u.nombre || u.usuario) + '.',
            usuario: u.usuario,
            nombre: u.nombre,
            clave: r.clave_temporal
          });
          // Con la propia, la sesión ya no vale: recargar el equipo cerraría la clave antes de copiarla.
          if (!esYo(u)) cargarEquipo();
        } catch (err) {
          mostrarError(error, err);
        }
      });
    });
    abrirDialogo('Nueva contraseña', form);
  }

  function dialogoActivo(u, activar) {
    const error = el('p', { class: 'error', role: 'alert', hidden: true });
    const boton = el('button', { class: 'btn btn-primario', type: 'submit' }, activar ? 'Activar' : 'Desactivar');
    const nombre = u.nombre || u.usuario;
    const form = el('form', { class: 'dlg-form', method: 'post', novalidate: true },
      el('p', { class: 'dlg-texto' }, activar
        ? [el('strong', null, nombre), ' podrá volver a entrar al panel con su usuario y contraseña.']
        : [el('strong', null, nombre), ' no podrá entrar al panel hasta que lo actives de nuevo. Lo que ya hizo queda en la actividad.']),
      error,
      botonesDialogo(boton));
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      ocultar(error);
      await ocupado(boton, activar ? 'Activando…' : 'Desactivando…', async function () {
        try {
          await api('POST', '/api/admin/usuarios/' + enc(u.id) + '/activo', { activo: !!activar });
          alCerrarDlg = null;
          dlg.close();
          nota(nombre + (activar ? ' fue activado.' : ' fue desactivado.'));
          cargarEquipo();
        } catch (err) {
          mostrarError(error, err);
        }
      });
    });
    abrirDialogo(activar ? 'Activar usuario' : 'Desactivar usuario', form);
  }

  /* ================= Arranque ================= */
  /* El resumen se refresca solo cada 2 minutos mientras la pestaña está a la vista. */
  setInterval(function () {
    if (S.vista === 'panel' && !document.hidden && !dlg.open) cargarResumen();
  }, 120000);

  async function arrancar() {
    S.token = leerToken();
    if (!S.token) { mostrarLogin(); return; }
    try {
      const r = await api('GET', '/api/admin/yo');
      S.usuario = r.usuario || null;
      if (!S.usuario) throw ErrorApi('La respuesta del servidor no trae el usuario.', 0);
      entrar();
    } catch (err) {
      if (err.sesion) return;   // api() ya mostró el ingreso
      mostrarLogin(err.message);
    }
  }
  arrancar();
})();
