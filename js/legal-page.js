/* legal-page.js — utilidades comunes de las páginas legales (públicas).
   Rellena los datos del proveedor desde config.js y avisa en rojo si falta
   alguno de los obligatorios: es preferible verlo nosotros a publicar un
   documento legal incompleto. */
(function () {
  const CFG = window.C4V_CONFIG || {};
  /* Las páginas legales son públicas: quien llega puede no tener sesión. Se puede
     forzar una empresa con ?empresa=RUC (los enlaces del portal lo hacen). */
  const registro = CFG.empresas || {};
  const porRuc = new URLSearchParams(location.search).get('empresa');
  const clave = porRuc
    ? Object.keys(registro).find((k) => registro[k].ruc === porRuc) || CFG.empresaPorDefecto
    : CFG.empresaPorDefecto;
  const E = { ...(registro[clave] || {}), ...(CFG.contacto || {}) };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  window.C4V_LEGAL = {
    empresa: E,
    version: CFG.versionLegal || '',
    esc,
    waLink: (t) => `https://wa.me/${(CFG.whatsapp?.numero || '51924662205')}?text=${encodeURIComponent(t || '')}`,
    apiBase: (CFG.verificacion && CFG.verificacion.apiBase) || ''
  };

  function pintar() {
    // Datos del proveedor allí donde se pidan
    document.querySelectorAll('[data-emp]').forEach(el => {
      const v = E[el.dataset.emp] || '';
      el.textContent = v || '—';
      if (!v) el.classList.add('muted');
    });
    document.querySelectorAll('[data-version]').forEach(el => { el.textContent = CFG.versionLegal || ''; });

    // Aviso de datos societarios faltantes (obligatorios para el consumidor)
    const faltan = [['razon_social', 'razón social'], ['ruc', 'RUC'], ['domicilio', 'domicilio']]
      .filter(([k]) => !E[k]).map(([, n]) => n);
    // Se avisa por consola a quien mantiene el portal, nunca en pantalla.
    if (faltan.length) console.warn('[C4V] Faltan datos del proveedor en config.js:', faltan.join(', '));

    // Las otras empresas del grupo, para que el consumidor encuentre la suya.
    const otras = Object.entries(registro).filter(([k]) => k !== clave);
    document.querySelectorAll('[data-otras-empresas]').forEach((el) => {
      if (!otras.length) return;
      el.innerHTML = `<p class="doc-otras">¿Compraste con otra de nuestras empresas? ` +
        otras.map(([, v]) => `<a href="?empresa=${esc(v.ruc)}">${esc(v.razon_social)}</a>`).join(' · ') +
        `<br><span class="muted">Mira tu boleta o factura: ahí figura con cuál contrataste.</span></p>`;
    });

    // Pie común
    document.querySelectorAll('[data-doc-foot]').forEach(el => {
      el.innerHTML = `
        <p><strong>${esc(E.razon_social || '')}</strong>${E.ruc ? ` · RUC ${esc(E.ruc)}` : ''}${E.domicilio ? `<br>${esc(E.domicilio)}` : ''}
        <br>WhatsApp ${esc(E.whatsapp_visible || '')}${E.telefono ? ` · Tel. ${esc(E.telefono)}` : ''}${E.email ? ` · ${esc(E.email)}` : ''}</p>
        <nav>
          <a href="index.html">Volver al portal</a>
          <a href="privacidad.html">Privacidad</a>
          <a href="terminos.html">Términos</a>
          <a href="libro-reclamaciones.html">Libro de Reclamaciones</a>
        </nav>`;
    });
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', pintar) : pintar();
})();
