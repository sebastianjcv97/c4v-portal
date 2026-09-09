/* libro-reclamaciones.js — envía la hoja al backend y muestra la constancia.
   Si el backend no responde, NO se pierde el reclamo: se ofrece el canal de
   WhatsApp con todo el detalle ya redactado. */
(function () {
  const L = window.C4V_LEGAL || {};
  const $ = (s) => document.querySelector(s);
  const api = (L.apiBase || '');
  let tipo = 'reclamo';

  // El consumidor debe poder identificar CON QUIÉN contrató: en C4V venden tres
  // empresas distintas y cada una responde por sus propias ventas.
  const registro = (window.C4V_CONFIG || {}).empresas || {};
  const sel = $('#lrEmpresa');
  if (sel) {
    sel.innerHTML = '<option value="">Elige una…</option>' +
      Object.entries(registro).map(([k, v]) =>
        `<option value="${L.esc(k)}" ${v.ruc === L.empresa.ruc ? 'selected' : ''}>${L.esc(v.razon_social)} — RUC ${L.esc(v.ruc)}</option>`).join('');
  }

  // Tipo: reclamo o queja (la distinción es obligatoria)
  const tipos = document.querySelectorAll('#lrTipos .lr-tipo');
  const marcar = (b) => { tipo = b.dataset.tipo; tipos.forEach(x => x.setAttribute('aria-checked', x === b)); };
  tipos.forEach((b, i, todos) => {
    b.onclick = () => marcar(b);
    b.onkeydown = (e) => {
      const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!dir) return;
      e.preventDefault();
      const sig = todos[(i + dir + todos.length) % todos.length];
      marcar(sig); sig.focus();
    };
  });

  $('#lrMenor').onchange = (e) => {
    $('#lrApoderadoBox').hidden = !e.target.checked;
    if (e.target.checked) $('#lrApoderado').focus();
  };

  function mostrarErrores(lista) {
    const box = $('#lrErrores');
    box.hidden = false;
    box.innerHTML = '<strong>Revisa esto antes de enviar:</strong><ul>' +
      lista.map(x => `<li>${L.esc(x)}</li>`).join('') + '</ul>';
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  $('#lrForm').onsubmit = async (e) => {
    e.preventDefault();
    $('#lrErrores').hidden = true;

    const datos = {
      tipo,
      nombre: $('#lrNombre').value.trim(),
      documento_tipo: $('#lrDocTipo').value,
      documento: $('#lrDocumento').value.trim(),
      domicilio: $('#lrDomicilio').value.trim(),
      telefono: $('#lrTelefono').value.trim(),
      email: $('#lrEmail').value.trim(),
      es_menor: $('#lrMenor').checked,
      apoderado: $('#lrApoderado').value.trim(),
      bien_tipo: $('#lrBienTipo').value,
      bien_descripcion: $('#lrBienDesc').value.trim(),
      monto: $('#lrMonto').value.trim(),
      detalle: $('#lrDetalle').value.trim(),
      pedido: $('#lrPedido').value.trim(),
      empresa: sel ? sel.value : ''
    };
    if (sel && !sel.value) return mostrarErrores(['Elige con cuál de nuestras empresas contrataste. Está en tu boleta o factura.']);
    if (!$('#lrAcepta').checked) return mostrarErrores(['Marca la casilla de declaración para poder registrar tu hoja.']);

    const btn = $('#lrEnviar');
    btn.disabled = true; btn.textContent = 'Registrando…';
    try {
      const r = await fetch(`${api}/api/reclamos`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos)
      });
      const j = await r.json();
      if (!r.ok) {
        btn.disabled = false; btn.textContent = 'Registrar mi hoja';
        return mostrarErrores(j.errores || [j.error || 'No pudimos registrar tu hoja en este momento.']);
      }
      $('#lrFormBox').hidden = true;
      $('#lrOkBox').hidden = false;
      // Sin esto, quien usa lector de pantalla no se entera de que se registró
      // ni escucha su número de hoja: el foco estaba en un botón que desapareció.
      $('#lrOkBox').focus();
      $('#lrCodigo').textContent = j.codigo;
      $('#lrPlazoOk').textContent = `Te responderemos a más tardar el ${new Date(j.plazo_respuesta).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })}.`;
      $('#lrConstancia').textContent = j.constancia;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      btn.disabled = false; btn.textContent = 'Registrar mi hoja';
      const texto = `Quiero presentar un ${tipo}.\n\nNombre: ${datos.nombre}\nDocumento: ${datos.documento}\n\nDetalle: ${datos.detalle}\n\nPedido: ${datos.pedido}`;
      mostrarErrores([]);
      $('#lrErrores').innerHTML = `<strong>No pudimos conectar con nuestro servidor.</strong>
        <p style="margin:8px 0 0">Tu reclamo no se pierde: <a href="${L.waLink(texto)}" target="_blank" rel="noopener"><strong>envíanoslo por WhatsApp</strong></a> con un toque y lo registramos nosotros.</p>`;
    }
  };

  // Consulta de estado (código + documento)
  $('#lrConsultaForm').onsubmit = async (e) => {
    e.preventDefault();
    const caja = $('#lrcResultado');
    caja.innerHTML = '<p class="muted">Consultando…</p>';
    try {
      const r = await fetch(`${api}/api/reclamos/consulta`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: $('#lrcCodigo').value.trim(), documento: $('#lrcDoc').value.trim() })
      });
      const j = await r.json();
      if (!j.existe) {
        caja.innerHTML = '<p>No encontramos una hoja con ese número y ese documento. Revisa ambos datos.</p>';
        return;
      }
      const estados = { recibido: 'Recibida', en_proceso: 'En revisión', respondido: 'Respondida' };
      caja.innerHTML = `<div class="card">
        <h3 style="margin-top:0">${L.esc(j.codigo)} · ${estados[j.estado] || L.esc(j.estado)}</h3>
        <p>Presentada el ${new Date(j.creado_en).toLocaleDateString('es-PE')}. Plazo de respuesta: ${new Date(j.plazo_respuesta).toLocaleDateString('es-PE')}.</p>
        ${j.respuesta ? `<p><strong>Nuestra respuesta:</strong><br>${L.esc(j.respuesta)}</p>` : '<p class="muted">Todavía no hemos registrado la respuesta. Te contactaremos dentro del plazo.</p>'}
      </div>`;
    } catch {
      caja.innerHTML = '<p>No pudimos consultar en este momento. Inténtalo más tarde.</p>';
    }
  };
})();
