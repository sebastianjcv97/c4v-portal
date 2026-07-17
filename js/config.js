/* Configuración del portal C4V — editable sin tocar el código.
   Central de Postventa · A3 (plataforma v2: acceso por teléfono + agente de voz). */

window.C4V_CONFIG = {

  /* ---------- Agente de IA por voz (ElevenLabs Agents Platform) ----------
     Cuando el agente esté creado (actividad A4), pega aquí su Agent ID.
     Con el ID puesto, el portal carga el widget de voz automáticamente.
     Mientras esté vacío, el botón "Habla con CeVi" explica que aún no está
     disponible y ofrece WhatsApp (nunca finge que funciona).
     Se obtiene en: elevenlabs.io → Agents → tu agente → Widget / Embed.   */
  elevenlabsAgentId: '',

  /* Nombre y descripción del agente (se muestran en el panel) */
  agente: {
    nombre: 'CeVi',
    descripcion: 'Tu asistente C4V. Pregúntale por voz o texto sobre tu máquina, tu certificado o cómo preparar tu espacio.'
  },

  /* ---------- Canal humano (fallback siempre disponible) ---------- */
  whatsapp: {
    numero: '51924662205',            // sin + ni espacios (formato wa.me)
    visible: '+51 924 662 205'
  },

  /* ---------- Países y documentos (login por documento) ----------
     persona → documento de identidad · empresa → registro tributario.
     El prefijo telefónico se mantiene para notificaciones WhatsApp.     */
  paises: [
    { code: 'PE', nombre: 'Perú',     prefijo: '51',  bandera: '🇵🇪', persona: { doc: 'DNI',          ej: '45678123' },     empresa: { doc: 'RUC', ej: '20123456789' } },
    { code: 'EC', nombre: 'Ecuador',  prefijo: '593', bandera: '🇪🇨', persona: { doc: 'Cédula (CI)',  ej: '0912345678' },   empresa: { doc: 'RUC', ej: '0912345678001' } },
    { code: 'BO', nombre: 'Bolivia',  prefijo: '591', bandera: '🇧🇴', persona: { doc: 'CI',           ej: '7894561' },      empresa: { doc: 'NIT', ej: '1023456028' } },
    { code: 'CL', nombre: 'Chile',    prefijo: '56',  bandera: '🇨🇱', persona: { doc: 'RUT',          ej: '12.345.678-9' }, empresa: { doc: 'RUT', ej: '76.543.210-5' } },
    { code: 'CO', nombre: 'Colombia', prefijo: '57',  bandera: '🇨🇴', persona: { doc: 'Cédula (CC)',  ej: '1023456789' },   empresa: { doc: 'NIT', ej: '901234567' } }
  ],

  /* En demo mostramos los documentos de ejemplo para poder entrar.
     En producción: false (y la validación va contra Odoo). */
  mostrarNumerosDemo: true
};
