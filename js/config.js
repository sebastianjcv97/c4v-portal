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

  /* ---------- Prefijos por país (login por teléfono) ---------- */
  paises: [
    { code: 'PE', nombre: 'Perú',    prefijo: '51',  bandera: '🇵🇪', ejemplo: '987 654 321' },
    { code: 'EC', nombre: 'Ecuador', prefijo: '593', bandera: '🇪🇨', ejemplo: '99 123 4567' },
    { code: 'BO', nombre: 'Bolivia', prefijo: '591', bandera: '🇧🇴', ejemplo: '7 123 4567' }
  ],

  /* En demo mostramos los números de ejemplo para poder entrar.
     En producción: false (y la validación va contra Odoo). */
  mostrarNumerosDemo: true
};
