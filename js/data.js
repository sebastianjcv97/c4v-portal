/* Datos del portal C4V (fuente única de verdad).
   - En modo DEMO (preview sin servidor) el frontend usa window.__SEED__.
   - Con `npm start`, el servidor lee ESTE archivo para sembrar data/db.json.
   Contenido real extraído del ecosistema C4V (C4V School, KB CeVi, PRODUCT.md). */
window.__SEED__ = {
  meta: { marca: "C4V Láser", portal: "Central de Postventa C4V", paises: ["PE", "EC", "BO", "CL", "CO"] },

  soporte: {
    whatsapp: "+51 924 662 205",
    wa_link: "https://wa.me/51924662205",
    fijo: "905474440",
    horario: "Soporte en español los 365 días",
    lives: "TikTok @c4vlaser, de lunes a viernes a la 1:00 p.m. y a las 6:00 p.m. Sábados a las 11:30 a.m.",
    redes: { tiktok: "@c4vlaser", instagram: "@c4v_laser", facebook: "C4V Laser PE", tiktok_url: "https://www.tiktok.com/@c4vlaser" }
  },

  tecnicos: [
    { id: "t-josafat", nombre: "Josafat", pais: "PE", rol: "Técnico certificado" },
    { id: "t-gerson", nombre: "Gerson", pais: "PE", rol: "Técnico certificado" },
    { id: "t-aldo", nombre: "Aldo", pais: "BO", rol: "Técnico certificado" },
    { id: "t-gustavo", nombre: "Gustavo", pais: "BO", rol: "Técnico certificado" },
    { id: "t-ec", nombre: "Por asignar", pais: "EC", rol: "Técnico certificado (pendiente)" }
  ],
  comercial: [
    { id: "c-pe", nombre: "Equipo Comercial C4V Perú", pais: "PE" },
    { id: "c-ec", nombre: "Equipo Comercial C4V Ecuador", pais: "EC" },
    { id: "c-bo", nombre: "Equipo Comercial C4V Bolivia", pais: "BO" },
    { id: "c-cl", nombre: "Equipo Comercial C4V Chile", pais: "CL" },
    { id: "c-co", nombre: "Equipo Comercial C4V Colombia", pais: "CO" }
  ],
  clientes: [
    /* tipo: persona | empresa · documento: DNI/CI/CC (persona) o RUC/RUT/NIT (empresa) según país */
    { id: "cli-001", nombre: "Carla Méndez", tipo: "persona", documento: "45678123", empresa: "Creativa Láser EIRL", pais: "PE", ciudad: "Lima", email: "carla@creativalaser.pe", telefono: "+51 987 654 321" },
    { id: "cli-002", nombre: "Diego Salazar", tipo: "persona", documento: "0912345678", empresa: "TallerMaker", pais: "EC", ciudad: "Quito", email: "diego@tallermaker.ec", telefono: "+593 99 123 4567" },
    { id: "cli-003", nombre: "Rosa Quispe", tipo: "persona", documento: "7894561", empresa: "Detalles Andinos", pais: "BO", ciudad: "La Paz", email: "rosa@detallesandinos.bo", telefono: "+591 7 123 4567" },
    { id: "cli-004", nombre: "Acrílicos Andinos SpA", tipo: "empresa", documento: "76.543.210-5", empresa: "Acrílicos Andinos SpA", pais: "CL", ciudad: "Santiago", email: "contacto@acrilicosandinos.cl", telefono: "+56 9 8765 4321" },
    { id: "cli-005", nombre: "Creativa Publicidad S.A.S.", tipo: "empresa", documento: "901234567", empresa: "Creativa Publicidad S.A.S.", pais: "CO", ciudad: "Bogotá", email: "hola@creativapublicidad.co", telefono: "+57 310 123 4567" }
  ],
  maquinas: [
    { serie: "C4V-6040-PE-00123", modelo: "6040", tipo: "CO2", area: "600 x 400 mm", pais: "PE", cliente_id: "cli-001", fecha_entrega: "2026-03-12", certificado: { estado: "certificada", fecha: "2026-03-10", tecnico: "Josafat" } },
    { serie: "C4V-9060-EC-00210", modelo: "9060", tipo: "CO2", area: "900 x 600 mm", pais: "EC", cliente_id: "cli-002", fecha_entrega: "2026-05-02", certificado: { estado: "certificada", fecha: "2026-04-30", tecnico: "Equipo EC" } },
    { serie: "C4V-1390-BO-00078", modelo: "1390", tipo: "CO2", area: "1300 x 900 mm", pais: "BO", cliente_id: "cli-003", fecha_entrega: "2026-06-20", certificado: { estado: "en_proceso", fecha: null, tecnico: "Aldo" } },
    { serie: "C4V-9060-CL-00042", modelo: "9060", tipo: "CO2", area: "900 x 600 mm", pais: "CL", cliente_id: "cli-004", fecha_entrega: "2026-05-18", certificado: { estado: "certificada", fecha: "2026-05-15", tecnico: "Equipo CL" } },
    { serie: "C4V-6040-CO-00101", modelo: "6040", tipo: "CO2", area: "600 x 400 mm", pais: "CO", cliente_id: "cli-005", fecha_entrega: "2026-06-01", certificado: { estado: "certificada", fecha: "2026-05-29", tecnico: "Equipo CO" } }
  ],
  certificado_info: {
    nombre: "Certificado de Calidad C4V", duracion: "",
    promesa: [
      "Probada y calibrada antes de entregarse",
      "Piezas originales instaladas (incluido el tubo láser)",
      "Garantía C4V + garantía RECI del tubo láser (PE/EC/BO)",
      "Acompañamiento del ingeniero hasta el primer corte",
      "Entregada con guía de preparación del espacio"
    ],
    etapas: [
      { n: 1, titulo: "Origen en fábrica", detalle: "Selección, piezas originales y control de calidad en planta." },
      { n: 2, titulo: "Certificación", detalle: "Pruebas, piezas originales y calibración al llegar al país." },
      { n: 3, titulo: "Transporte y seguridad", detalle: "Sellado, stickers de seguridad y trazabilidad por Nº de serie." },
      { n: 4, titulo: "Preinstalación", detalle: "Lista de compras, instalación eléctrica, pozo a tierra y ambiente." },
      { n: 5, titulo: "Entrega y sello", detalle: "Puesta en marcha hasta el primer corte y activación del certificado." }
    ],
    lema: "Probada antes de ser tuya.",
    frase_ancla: "No te entregamos una caja, te entregamos una máquina lista para producir.",
    narrativa: "Antes de llegar a ti, un técnico certificado la enciende, confirma que cada pieza sea original (en especial el tubo láser), la calibra y revisa enfriamiento, óptica y movimientos. Recién entonces lleva el Certificado de Calidad C4V y sale hacia ti.",
    porque: [
      { q: "¿Por qué existe?", a: "Una máquina láser es una inversión y una herramienta de trabajo. Si llega mal calibrada, es tu producción detenida. El certificado pone nuestro nombre detrás de cada máquina antes de que llegue a tus manos." },
      { q: "¿Por qué SIEMPRE la probamos?", a: "Cada máquina viaja miles de kilómetros. No asumimos que llegó perfecta: lo comprobamos, una por una, sin excepción. Preferimos encontrar cualquier detalle aquí y no que lo descubras tú en tu primer día." },
      { q: "¿Qué significa para ti?", a: "Recibes una máquina lista para producir, no un rompecabezas. Y si algún día algo falla, tienes nuestro nombre y tu garantía detrás." }
    ],
    faq: [
      { q: "¿Es lo mismo que la garantía?", a: "No. El certificado es la revisión previa a la entrega; la garantía (12 meses + RECI) cubre fallas después." },
      { q: "¿Dónde se hace la revisión?", a: "Al llegar al país, en nuestro almacén, antes de despachártela." },
      { q: "¿Cómo sé que mi máquina está certificada?", a: "Por el sello con tu código de máquina (Nº de serie) que acompaña a tu equipo." },
      { q: "¿Incluye instalación?", a: "Acompañamiento hasta el primer corte: remoto (6040/9060) o presencial (13100–18120)." }
    ]
  },

  modelos: {
    intro: "Línea PRO IA TEC (CO2). El número del modelo ≈ el área de trabajo en cm. Precios referenciales (Perú, ancla mar-2026) — confirma el vigente con tu asesor.",
    items: [
      { modelo: "4040", area: "40 × 40 cm", precio: "S/ 9,500", ideal: "Empezar, hobby, regalos" },
      { modelo: "6040", area: "60 × 40 cm", precio: "S/ 14,000", ideal: "Emprendimiento en crecimiento" },
      { modelo: "6090", area: "60 × 90 cm", precio: "S/ 17,500", ideal: "Producción media" },
      { modelo: "9060", area: "90 × 60 cm", precio: "S/ 24,000", ideal: "Producción media-alta" },
      { modelo: "1390", area: "130 × 90 cm", precio: "S/ 36,000", ideal: "Alta producción / piezas grandes" },
      { modelo: "1610", area: "160 × 100 cm", precio: "S/ 46,000", ideal: "Alta producción industrial" }
    ],
    incluye: "Todos incluyen capacitación + soporte en español + garantía + comunidad y banco de diseños.",
    materiales: "Corta y graba MDF/madera, acrílico, cuero, tela, papel/cartón y vinil. El CO2 no corta metal.",
    mejoras: "Soporte FLAT (4 succiones que nivelan en pisos no planos), sensores, refrigeración optimizada y mayor memoria de diseños."
  },

  about: {
    frase: "No vendemos solo una máquina: entregamos un ecosistema completo para que la uses al 100% y hagas crecer tu negocio.",
    valor: ["Alto soporte + precio accesible", "Soporte en español los 365 días del año", "Capacitación incluida e ilimitada", "Comunidad + asesoría de negocio con Irene Velasco", "Banco de diseños actualizado", "Garantía y repuestos como proveedor oficial (PE/EC/BO)", "Software propio en español"]
  },

  leads: [
    { id: "lead-1001", titulo: "Corte de 200 llaveros en MDF 3mm", descripcion: "Cortar y grabar 200 llaveros con logo para un evento corporativo.", material: "MDF 3mm", cantidad: "200 unidades", pais: "PE", ciudad: "Lima", contacto: "Mariana Torres", telefono: "+51 999 111 222", estado: "nuevo", tomado_por: null, fecha: "2026-06-28" },
    { id: "lead-1002", titulo: "Señalética acrílica para oficina", descripcion: "Letreros de puertas y directorio en acrílico cortado y grabado.", material: "Acrílico 5mm", cantidad: "15 piezas", pais: "EC", ciudad: "Quito", contacto: "Estudio Norte", telefono: "contacto@estudionorte.ec", estado: "nuevo", tomado_por: null, fecha: "2026-06-29" },
    { id: "lead-1003", titulo: "Toppers personalizados para repostería", descripcion: "Toppers de torta con nombres, varias temáticas, pedido recurrente.", material: "Acrílico espejo / MDF", cantidad: "50 semanales", pais: "PE", ciudad: "Arequipa", contacto: "Dulce Arte", telefono: "+51 954 300 100", estado: "nuevo", tomado_por: null, fecha: "2026-06-29" },
    { id: "lead-1004", titulo: "Personalización de polos con vinil", descripcion: "Corte de vinil textil para 80 polos personalizados.", material: "Vinil textil", cantidad: "80 polos", pais: "BO", ciudad: "Santa Cruz", contacto: "Pao Estampados", telefono: "+591 7 555 6677", estado: "tomado", tomado_por: "cli-003", fecha: "2026-06-25" }
  ],
  tickets: [
    { id: "TK-2001", tipo: "soporte", serie: "C4V-6040-PE-00123", pais: "PE", asunto: "El láser corta más débil de un lado", descripcion: "El corte no sale parejo: de un lado queda sin cortar.", estado: "en_proceso", prioridad: "alta", asignado_a: "Josafat", cliente_id: "cli-001", fecha: "2026-06-27" },
    { id: "TK-2002", tipo: "comercial", serie: "C4V-9060-EC-00210", pais: "EC", asunto: "Cotización de tubo láser de repuesto", descripcion: "Quiero cotizar un tubo de repuesto y filtros.", estado: "nuevo", prioridad: "media", asignado_a: "Equipo Comercial C4V Ecuador", cliente_id: "cli-002", fecha: "2026-06-29" }
  ],

  academia: {
    /* Las reglas que pueden costarte la máquina o un accidente. Van aquí, en el
       contenido de USO: en la guía de preparación asustaban a alguien que todavía
       no ha encendido nada. */
    seguridad: {
      titulo: "Tres cosas que no puedes saltarte",
      puntos: [
        { t: "Nunca cortes PVC", d: "Suelta gas cloro: te hace daño a ti y corroe la máquina por dentro." },
        { t: "Nunca enciendas el láser sin el enfriador", d: "El tubo se sobrecalienta y se quema. Es la falla más cara y la más fácil de evitar." },
        { t: "Nunca la dejes cortando sola", d: "Quédate cerca mientras trabaja. Ten el extintor a la mano." }
      ]
    },
    acceso: "Tu academia está aquí, en tu portal: acceso gratuito de por vida, incluido con tu máquina C4V. Todos los cursos, para todos los clientes.",
    plataforma: "Academia C4V, con CeVi el Toro y Lumo el Búho de guías",
    pilares: [
      { titulo: "C4V Tec, la parte técnica", detalle: "Operar la máquina y el software.", estado: "disponible", cursos: "4 cursos, 20 videos y 19 quizzes" },
      { titulo: "Quiero Emprender, la parte del negocio", detalle: "Qué producir y cómo venderlo (el diferenciador).", estado: "proximamente", cursos: "Contenido en preparación" },
      { titulo: "Irene Coach, la parte de mentalidad", detalle: "Mentalidad y ventas con Irene Velasco.", estado: "proximamente", cursos: "Contenido en preparación" }
    ],
    /* Ruta de aprendizaje: cada tramo apunta a lo que EXISTE. Los que aún no tienen
       curso se muestran como "próximamente" — nunca se finge contenido. */
    ruta: [
      { t: "Prepararte", href: "#/preparacion" },
      { t: "Operar", curso: "c1" },
      { t: "Mantener", curso: "c2" },
      { t: "Software", curso: "c3" },
      { t: "Producir", proximamente: "Tu primer producto en 30 minutos" },
      { t: "Especializarte", proximamente: "Tu primer mes vendiendo" }
    ],
    cursos: [
      {
        id: "c0", icono: "bienvenida", titulo: "Bienvenida a C4V: Tus Primeros Pasos", nivel: "Empieza aquí", estado: "disponible",
        descripcion: "Todo lo que necesitas apenas compras tu máquina: tus accesos, tu código, tu certificado y cómo prepararte. (~10 min)",
        modulos: [
          { titulo: "Tu compra y tus accesos", lecciones: ["Qué incluye tu compra C4V", "Cómo entrar a tu plataforma", "Tu código de máquina (Nº de serie): guárdalo bien"], quizzes: 3, preguntas: [
            { q: "Además de la máquina, ¿qué incluye tu compra C4V?", opciones: ["Solo la máquina", "Capacitación de por vida, soporte en español, garantía y comunidad", "Únicamente el software"], ok: 1, ex: "Tu compra incluye capacitación de por vida, soporte por WhatsApp, garantía y una comunidad de +60.000 emprendedores." },
            { q: "¿Cuánto cuesta el acceso a la Academia C4V?", opciones: ["Una suscripción mensual", "Es gratis de por vida, incluido con tu máquina", "Solo el primer mes"], ok: 1, ex: "Tu academia está aquí en tu portal: acceso gratuito de por vida, incluido con tu máquina." },
            { q: "Tu código de máquina (Nº de serie)…", opciones: ["Da igual si lo pierdes", "Identifica tu máquina y tu certificado: guárdalo bien", "Sirve solo para redes sociales"], ok: 1, ex: "El Nº de serie identifica tu máquina y tu Certificado de Calidad. Guárdalo bien." }
          ]},
          { titulo: "Tu Certificado de Calidad", lecciones: ["Qué es y qué garantiza tu máquina", "Cómo ver el estado de tu certificado", "«Probada antes de ser tuya»"], quizzes: 3, preguntas: [
            { q: "¿Qué es el Certificado de Calidad C4V?", opciones: ["La garantía de 12 meses", "La revisión, prueba y calibración de tu máquina antes de entregártela", "Un cupón de descuento"], ok: 1, ex: "Es la revisión: un técnico la prueba, confirma piezas originales y la calibra antes de que llegue a ti." },
            { q: "¿El certificado es lo mismo que la garantía?", opciones: ["Verdadero", "Falso"], ok: 1, ex: "No: el certificado es la revisión previa a la entrega; la garantía cubre fallas después." },
            { q: "El lema del Certificado de Calidad C4V es…", opciones: ["«Probada antes de ser tuya»", "«Compra sin miedo»", "«Garantía para siempre»"], ok: 0, ex: "«Probada antes de ser tuya»: no te entregamos una caja, sino una máquina lista para producir." }
          ]},
          { titulo: "Prepara tu espacio", lecciones: ["Lista de compras antes de que llegue", "Instalación eléctrica y pozo a tierra", "Ambiente y seguridad"], quizzes: 3, preguntas: [
            { q: "¿Qué debes tener listo ANTES de que llegue tu máquina?", opciones: ["Nada, se instala sola", "Todo el kit y la instalación eléctrica lista", "Solo el diseño"], ok: 1, ex: "Ten el espacio, el eléctrico y el kit listos para poder cortar el mismo día." },
            { q: "¿Se puede instalar sin pozo a tierra?", opciones: ["Sí, si hay apuro", "No: el pozo a tierra es obligatorio"], ok: 1, ex: "El pozo a tierra te protege a ti, a la electrónica y a la calidad del corte. Es la causa #1 de retrasos." }
          ]},
          { titulo: "Tu primera capacitación", lecciones: ["Continúa con 'Domina tu Láser: Primeros Pasos'", "Únete a la comunidad de +60.000", "Cómo pedir soporte cuando lo necesites"], quizzes: 3, preguntas: [
            { q: "Después de esta bienvenida, ¿cuál es el siguiente curso?", opciones: ["«Domina tu Láser: Primeros Pasos»", "«Seguridad y Mantenimiento»", "Ninguno, ya sabes todo"], ok: 0, ex: "Sigue con «Domina tu Láser: Primeros Pasos»: te lleva desde la preparación hasta tu primer corte." },
            { q: "¿Cómo pides soporte cuando lo necesitas?", opciones: ["Por WhatsApp, en español los 365 días", "Solo por correo postal", "No hay soporte"], ok: 0, ex: "Escríbenos por WhatsApp: te responde una persona del equipo C4V, en español, todo el año." },
            { q: "La comunidad de emprendedores C4V tiene…", opciones: ["+60.000 emprendedores", "Menos de 100 personas", "No existe"], ok: 0, ex: "Eres parte de una comunidad de +60.000 emprendedores que ya usan su láser C4V." }
          ]}
        ]
      },
      {
        id: "c1", icono: "laser", titulo: "Domina tu Láser: Primeros Pasos", nivel: "Básico", estado: "disponible",
        descripcion: "Desde antes de recibir la máquina hasta tu primer corte real, sin errores graves. (~25-35 min)",
        /* preguntas: { q, opciones, ok (índice correcto), ex (explicación de Lumo 🦉) } */
        modulos: [
          { titulo: "Prepárate antes de que llegue tu máquina", lecciones: ["220V + circuito independiente + cable a tierra", "Área limpia y ventilada", "Seguridad: extintor, gafas, ventilación", "Kit completo antes de la llegada", "Mentalidad de negocio"], quizzes: 7, preguntas: [
            { q: "¿Qué voltaje necesita tu máquina C4V?", opciones: ["110V", "220V", "380V"], ok: 1, ex: "220V, en un circuito independiente y con cable a tierra." },
            { q: "¿La máquina puede compartir enchufe con otros equipos?", opciones: ["Sí, mientras haya espacio", "No: necesita circuito independiente", "Solo si el cable es grueso"], ok: 1, ex: "Una línea eléctrica independiente evita sobrecargas y fallas." },
            { q: "¿Es opcional tener extintor antes de instalar la máquina?", opciones: ["Verdadero", "Falso"], ok: 1, ex: "La prevención es parte del estándar profesional C4V." },
            { q: "¿Se puede mirar el punto del láser directamente?", opciones: ["Sí, si es rápido", "Nunca: usa tus gafas de seguridad", "Solo con la tapa cerrada"], ok: 1, ex: "Nunca mires el láser. Las gafas de seguridad son obligatorias." },
            { q: "¿Con qué se limpian los lentes?", opciones: ["Agua con jabón", "Thinner", "Alcohol isopropílico"], ok: 2, ex: "Alcohol isopropílico con hisopos de alta calidad." },
            { q: "El agua destilada de tu kit sirve para…", opciones: ["El chiller (enfriamiento)", "Limpiar la mesa", "El compresor"], ok: 0, ex: "El agua destilada protege el tubo láser en el chiller." },
            { q: "El aceite 3-EN-UNO de tu kit sirve para…", opciones: ["El tubo láser", "Lubricar los rieles", "La lente"], ok: 1, ex: "Rieles limpios y lubricados = movimiento suave y preciso." }
          ]},
          { titulo: "Antes de encender: revisión general", lecciones: ["Extractor y compresor conectados", "Chiller con agua destilada", "Conexiones de agua (inlet / outlet)", "Máquina lista"], quizzes: 3, preguntas: [
            { q: "¿Qué tipo de agua debe usar el chiller?", opciones: ["Agua del caño", "Agua hervida", "Agua destilada", "Agua mineral"], ok: 2, ex: "El agua destilada protege el tubo láser." },
            { q: "Antes de encender, el extractor debe estar…", opciones: ["Guardado", "Conectado y listo", "Da igual"], ok: 1, ex: "Sin extracción, el humo regresa al cabezal y lo daña." },
            { q: "¿El agua común daña el tubo láser?", opciones: ["Verdadero", "Falso"], ok: 0, ex: "Sus minerales obstruyen y dañan el tubo. Solo destilada." }
          ]},
          { titulo: "Primer encendido seguro", lecciones: ["Orden: 1) Estabilizador → 2) Chiller → 3) Máquina", "Observar el panel Ruida", "Checklist sin alarmas", "Verificar conexiones eléctricas"], quizzes: 3, preguntas: [
            { q: "¿Cuál es el orden correcto de encendido?", opciones: ["Máquina → Chiller → Estabilizador", "Estabilizador → Chiller → Máquina", "Chiller → Máquina → Estabilizador"], ok: 1, ex: "1) Estabilizador · 2) Chiller · 3) Máquina. Siempre." },
            { q: "Si el panel muestra una alarma, ¿qué haces?", opciones: ["Sigo trabajando", "Apago todo y reviso las conexiones", "Subo la potencia"], ok: 1, ex: "Revisar primero es actuar como profesional." },
            { q: "¿El chiller se enciende antes que el láser?", opciones: ["Verdadero", "Falso"], ok: 0, ex: "El tubo necesita enfriamiento desde el primer segundo." }
          ]},
          { titulo: "Tu primer corte real", lecciones: ["Cargar archivo en RDWorks", "Potencia y velocidad", "MDF 3mm: potencia 20-35, velocidad 15-25", "Presionar START y evaluar"], quizzes: 3, preguntas: [
            { q: "¿Cuál es la mejor práctica para tu primer corte?", opciones: ["Usar potencia máxima", "Probar con un diseño pequeño", "Cortar una pieza grande"], ok: 1, ex: "Empezar pequeño reduce riesgos y no desperdicia material." },
            { q: "Para MDF de 3mm, ¿qué potencia usas?", opciones: ["20-35", "60-80", "90-100"], ok: 0, ex: "MDF 3mm: potencia 20-35, velocidad 15-25." },
            { q: "¿Conviene empezar con material grueso?", opciones: ["Verdadero", "Falso"], ok: 1, ex: "Empieza con 3mm para practicar y ajustar parámetros." }
          ]},
          { titulo: "Evaluación final del curso", lecciones: [], quizzes: 5, preguntas: [
            { q: "¿Qué voltaje usa tu máquina C4V?", opciones: ["110V", "220V", "440V"], ok: 1, ex: "220V con circuito independiente y pozo a tierra." },
            { q: "Secuencia de encendido correcta:", opciones: ["Estabilizador → Chiller → Máquina", "Máquina → Estabilizador → Chiller", "Chiller → Estabilizador → Máquina"], ok: 0, ex: "El orden correcto protege el tubo y la electrónica." },
            { q: "¿Se puede usar agua del grifo en el chiller?", opciones: ["Verdadero", "Falso"], ok: 1, ex: "Nunca: los minerales dañan el tubo. Solo agua destilada." },
            { q: "Los espejos se limpian con alcohol…", opciones: ["Etílico 70°", "Isopropílico", "De farmacia con glicerina"], ok: 1, ex: "Alcohol isopropílico + hisopo, en círculos y sin presión." },
            { q: "Antes de cortar, verifica que estén correctos…", opciones: ["Extractor, chiller y conexiones", "Solo el material", "Solo el diseño"], ok: 0, ex: "Extractor + chiller + conexiones = corte seguro." }
          ]}
        ]
      },
      {
        id: "c2", icono: "llave", titulo: "Seguridad, Limpieza y Mantenimiento", nivel: "Intermedio", estado: "disponible",
        descripcion: "Prevén fallas, extiende la vida útil y mantén el rendimiento. Requiere el Curso 1. (~30-40 min)",
        modulos: [
          { titulo: "Tu kit de mantenimiento (5 materiales)", lecciones: ["Agua destilada (Vistony)", "Aceite 3-EN-UNO para rieles", "Alcohol isopropílico", "Hisopos de alta calidad", "Paño de microfibra sin pelusa"], quizzes: 3, preguntas: [
            { q: "¿Qué agua va en el chiller?", opciones: ["Del grifo, hervida", "Destilada (de batería)", "Mineral"], ok: 1, ex: "Solo agua destilada. La marca de referencia es Vistony." },
            { q: "¿Con qué se lubrican los rieles?", opciones: ["Aceite de motor", "WD-40", "Aceite 3-EN-UNO"], ok: 2, ex: "Ni motor, ni WD-40, ni cocina: aceite 3-EN-UNO." },
            { q: "¿Sirven los hisopos genéricos para la lente?", opciones: ["Verdadero", "Falso"], ok: 1, ex: "Los baratos rayan la lente. Solo de alta calidad." }
          ]},
          { titulo: "Limpieza de lente y espejos", lecciones: ["Retirar la lente con cuidado", "Alcohol isopropílico + hisopo, circular y sin presión", "Misma técnica en los 3 espejos", "Mínimo cada 2 semanas con uso diario"], quizzes: 4, preguntas: [
            { q: "¿Con qué líquido se limpia la lente?", opciones: ["Agua con jabón", "Alcohol isopropílico", "Thinner"], ok: 1, ex: "Alcohol isopropílico (o alcohol 98% como alternativa)." },
            { q: "¿Cómo debe ser el movimiento al limpiar?", opciones: ["Circular, suave y sin presión", "De arriba a abajo, con fuerza", "En zigzag rápido"], ok: 0, ex: "Circular y suave: la presión daña el recubrimiento." },
            { q: "¿Cuántos espejos tiene tu máquina?", opciones: ["1", "2", "3"], ok: 2, ex: "Son 3 espejos, y se limpian con la misma técnica." },
            { q: "¿Una lente sucia hace perder potencia?", opciones: ["Verdadero", "Falso"], ok: 0, ex: "Los residuos absorben la energía del láser." }
          ]},
          { titulo: "Agua del enfriador (chiller)", lecciones: ["Solo agua destilada, nunca del grifo", "Cambio cada 2-4 semanas", "Temperatura ideal 15-25 °C"], quizzes: 4, preguntas: [
            { q: "¿Cada cuánto se cambia el agua del chiller?", opciones: ["Cada 6 meses", "Cada 2-4 semanas según el uso", "Nunca"], ok: 1, ex: "Cada 2 a 4 semanas, dependiendo de cuánto uses la máquina." },
            { q: "¿Por qué NO usar agua del grifo?", opciones: ["Es muy cara", "Sus minerales obstruyen y dañan el tubo", "Se evapora rápido"], ok: 1, ex: "Los residuos minerales dañan el tubo láser." },
            { q: "¿Cuál es la temperatura ideal del agua?", opciones: ["5-10 °C", "15-25 °C", "30-40 °C"], ok: 1, ex: "Entre 15 y 25 grados protege el tubo." },
            { q: "El agua del chiller debe ser…", opciones: ["Destilada", "Potable", "Con anticongelante casero"], ok: 0, ex: "Siempre destilada. Es la regla de oro del chiller." }
          ]},
          { titulo: "Lubricación y cuidado de rieles", lecciones: ["Limpiar con microfibra", "Aceite 3-EN-UNO en gotas", "Mover el cabezal para distribuir", "Semanal con uso diario"], quizzes: 3, preguntas: [
            { q: "¿Qué aceite se usa en los rieles?", opciones: ["De oliva", "3-EN-UNO", "De motor"], ok: 1, ex: "Aceite 3-EN-UNO en gotas, sobre el riel limpio." },
            { q: "Después de aplicar el aceite, ¿qué haces?", opciones: ["Enciendes a cortar de inmediato", "Mueves el cabezal para distribuirlo", "Lo dejas secar 24 h"], ok: 1, ex: "Mover el cabezal distribuye el aceite por todo el riel." },
            { q: "¿Lubricar cada 6 meses es suficiente?", opciones: ["Verdadero", "Falso"], ok: 1, ex: "Con uso diario, la lubricación es semanal." }
          ]},
          { titulo: "6 errores que destruyen tu máquina", lecciones: ["Encender sin chiller → tubo quemado", "Agua del grifo → residuos minerales", "No limpiar la lente → pierde potencia", "Cortar PVC → gas tóxico", "Máquina sin supervisión", "Calendario de mantenimiento"], quizzes: 4, preguntas: [
            { q: "¿Qué pasa si enciendes el láser sin chiller?", opciones: ["Nada, si es poco tiempo", "El tubo se quema por sobrecalentamiento", "Corta más rápido"], ok: 1, ex: "El tubo láser es la pieza más valiosa: nunca sin chiller." },
            { q: "¿Se puede cortar PVC con tu láser?", opciones: ["Sí, a baja potencia", "Nunca: genera gas cloro tóxico", "Solo con extractor"], ok: 1, ex: "El PVC libera cloro tóxico y daña la máquina. Prohibido." },
            { q: "¿Qué pasa si no limpias la lente?", opciones: ["Nada", "Pierde potencia gradualmente", "Corta mejor"], ok: 1, ex: "La suciedad absorbe energía: cortes débiles y disparejos." },
            { q: "La lente y los espejos se limpian cada…", opciones: ["2 semanas (con uso diario)", "6 meses", "Solo cuando falle"], ok: 0, ex: "Calendario: superficie a diario · rieles semanal · lente y espejos cada 2 semanas · agua mensual." }
          ]}
        ]
      },
      {
        id: "c3", icono: "monitor", titulo: "Domina C4VTech: Diseño y Corte (software)", nivel: "Intermedio", estado: "disponible",
        descripcion: "Curso completo en video del software propio C4VTech: de la instalación a tu primer proyecto real. (20 videos, ~37 min)",
        /* Lecciones en video: { t: título, v: archivo en videos/c4vtech/, dur: segundos } */
        modulos: [
          { titulo: "Instalación y conexión", quizzes: 4, preguntas: [
            { q: "¿Cómo se conecta la máquina a la computadora en C4VTech?", opciones: ["Solo por Bluetooth", "Por cable de red (Ethernet) o por USB", "Únicamente por WiFi"], ok: 1, ex: "C4VTech se conecta por cable de red (Ethernet) o por USB. Elige el método según tu equipo." },
            { q: "Para conectar por red, ¿qué dato de la máquina necesitas?", opciones: ["Su dirección IP", "El color del cable", "El modelo del mouse"], ok: 0, ex: "La conexión por red usa la IP de la máquina; el software te muestra cómo encontrarla." },
            { q: "¿Qué es el «origen» (Job Origin / Machine Zero)?", opciones: ["El punto desde donde la máquina empieza a trabajar tu diseño", "El botón de apagado", "El nombre del archivo"], ok: 0, ex: "El origen define desde qué punto de la mesa arranca el corte. Configurarlo evita errores de posición." },
            { q: "En la configuración inicial, además de la conexión, debes definir…", opciones: ["Las dimensiones (área de trabajo) de tu máquina", "El idioma del teclado", "La marca del monitor"], ok: 0, ex: "Indica el área de trabajo de tu modelo para que el software ubique bien tus diseños." }
          ], lecciones: [
            { t: "Intro: cortar y diseñar fácil con C4VTech", v: "t01.mp4", dur: 30 },
            { t: "Instalación del software", v: "t02.mp4", dur: 73 },
            { t: "Finalizar la instalación y crear tu primer proyecto", v: "t03.mp4", dur: 39 },
            { t: "Conectar la computadora a la máquina", v: "t06.mp4", dur: 51 },
            { t: "Conexión y configuración inicial (red / USB + dimensiones)", v: "t07.mp4", dur: 128 },
            { t: "Métodos de conexión de la máquina", v: "t05.mp4", dur: 20 },
            { t: "Encontrar la IP de la máquina", v: "t20.mp4", dur: 31 },
            { t: "Configurar el origen (Job Origin / Machine Zero)", v: "t04.mp4", dur: 26 }
          ]},
          { titulo: "Interfaz y herramientas de diseño", quizzes: 4, preguntas: [
            { q: "En C4VTech, las capas de color sirven para…", opciones: ["Solo decorar el diseño", "Separar grabado, corte y marcado con distintos parámetros", "Cambiar el idioma"], ok: 1, ex: "Cada color es una capa: le das su propia potencia y velocidad para grabar, cortar o marcar." },
            { q: "La herramienta «Array» sirve para…", opciones: ["Repetir y multiplicar un diseño en filas y columnas", "Borrar el diseño", "Conectar a internet"], ok: 0, ex: "Array duplica tu diseño en una cuadrícula: ideal para producir muchas piezas iguales." },
            { q: "La herramienta «Offset» sirve para…", opciones: ["Crear un borde o contorno paralelo alrededor de tu diseño", "Apagar la máquina", "Subir la potencia"], ok: 0, ex: "Offset genera un contorno a una distancia fija: perfecto para bordes y fondos." },
            { q: "Para poder cortar o grabar un texto, primero debes…", opciones: ["Convertir el texto a vector (curvas)", "Imprimirlo en papel", "Guardarlo como foto"], ok: 0, ex: "El texto se pasa a vector para que la máquina lo reconozca como líneas de corte o grabado." }
          ], lecciones: [
            { t: "Interfaz del programa C4VTech", v: "t08.mp4", dur: 123 },
            { t: "Barra de herramientas de diseño", v: "t09.mp4", dur: 94 },
            { t: "Herramientas Array y Offset", v: "t10.mp4", dur: 127 },
            { t: "Funciones clave: capas grabado / corte / marcado y texto a vector", v: "t11.mp4", dur: 209 }
          ]},
          { titulo: "Texto y vectores", quizzes: 4, preguntas: [
            { q: "La herramienta «Weld» (soldar) se usa para…", opciones: ["Unir letras u objetos que se tocan en una sola pieza", "Separar el diseño en partes", "Borrar el texto"], ok: 0, ex: "Weld funde en una sola figura las letras u objetos superpuestos, sin líneas internas." },
            { q: "La herramienta «Bridge» (puente) sirve para…", opciones: ["Unir letras sueltas con pequeños puentes para que no se caigan al cortar", "Cambiar el color del diseño", "Aumentar la velocidad"], ok: 0, ex: "Bridge crea puentecitos que sujetan las letras entre sí para que la palabra quede de una pieza." },
            { q: "¿Por qué son importantes los puentes (Bridge) en toppers y letras?", opciones: ["Para que las partes internas o las letras no se desprendan al cortar", "Para gastar más material", "No sirven de nada"], ok: 0, ex: "Sin puentes, las letras o los centros de la 'a' y la 'o' se caen. Los puentes los mantienen unidos." },
            { q: "La «vectorización» de una imagen sirve para…", opciones: ["Convertir una foto o logo en líneas que la máquina puede cortar o grabar", "Subir la imagen a internet", "Imprimir a color"], ok: 0, ex: "Vectorizar transforma un logo o imagen en trazos que el láser sí puede seguir." }
          ], lecciones: [
            { t: "Texto y selección de fuentes", v: "t13.mp4", dur: 88 },
            { t: "Herramienta Weld (soldar texto)", v: "t14.mp4", dur: 100 },
            { t: "Herramienta Bridge (unir letras y objetos)", v: "t15.mp4", dur: 111 },
            { t: "Herramienta Offset (bordes y fondos para toppers)", v: "t17.mp4", dur: 171 },
            { t: "Vectorización de imágenes", v: "t18.mp4", dur: 188 }
          ]},
          { titulo: "Proyectos reales", quizzes: 4, preguntas: [
            { q: "Para enviar tu proyecto a la máquina y cortar, en C4VTech usas…", opciones: ["El botón de enviar/Start hacia la máquina conectada", "El correo electrónico", "Un USB de música"], ok: 0, ex: "Con la máquina conectada, envías el trabajo y presionas Start para que empiece a cortar." },
            { q: "Antes de cortar tu primer proyecto real, la buena práctica es…", opciones: ["Probar en un retazo del mismo material", "Usar potencia máxima de una vez", "Cortar directo la pieza final"], ok: 0, ex: "Regla de oro C4V: prueba primero en un retazo — cada máquina y material varía un poco." },
            { q: "Un topper con «puente y base» combina…", opciones: ["Texto con puentes (Bridge) más una base o soporte para pararlo", "Solo una fotografía", "Nada en especial"], ok: 0, ex: "El puente une las letras y la base le da soporte para que el topper se pare solo." },
            { q: "Antes de mandar a cortar, revisa que cada capa tenga…", opciones: ["La potencia y velocidad correctas según el material", "El mismo color siempre", "El volumen alto"], ok: 0, ex: "Cada capa (grabar / cortar / marcar) necesita sus parámetros según el material que uses." }
          ], lecciones: [
            { t: "Topper personalizado con puente y base", v: "t16.mp4", dur: 126 },
            { t: "Enviar el proyecto a la máquina y cortar", v: "t12.mp4", dur: 76 },
            { t: "Proyecto integral: llavero familiar", v: "t19.mp4", dur: 405 }
          ]},
          { titulo: "Evaluación final del curso", quizzes: 6, lecciones: [], preguntas: [
            { q: "¿Por qué medios puedes conectar la máquina a la computadora en C4VTech?", opciones: ["Por cable de red (Ethernet) o por USB", "Solo por Bluetooth", "Solo por WiFi público"], ok: 0, ex: "C4VTech se conecta por cable de red (Ethernet) o por USB; eliges el método según tu equipo." },
            { q: "En el panel de capas, cada color sirve para…", opciones: ["Decorar el diseño nada más", "Asignar potencia y velocidad propias a grabado, corte o marcado", "Cambiar el idioma del software"], ok: 1, ex: "Cada color es una capa con sus propios parámetros: así separas grabar, cortar y marcar en un mismo diseño." },
            { q: "Para producir muchas piezas iguales en una cuadrícula usas…", opciones: ["La herramienta Array", "La herramienta Weld", "El botón de apagado"], ok: 0, ex: "Array duplica tu diseño en filas y columnas: ideal para producción en serie." },
            { q: "Para que las letras de un topper no se caigan al cortar, usas…", opciones: ["Bridge (puentes que las unen)", "Máxima potencia", "Solo una fotografía"], ok: 0, ex: "Bridge crea puentecitos que mantienen las letras unidas como una sola pieza." },
            { q: "Convertir un logo o foto en líneas que el láser pueda seguir se llama…", opciones: ["Vectorizar la imagen", "Subirla a internet", "Imprimirla a color"], ok: 0, ex: "La vectorización transforma la imagen en trazos que la máquina reconoce para cortar o grabar." },
            { q: "Antes de cortar tu primer proyecto real, la regla de oro C4V es…", opciones: ["Probar primero en un retazo del mismo material", "Usar potencia máxima de una vez", "Cortar directo la pieza final"], ok: 0, ex: "Prueba siempre en un retazo: cada máquina y material varía un poco y así no arruinas la pieza final." }
          ]}
        ]
      }
    ],
    proximamente: [
      "Instalación completa 9060 / 6040 (en video)",
      "Módulo de rotación y mesa extendida (en video)",
      "Tu primer producto en 30 minutos",
      "Tu primer mes vendiendo"
    ],
    /* Tabla oficial de parámetros por material (PARAMETROS_C4V Laser.pdf) */
    parametros: {
      intro: "La tabla oficial C4V de potencia y velocidad por material. Regla de oro: SIEMPRE prueba primero en un retazo — cada máquina y material varía un poco.",
      nota: "El «Seal» (intervalo de escaneo) se usa SOLO para grabado. (*) Tela y cuero varían mucho en grosor y densidad: si no corta o se quema, escríbenos a soporte.",
      filas: [
        { m: "MDF", g: "3 mm",  corte: "20-35 / 15-25", marcado: "10-20 / 40-90", grabado: "15-35 / 100-400", seal: "0.05-0.01" },
        { m: "MDF", g: "5 mm",  corte: "30-45 / 10-20", marcado: "10-20 / 40-90", grabado: "15-35 / 100-400", seal: "0.05-0.01" },
        { m: "MDF", g: "9 mm",  corte: "45-60 / 5-15",  marcado: "10-20 / 40-90", grabado: "15-35 / 100-400", seal: "0.05-0.01" },
        { m: "Acrílico", g: "2 mm", corte: "35 / 25", marcado: "10-20 / 40-90", grabado: "15-35 / 100-400", seal: "0.05-0.01" },
        { m: "Acrílico", g: "3 mm", corte: "35 / 20", marcado: "10-20 / 40-90", grabado: "15-35 / 100-400", seal: "0.05-0.01" },
        { m: "Acrílico", g: "4 mm", corte: "40 / 20", marcado: "10-20 / 40-90", grabado: "15-35 / 100-400", seal: "0.05-0.01" },
        { m: "Acrílico", g: "5 mm", corte: "55 / 10", marcado: "10-20 / 40-90", grabado: "15-35 / 100-400", seal: "0.05-0.01" },
        { m: "Papel bond", g: "80 g", corte: "10-15 / 70-100", marcado: "10-20 / 40-90", grabado: "—", seal: "—" },
        { m: "Cartulina", g: "—", corte: "15-25 / 20-40", marcado: "10-20 / 40-90", grabado: "10-15 / 200-400", seal: "0.05-0.01" },
        { m: "Cartulina metalizada", g: "—", corte: "20 / 50", marcado: "10-20 / 40-90", grabado: "10-15 / 200-400", seal: "0.05-0.01" },
        { m: "Cartulina tarjetería", g: "—", corte: "15 / 40", marcado: "10-20 / 40-90", grabado: "10-15 / 200-400", seal: "0.05-0.01" },
        { m: "Tela*", g: "—", corte: "15-30 / 20-60", marcado: "10-20 / 40-90", grabado: "10-15 / 200-400", seal: "0.05-0.01" },
        { m: "Cartón micro corrugado", g: "2 mm", corte: "30 / 55-60", marcado: "10-20 / 40-90", grabado: "10-15 / 200-400", seal: "0.05-0.01" },
        { m: "Cartón corrugado", g: "4 mm", corte: "30 / 25", marcado: "10-20 / 40-90", grabado: "10-15 / 200-400", seal: "0.05-0.01" },
        { m: "Cartón doble corrugado", g: "8 mm", corte: "25 / 20", marcado: "10-20 / 40-90", grabado: "10-15 / 200-400", seal: "0.05-0.01" },
        { m: "Cartón prensado", g: "—", corte: "30 / 30", marcado: "10-20 / 40-90", grabado: "10-15 / 200-400", seal: "0.05-0.01" },
        { m: "Corospum / fomix", g: "—", corte: "15-20 / 30-50", marcado: "10-20 / 40-90", grabado: "10-15 / 200-400", seal: "0.05-0.01" },
        { m: "Cuero*", g: "—", corte: "15-40 / 20-40", marcado: "10-20 / 40-90", grabado: "10-20 / 100-400", seal: "0.05-0.01" },
        { m: "Vidrio", g: "—", corte: "No se corta", marcado: "10-20 / 40-90", grabado: "15-35 / 100-400", seal: "0.05-0.01" }
      ],
      rdworks: [
        "Abre el programa RDWorks",
        "Haz clic en «Importar» y coloca tu diseño",
        "Busca tu archivo, selecciónalo y haz clic en «Open»",
        "En el panel de capas (colores), ajusta potencia, velocidad y seal (el seal solo para grabado)",
        "Presiona «Start» y ¡listo! Tu proyecto está cortando"
      ]
    },
    /* Guías técnicas oficiales en PDF (portal/public/guias/) */
    guiasPdf: [
      { curso: "c1", archivo: "instalacion-9060-6040.pdf", titulo: "Instalación de tu máquina (9060 / 6040)", desc: "Armado de la base, ruedas y montaje, paso a paso con fotos", tam: "0.5 MB" },
      { curso: "c1", archivo: "parametros.pdf", titulo: "Parámetros por material", desc: "La tabla oficial de potencia y velocidad + tutorial RDWorks", tam: "4.4 MB" },
      { curso: "c2", archivo: "mantenimiento.pdf", titulo: "Mantenimiento completo", desc: "Normas de uso, limpieza de lente y espejos, chiller y rieles", tam: "1.4 MB" },
      { curso: "c2", archivo: "limpieza.pdf", titulo: "Limpieza rápida", desc: "La rutina corta de limpieza de óptica", tam: "0.2 MB" },
      { curso: "c3", archivo: "instalar-rdworks.pdf", titulo: "Instalar RDWorks", desc: "Cómo instalar el software de corte en tu computadora", tam: "0.4 MB" },
      { curso: "c3", archivo: "cable-red.pdf", titulo: "Conexión por cable de red", desc: "Conecta la máquina a tu computadora por red", tam: "0.6 MB" },
      { curso: "c3", archivo: "modulo-rotacion.pdf", titulo: "Módulo de rotación", desc: "Instala y usa el rotativo para vasos y cilindros", tam: "0.4 MB" },
      { curso: "c1", archivo: "mesa-extendida.pdf", titulo: "Mesa extendida", desc: "Uso de la mesa extendida para piezas grandes", tam: "0.8 MB" }
    ]
  },

  preparacion: {
    intro: "",

    /* Guía deliberadamente CORTA. Antes tenía ocho compras, siete pasos, tiempos
       estimados y avisos de urgencia. Todo eso se leía como una lista de
       impedimentos antes de poder usar la máquina. Ahora: compra lo que se usa a
       diario, y cinco pasos. Lo que depende del modelo (estabilizador, extractor)
       vive dentro del paso que le toca, con los datos ya puestos, para que nadie
       tenga que pedir una ficha antes de empezar. */

    compras: [
      { item: "Agua destilada", img: "agua.png", para: "Para el enfriador",
        spec: "Dos galones. En las tiendas se pide como «agua de batería». No uses agua del caño ni hervida.",
        donde: "Grifos, lubricentros y ferreterías" },
      { item: "Alcohol isopropílico, hisopos y paño de microfibra", img: "alcohol.png", para: "Para limpiar el lente y los espejos",
        spec: "Alcohol al 99%. El de farmacia tiene agua y mancha el lente.",
        donde: "Tiendas de electrónica" },
      { item: "Aceite 3-EN-1", img: "aceite.png", para: "Para los rieles",
        spec: "Marca 3-EN-UNO. No sirve el WD-40.",
        donde: "Ferreterías" },
      { item: "Extintor", img: "extintor.png", para: "Por seguridad",
        spec: "De polvo químico seco, tipo ABC. Cuélgalo cerca de la máquina.",
        donde: "Tiendas de seguridad industrial" },
      { item: "Material para practicar", img: "material.png", para: "Para tus primeros cortes",
        spec: "Madera, MDF, acrílico, cartón, cuero, tela o papel, de 3 mm. Nunca PVC.",
        donde: "Madereras y tiendas de acrílico" }
    ],

    /* Cinco pasos, uno por pantalla. El «cómo se hace» va escrito en la propia
       pantalla del paso: antes estaba escondido detrás de un «¿Cómo lo hago?»
       que había que pulsar, y nadie pulsa lo que no sabe que necesita. */
    checklist: [
      { id: "p1", t: "Compra lo que necesitas", lista: true },
      { id: "p2", t: "Mide las puertas y el camino", img: "puerta.png", detalle: [
        "Mide el ancho y el alto de las puertas, los pasillos y los giros de escalera.",
        "Escríbenos y te pasamos las medidas de la caja de tu máquina.",
        "Si algo no pasa, avísanos antes de la entrega y lo vemos juntos."
      ] },
      { id: "p3", t: "Deja lista la electricidad", img: "electrico.png", detalle: [
        "Llama a un electricista y pídele un punto de 220V solo para la máquina, con cable de cobre número 12.",
        "En tu tablero: un térmico de 20 amperios y un diferencial de 30 A / 30 mA.",
        "Pozo a tierra con varilla de cobre enterrada.",
        "Compra un estabilizador de 3000VA como mínimo, tipo servomotor."
      ] },
      { id: "p4", t: "Prepara tu zona de trabajo", img: "extractor.png", detalle: [
        "Elige un lugar firme y parejo, con espacio para abrir la tapa y pasar alrededor.",
        "Compra un extractor con su manguera de aluminio y dos abrazaderas.",
        "Ponlo con salida a la calle, no a un ducto compartido."
      ] },
      { id: "p5", t: "Ten lista tu computadora", img: "computadora.png", detalle: [
        "Cualquier computadora con Windows sirve. Windows 11 de preferencia.",
        "Déjala cerca de la máquina, con su cable USB a la mano.",
        "El programa de corte lo instalamos contigo el día de la entrega."
      ] }
    ],

    modelos: "Las máquinas compactas (4040, 6040, 6090 y 9060) se instalan de forma remota: un ingeniero te acompaña por videollamada hasta tu primer corte. Las grandes (1390 y 1610) llevan instalación presencial incluida y necesitan más espacio y más capacidad eléctrica."
  },


  faqs: [
    { categoria: "Instalación", pregunta: "¿Qué voltaje y conexión eléctrica necesita la máquina?", respuesta: "220 V en circuito independiente con cable de tierra. No la conectes en zapatillas con otros equipos. El estabilizador de voltaje es obligatorio." },
    { categoria: "Instalación", pregunta: "¿Qué debo tener listo antes de que llegue la máquina?", respuesta: "Línea de 220 V, circuito independiente, cable de tierra, área limpia y ventilada, extintor, extractor de humos y el kit de mantenimiento. Ten todo antes de la llegada para operar el primer día." },
    { categoria: "Instalación", pregunta: "¿En qué orden enciendo todo la primera vez?", respuesta: "Siempre: 1) estabilizador, 2) chiller (con agua destilada) en marcha, 3) recién la máquina. Nunca enciendas el láser sin el chiller activo." },
    { categoria: "Operación", pregunta: "¿Empiezo cortando material grueso o delgado?", respuesta: "Empieza con material delgado (~3 mm) mientras aprendes. Cuando domines los parámetros, escala a grosores mayores." },
    { categoria: "Operación", pregunta: "¿Qué potencia y velocidad uso para MDF de 3 mm?", respuesta: "Potencia 20-35 %, velocidad 15-25 mm/s. Empieza en 20 y 20, y ajusta según el primer corte." },
    { categoria: "Operación", pregunta: "¿Y para acrílico de 5 mm?", respuesta: "Potencia ~60 %, velocidad ~8 mm/s. Empieza en 50 y ajusta según el resultado." },
    { categoria: "Operación", pregunta: "¿Qué hago si el panel muestra una alarma?", respuesta: "Apaga la máquina de inmediato. Revisa conexiones eléctricas, el chiller y las conexiones de agua. Si la alarma persiste tras reiniciar, contacta soporte con el código exacto." },
    { categoria: "Mantenimiento", pregunta: "¿Cómo limpio la lente y los espejos?", respuesta: "Retira la lente con cuidado y aplica alcohol isopropílico con un hisopo de alta calidad, en movimiento circular suave y sin presión. Misma técnica para los 3 espejos. Cada 2 semanas si usas la máquina a diario." },
    { categoria: "Mantenimiento", pregunta: "¿Qué agua va en el enfriador (chiller) y cada cuánto se cambia?", respuesta: "Solo agua destilada (nunca del grifo: los minerales obstruyen y dañan el tubo). Cambio cada 2-4 semanas según uso." },
    { categoria: "Mantenimiento", pregunta: "¿Cuál es la temperatura ideal del enfriador (chiller)?", respuesta: "Entre 15 y 25 °C. Si sube de 25, apaga y deja enfriar antes de seguir cortando." },
    { categoria: "Mantenimiento", pregunta: "¿Cómo lubrico los rieles y cada cuánto?", respuesta: "Limpia con paño de microfibra, aplica unas gotas de aceite 3-EN-UNO y mueve el cabezal a mano para distribuir. Semanal si usas la máquina a diario." },
    { categoria: "Mantenimiento", pregunta: "¿Cada cuánto hago mantenimiento?", respuesta: "Diario: limpieza de superficie. Semanal: lubricar rieles. Cada 2 semanas: limpiar lente y espejos. Mensual: cambiar agua del chiller." },
    { categoria: "Materiales", pregunta: "¿Qué materiales puedo cortar y grabar?", respuesta: "Madera, MDF, acrílico, cartón, cuero, tela, papel y caucho. No cortes PVC ni metales. Ante un material nuevo con dudas, consulta a soporte." },
    { categoria: "Seguridad", pregunta: "¿Puedo cortar PVC?", respuesta: "No, nunca. Genera gas cloro tóxico que daña la máquina y es peligroso para tu salud." },
    { categoria: "Seguridad", pregunta: "¿Necesito gafas para mirar el láser?", respuesta: "No mires directamente al haz. La puerta de la máquina tiene protección UV: opera siempre con la tapa cerrada." },
    { categoria: "Seguridad", pregunta: "¿Es obligatorio el extractor de humos?", respuesta: "Sí, obligatorio. Los gases del corte son tóxicos. Nunca operes sin el extractor conectado y funcionando." },
    { categoria: "Operación", pregunta: "¿Puedo dejar la máquina cortando sola?", respuesta: "No, nunca. No dejes la máquina operando sin supervisión: un corte mal calibrado o un material inflamable pueden causar un accidente. Quédate cerca mientras trabaja." },
    { categoria: "Materiales", pregunta: "¿Cómo sé qué potencia y velocidad usar en un material nuevo?", respuesta: "Consulta la tabla oficial de parámetros por material (en «Aprender a usar mi máquina»). Regla de oro: SIEMPRE prueba primero en un retazo del mismo material, porque cada máquina y material varía un poco." },
    { categoria: "Software", pregunta: "¿Con qué programa diseño y corto?", respuesta: "Con C4VTech, el software propio en español, incluido con tu máquina. Tienes el curso completo en video («Domina C4VTech: Diseño y Corte») dentro de tu Academia, de la instalación a tu primer proyecto real." },
    { categoria: "Software", pregunta: "¿Cómo conecto la computadora a la máquina?", respuesta: "Por cable de red (Ethernet) o por USB. Para la conexión por red necesitas la IP de la máquina, que encuentras en el panel Ruida (Controller → Network). El curso de software te muestra cada paso." },
    { categoria: "Garantía", pregunta: "¿Qué garantía tiene mi máquina?", respuesta: "Garantía C4V de 12 meses por la máquina, más la garantía exclusiva RECI del tubo láser en Perú, Ecuador y Bolivia. La garantía es independiente del Certificado de Calidad: el certificado es la revisión previa a la entrega; la garantía cubre fallas después." },
    { categoria: "Garantía", pregunta: "¿La garantía cubre cualquier falla?", respuesta: "Cubre fallas de fábrica y de piezas en condiciones normales de uso. No cubre daños por mal uso, como cortar PVC, encender el láser sin el chiller, usar agua del grifo o no hacer el mantenimiento. Cuida esos puntos y tu máquina dura muchos años." },
    { categoria: "Garantía", pregunta: "¿El tubo láser tiene una garantía aparte?", respuesta: "Sí. Además de la garantía de la máquina, el tubo láser tiene la garantía exclusiva RECI en Perú, Ecuador y Bolivia. Es un diferencial de C4V como proveedor oficial." },
    { categoria: "Envío e instalación", pregunta: "¿Cómo se instala mi máquina?", respuesta: "Depende del modelo. Las compactas (6040 / 9060) se instalan de forma remota con acompañamiento del ingeniero hasta tu primer corte. Las grandes (13100–18120) llevan instalación presencial incluida. Tu asesor confirma lo específico de tu equipo." },
    { categoria: "Envío e instalación", pregunta: "¿Qué debo tener listo para poder cortar el mismo día que llega?", respuesta: "Tu espacio preparado según la guía de preinstalación: 220V dedicado, pozo a tierra, extractor con salida al exterior, agua destilada para el chiller y el kit de consumibles. Si preparas todo antes, produces desde el día 1. La causa #1 de retrasos es el pozo a tierra." },
    { categoria: "Envío e instalación", pregunta: "¿La máquina va a pasar por la puerta?", respuesta: "Llega embalada en una caja grande. Antes del despacho, mide el ancho y alto de todas las puertas, pasillos y giros del recorrido; el marco de la puerta se puede retirar para ganar centímetros. Si tienes dudas, mándanos fotos y medidas por WhatsApp y lo revisamos contigo." },
    { categoria: "Garantía y soporte", pregunta: "¿Tengo capacitación incluida?", respuesta: "Sí, acceso gratuito de por vida a la Academia C4V, aquí mismo en tu portal (sección «Aprender a usar mi máquina»). Se activa con tu compra. Todos los cursos, para todos los clientes." },
    { categoria: "Garantía y soporte", pregunta: "¿Qué incluye mi compra además de la máquina?", respuesta: "Capacitación de por vida, soporte técnico en español por WhatsApp, garantía RECI del tubo láser, comunidad de +60.000 emprendedores y asesora dedicada por país." },
    { categoria: "Garantía y soporte", pregunta: "¿Cómo pido soporte y a qué número escribo?", respuesta: "Escríbenos por WhatsApp al +51 924 662 205, en español los 365 días del año. Es el único número oficial: escribe ahí (no al celular personal de un técnico) para que tu caso quede registrado y nunca se pierda." },
    { categoria: "Garantía y soporte", pregunta: "Abrí un caso de soporte, ¿cómo sé cómo va?", respuesta: "Te avisamos por WhatsApp en cada avance: cuando lo recibimos, cuando un técnico lo toma y cuando queda resuelto. No tienes que entrar a revisar nada ni repetir tu problema: el equipo ya tiene todo el contexto de tu máquina." },
    { categoria: "La academia", pregunta: "¿Los cursos tienen algún costo?", respuesta: "No. La Academia C4V es gratuita de por vida y está incluida con tu máquina. Todos los cursos, para todos los clientes, sin suscripciones." },
    { categoria: "La academia", pregunta: "¿Por dónde empiezo a aprender?", respuesta: "Sigue la ruta: «Bienvenida: Tus Primeros Pasos», luego «Domina tu Láser: Primeros Pasos», «Seguridad, Limpieza y Mantenimiento» y «Domina C4VTech: Diseño y Corte». Cada curso tiene lecciones, quizzes y una evaluación final para que midas tu avance." }
  ],

  soporte_guia: [
    { titulo: "El láser perdió fuerza / no corta como antes", sintoma: "No atraviesa el material o el corte salió débil.", causas: "Lente sucia (los residuos absorben energía) o tubo agotado.", accion: "Limpia el lente con alcohol isopropílico y haz un corte de prueba. Si sigue débil, escríbenos por WhatsApp: puede ser el tubo." },
    { titulo: "Encendí la máquina sin el chiller", sintoma: "El láser operó sin enfriamiento.", causas: "El tubo se sobrecalienta y puede quemarse.", accion: "Apaga de inmediato. Si estuvo prendido más de 10 segundos sin enfriamiento, NO la uses y escríbenos por WhatsApp ahora mismo." },
    { titulo: "El panel Ruida muestra una alarma", sintoma: "Alarma, pitido o código en el panel.", causas: "Conexión eléctrica, chiller o conexiones de agua.", accion: "Apaga, revisa las conexiones, el enfriador y el agua, y vuelve a encender. Si sigue igual, escríbenos por WhatsApp con el código que ves en la pantalla." },
    { titulo: "El chiller se sobrecalienta (>25 °C)", sintoma: "La temperatura sube del rango 15-25 °C.", causas: "Nivel de agua bajo, agua del grifo o uso prolongado.", accion: "Apaga y deja que enfríe. Revisa el nivel y que sea agua destilada, y cámbiala si toca. Si sigue igual, escríbenos por WhatsApp." },
    { titulo: "Se intentó cortar PVC u otro material no permitido", sintoma: "Olor fuerte, humo anormal o residuos.", causas: "El PVC genera gas cloro tóxico que daña la máquina.", accion: "Detén el corte, ventila el ambiente y limpia los residuos. Usa solo materiales permitidos. Si después falla algo, escríbenos por WhatsApp y dinos qué material era." }
  ],

  plantillas: {
    intro: "El Banco de Diseños C4V: diseños listos para cortar, actualizados por campañas e industrias — incluidos con tu máquina.",
    estado: "Próximamente en el portal (los diseños se cargan como archivos .DXF/.SVG que leen los softwares).",
    categorias: [
      { id: "llaveros", categoria: "Llaveros", key: "llaveros", descripcion: "Llaveros en acrílico, madera y cuero.", ejemplos: ["Packs temáticos", "Con nombre", "Corporativos"], formato: "SVG / DXF" },
      { id: "cajas", categoria: "Cajas y Packaging", key: "cajas", descripcion: "Cajas ensamblables, empaques y bases de torta.", ejemplos: ["Cajas MDF sin pegamento", "Empaques personalizados", "Bases de torta"], formato: "SVG / DXF" },
      { id: "senaletica", categoria: "Señalética", key: "senaletica", descripcion: "Letreros, placas y letras volumétricas.", ejemplos: ["Letreros de puerta", "Directorios", "Letras volumétricas"], formato: "DXF" },
      { id: "toppers", categoria: "Toppers y Decoración", key: "toppers", descripcion: "Toppers de torta, place cards y números de mesa.", ejemplos: ["Toppers por temática", "Place cards", "Números de mesa"], formato: "SVG" },
      { id: "moda", categoria: "Moda y Vinil", key: "moda", descripcion: "Patrones textiles y marcados en vinil.", ejemplos: ["Vinil textil", "Etiquetas", "Marcado en jeans"], formato: "SVG" },
      { id: "arquitectura", categoria: "Arquitectura y Maquetas", key: "arquitectura", descripcion: "Módulos y planos cortables para maquetas.", ejemplos: ["Módulos de maqueta", "Planos en fibra", "Diseño interior"], formato: "DXF" },
      { id: "regalos", categoria: "Regalos Corporativos", key: "regalos", descripcion: "Marcos, portarretratos y trofeos.", ejemplos: ["Portarretratos", "Trofeos en acrílico", "Reconocimientos"], formato: "SVG / DXF" }
    ]
  },

  bienvenida: {
    mensaje: "Estamos preparando tu máquina para entregártela con el Certificado de Calidad C4V. Mientras tanto, aquí tienes todo para prepararte y aprovechar tu capacitación desde el primer día."
  },

  onboarding: [
    { id: "espacio", titulo: "Prepara tu espacio", detalle: "Empieza aquí: sigue la guía de preinstalación (eléctrico, pozo a tierra, extracción y agua destilada). Al completarla se desbloquea el resto de tu portal.", href: "#/preparacion", img: "e8-espacio.jpg" },
    { id: "cert", titulo: "Conoce tu Certificado de Calidad", detalle: "Mira el estado de tu máquina y qué garantiza: probada, calibrada y lista antes de llegar a ti.", href: "#/certificado" },
    { id: "curso", titulo: "Haz el curso «Bienvenida: tus primeros pasos»", detalle: "10 minutos para conocer tu plataforma y arrancar con el pie derecho.", href: "#/academia" },
    { id: "soporte", titulo: "Ten a mano tu soporte", detalle: "WhatsApp 924 662 205, en español los 365 días. Y descubre la Bolsa de Trabajos gratis para clientes.", href: "#/soporte" }
  ]
};
