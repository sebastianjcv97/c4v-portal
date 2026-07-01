/* Datos del portal C4V (fuente única de verdad).
   - En modo DEMO (preview sin servidor) el frontend usa window.__SEED__.
   - Con `npm start`, el servidor lee ESTE archivo para sembrar data/db.json.
   Contenido real extraído del ecosistema C4V (C4V School, KB CeVi, PRODUCT.md). */
window.__SEED__ = {
  meta: { marca: "C4V Láser", portal: "Central de Postventa C4V", paises: ["PE", "EC", "BO"] },

  soporte: {
    whatsapp: "+51 924 662 205",
    wa_link: "https://wa.me/51924662205",
    fijo: "905474440",
    horario: "Soporte en español los 365 días",
    lives: "TikTok @c4vlaser — L a V 1:00 p.m. y 6:00 p.m. · Sábados 11:30 a.m.",
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
    { id: "c-bo", nombre: "Equipo Comercial C4V Bolivia", pais: "BO" }
  ],
  clientes: [
    { id: "cli-001", nombre: "Carla Méndez", empresa: "Creativa Láser EIRL", pais: "PE", ciudad: "Lima", email: "carla@creativalaser.pe", telefono: "+51 987 654 321" },
    { id: "cli-002", nombre: "Diego Salazar", empresa: "TallerMaker", pais: "EC", ciudad: "Quito", email: "diego@tallermaker.ec", telefono: "+593 99 123 4567" },
    { id: "cli-003", nombre: "Rosa Quispe", empresa: "Detalles Andinos", pais: "BO", ciudad: "La Paz", email: "rosa@detallesandinos.bo", telefono: "+591 7 123 4567" }
  ],
  maquinas: [
    { serie: "C4V-6040-PE-00123", modelo: "6040", tipo: "CO2", area: "600 x 400 mm", pais: "PE", cliente_id: "cli-001", fecha_entrega: "2026-03-12", certificado: { estado: "certificada", fecha: "2026-03-10", tecnico: "Josafat" } },
    { serie: "C4V-9060-EC-00210", modelo: "9060", tipo: "CO2", area: "900 x 600 mm", pais: "EC", cliente_id: "cli-002", fecha_entrega: "2026-05-02", certificado: { estado: "certificada", fecha: "2026-04-30", tecnico: "Equipo EC" } },
    { serie: "C4V-1390-BO-00078", modelo: "1390", tipo: "CO2", area: "1300 x 900 mm", pais: "BO", cliente_id: "cli-003", fecha_entrega: "2026-06-20", certificado: { estado: "en_proceso", fecha: null, tecnico: "Aldo" } }
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
      { n: 1, titulo: "Origen — Fábrica China", detalle: "Selección, piezas originales y control de calidad en planta." },
      { n: 2, titulo: "Certificación", detalle: "Pruebas, piezas originales y calibración al llegar al país." },
      { n: 3, titulo: "Transporte & seguridad", detalle: "Sellado, stickers de seguridad y trazabilidad por Nº de serie." },
      { n: 4, titulo: "Preinstalación", detalle: "Lista de compras, instalación eléctrica, pozo a tierra y ambiente." },
      { n: 5, titulo: "Entrega & sello", detalle: "Puesta en marcha hasta el primer corte y activación del certificado." }
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
      { q: "¿Cómo sé que mi máquina está certificada?", a: "Por el sello con tu Nº de serie y tu certificado digital verificable." },
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
    { id: "TK-2001", tipo: "soporte", serie: "C4V-6040-PE-00123", pais: "PE", asunto: "El láser corta más débil de un lado", descripcion: "El corte no es parejo, del lado derecho queda sin cortar.", estado: "en_proceso", prioridad: "alta", asignado_a: "Josafat", cliente_id: "cli-001", fecha: "2026-06-27" },
    { id: "TK-2002", tipo: "comercial", serie: "C4V-9060-EC-00210", pais: "EC", asunto: "Cotización de tubo láser de repuesto", descripcion: "Quiero cotizar un tubo de repuesto y filtros.", estado: "nuevo", prioridad: "media", asignado_a: "Equipo Comercial C4V Ecuador", cliente_id: "cli-002", fecha: "2026-06-29" }
  ],

  academia: {
    acceso: "Acceso gratuito de por vida, incluido con tu máquina C4V. Todos los cursos, para todos los clientes.",
    plataforma: "C4V School (c4vschool.com) · guiados por CeVi el Toro 🐂 y Lumo el Búho 🦉",
    pilares: [
      { titulo: "C4V Tec — Técnico", detalle: "Operar la máquina y el software." },
      { titulo: "Quiero Emprender — Negocio", detalle: "Qué producir y cómo venderlo (el diferenciador)." },
      { titulo: "Irene Coach — Coaching", detalle: "Mentalidad y ventas con Irene Velasco." }
    ],
    ruta: ["Prepararte", "Operar", "Mantener", "Software", "Producir", "Especializarte"],
    cursos: [
      {
        id: "c0", titulo: "Bienvenida a C4V: Tus Primeros Pasos", icono: "🎉", nivel: "Empieza aquí", estado: "disponible",
        descripcion: "Todo lo que necesitas apenas compras tu máquina: tus accesos, tu código, tu certificado y cómo prepararte. (~10 min)",
        modulos: [
          { titulo: "Tu compra y tus accesos", lecciones: ["Qué incluye tu compra C4V", "Cómo entrar a tu plataforma", "Tu código de máquina (Nº de serie): guárdalo bien"], quizzes: 0 },
          { titulo: "Tu Certificado de Calidad", lecciones: ["Qué es y qué garantiza tu máquina", "Cómo ver el estado de tu certificado", "«Probada antes de ser tuya»"], quizzes: 0 },
          { titulo: "Prepara tu espacio", lecciones: ["Lista de compras antes de que llegue", "Instalación eléctrica y pozo a tierra", "Ambiente y seguridad"], quizzes: 0 },
          { titulo: "Tu primera capacitación", lecciones: ["Continúa con 'Domina tu Láser: Primeros Pasos'", "Únete a la comunidad de +60.000", "Cómo pedir soporte cuando lo necesites"], quizzes: 0 }
        ]
      },
      {
        id: "c1", titulo: "Domina tu Láser: Primeros Pasos", icono: "🚀", nivel: "Básico", estado: "disponible",
        descripcion: "Desde antes de recibir la máquina hasta tu primer corte real, sin errores graves. (~25-35 min)",
        modulos: [
          { titulo: "Prepárate antes de que llegue tu máquina", lecciones: ["220V + circuito independiente + cable a tierra", "Área limpia y ventilada", "Seguridad: extintor, gafas, ventilación", "Kit completo antes de la llegada", "Mentalidad de negocio"], quizzes: 7 },
          { titulo: "Antes de encender: revisión general", lecciones: ["Extractor y compresor conectados", "Chiller con agua destilada", "Conexiones de agua (inlet / outlet)", "Máquina lista"], quizzes: 3 },
          { titulo: "Primer encendido seguro", lecciones: ["Orden: 1) Estabilizador → 2) Chiller → 3) Máquina", "Observar el panel Ruida", "Checklist sin alarmas", "Verificar conexiones eléctricas"], quizzes: 3 },
          { titulo: "Tu primer corte real", lecciones: ["Cargar archivo en RDWorks", "Potencia y velocidad", "MDF 3mm: potencia 20-35, velocidad 15-25", "Presionar START y evaluar"], quizzes: 3 },
          { titulo: "Evaluación final del curso", lecciones: [], quizzes: 5 }
        ]
      },
      {
        id: "c2", titulo: "Seguridad, Limpieza y Mantenimiento", icono: "🧰", nivel: "Intermedio", estado: "en_proceso",
        descripcion: "Prevén fallas, extiende la vida útil y mantén el rendimiento. Requiere el Curso 1. (~30-40 min)",
        modulos: [
          { titulo: "Tu kit de mantenimiento (5 materiales)", lecciones: ["Agua destilada (Vistony)", "Aceite 3-EN-UNO para rieles", "Alcohol isopropílico", "Hisopos de alta calidad", "Paño de microfibra sin pelusa"], quizzes: 3 },
          { titulo: "Limpieza de lente y espejos", lecciones: ["Retirar la lente con cuidado", "Alcohol isopropílico + hisopo, circular y sin presión", "Misma técnica en los 3 espejos", "Mínimo cada 2 semanas con uso diario"], quizzes: 4 },
          { titulo: "Agua del chiller y enfriamiento", lecciones: ["Solo agua destilada, nunca del grifo", "Cambio cada 2-4 semanas", "Temperatura ideal 15-25 °C"], quizzes: 4 },
          { titulo: "Lubricación y cuidado de rieles", lecciones: ["Limpiar con microfibra", "Aceite 3-EN-UNO en gotas", "Mover el cabezal para distribuir", "Semanal con uso diario"], quizzes: 3 },
          { titulo: "6 errores que destruyen tu máquina", lecciones: ["Encender sin chiller → tubo quemado", "Agua del grifo → residuos minerales", "No limpiar la lente → pierde potencia", "Cortar PVC → gas tóxico", "Máquina sin supervisión", "Calendario de mantenimiento"], quizzes: 4 }
        ]
      },
      {
        id: "c3", titulo: "Domina C4VTech: Diseño y Corte (software)", icono: "💻", nivel: "Intermedio", estado: "proximamente",
        descripcion: "Curso del software propio C4VTech: diseñar y cortar. (20 videos, ~37 min — en edición)",
        modulos: [
          { titulo: "Instalación y conexión", lecciones: ["Instalar el software", "Conectar la PC a la máquina (red / USB)", "Encontrar la IP de la máquina", "Configurar el origen (Job Origin)"], quizzes: 0 },
          { titulo: "Interfaz y herramientas de diseño", lecciones: ["Interfaz de C4VTech", "Barra de herramientas", "Array y Offset", "Capas: grabado / corte / marcado"], quizzes: 0 },
          { titulo: "Texto y vectores", lecciones: ["Texto y fuentes", "Weld (soldar texto)", "Bridge (unir letras)", "Vectorización de imágenes"], quizzes: 0 },
          { titulo: "Proyectos reales", lecciones: ["Topper con puente y base", "Enviar a la máquina y cortar", "Llavero familiar (proyecto integral)"], quizzes: 0 }
        ]
      }
    ],
    proximamente: [
      "Instalación completa 9060 / 6040",
      "Parámetros correctos de corte y grabado (por material)",
      "Módulo de rotación y mesa extendida",
      "Tu primer producto en 30 minutos",
      "Tu primer mes vendiendo"
    ]
  },

  preinstalacion: {
    intro: "Prepara tu espacio ANTES de que llegue la máquina para instalar el mismo día.",
    secciones: [
      { titulo: "Lista de compras", items: ["Estabilizador de voltaje (obligatorio)", "Extractor de humos + ducto al exterior", "Agua destilada Vistony para el chiller", "Mesa/base nivelada y firme", "Extintor + kit de limpieza de óptica"] },
      { titulo: "Instalación eléctrica", items: ["220 V en circuito independiente", "Cable de tierra conectado", "No compartir toma con otros equipos", "Tablero con llave térmica"] },
      { titulo: "Pozo a tierra", items: ["Pozo a tierra OBLIGATORIO (protege electrónica y operador)", "Medir continuidad a tierra antes de conectar", "Instálalo con un técnico eléctrico certificado"] },
      { titulo: "Ambiente", items: ["Espacio ventilado con extracción al exterior", "Temperatura estable, sin calor extremo", "Espacio libre alrededor para mantenimiento"] }
    ]
  },

  preparacion: {
    intro: "Prepara tu espacio ANTES de que llegue tu máquina y podrás cortar el mismo día. Estas 5 cosas marcan la diferencia: electricidad 220V dedicada, pozo a tierra, extracción de humos, agua destilada y un espacio adecuado.",
    checklist: [
      { id: "e1", t: "220V en circuito independiente, con su propia llave" },
      { id: "e2", t: "Pozo a tierra verificado por un electricista" },
      { id: "e3", t: "Estabilizador de voltaje instalado" },
      { id: "e4", t: "Extractor conectado y con salida al exterior" },
      { id: "e5", t: "Chiller con agua destilada (15–25 °C)" },
      { id: "e6", t: "Compresor / aire listo (si tu modelo lo usa)" },
      { id: "e7", t: "Extintor a la mano" },
      { id: "e8", t: "Espacio nivelado, limpio y ventilado" },
      { id: "e9", t: "Consumibles: agua destilada, aceite 3-EN-1, alcohol isopropílico, microfibra" },
      { id: "e10", t: "Materiales de prueba: MDF/acrílico (NUNCA PVC)" }
    ],
    guias: [
      { key: "electrico", titulo: "Instalación eléctrica (220V dedicado)", pasos: ["Voltaje: 220V.", "Circuito independiente: su propia llave termomagnética, sin compartir con otros equipos.", "Estabilizador entre el tomacorriente y la máquina.", "Amperaje y calibre de cable según tu modelo — tu asesor te confirma."] },
      { key: "tierra", titulo: "Pozo a tierra (obligatorio)", pasos: ["No es opcional: te protege a ti, a la electrónica y a la calidad del corte.", "Cable de tierra real conectado a un pozo (no basta el tercer agujero del enchufe).", "Que un electricista lo verifique y mida antes de la llegada. Es la causa #1 de retrasos."] },
      { key: "extraccion", titulo: "Extracción de humos", pasos: ["El corte genera humo y gases: el extractor es obligatorio.", "Conectado y dirigido al EXTERIOR.", "Nunca operes sin extractor. Mantén el ambiente ventilado."] },
      { key: "chiller", titulo: "Agua del chiller (refrigeración)", pasos: ["SOLO agua destilada, nunca del grifo (los minerales dañan el tubo).", "Temperatura ideal: 15–25 °C.", "Nunca enciendas el láser sin el chiller: el tubo se quema.", "Cambia el agua cada 2–4 semanas."] },
      { key: "secuencia", titulo: "Secuencia de encendido", pasos: ["Siempre en orden: 1) Estabilizador → 2) Chiller → 3) Máquina.", "El chiller arranca antes que el láser, siempre.", "Si el panel muestra alarma, apaga todo y revisa conexiones."] },
      { key: "seguridad", titulo: "Seguridad", pasos: ["Extintor cercano y accesible.", "Nunca cortes PVC ni clorados: liberan gas tóxico.", "Opera con la puerta cerrada (tiene protección UV).", "No dejes la máquina operando sin supervisión."] }
    ],
    compras: [
      { item: "Agua destilada", para: "Refrigeración del tubo (chiller)", spec: "Destilada (ej. Vistony), 1–2 galones" },
      { item: "Aceite 3-EN-1", para: "Lubricación de rieles", spec: "Marca 3-EN-UNO (no WD-40 ni de motor)" },
      { item: "Alcohol isopropílico + microfibra", para: "Limpieza de lente y espejos", spec: "Isopropílico; microfibra sin pelusa" },
      { item: "Estabilizador de voltaje", para: "Proteger la electrónica", spec: "Capacidad según modelo — C4V confirma" },
      { item: "Extractor + ducto", para: "Sacar humo al exterior", spec: "Diámetro según la boca de la máquina" },
      { item: "Extintor", para: "Seguridad", spec: "Polvo químico seco o CO₂" }
    ],
    modelos: "6040 / 9060 (compactas): instalación remota con acompañamiento hasta tu primer corte. 13100–18120 (grandes): instalación presencial incluida; requieren más espacio y mayor capacidad eléctrica. Tu asesor confirma los específicos de tu modelo."
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
    { categoria: "Mantenimiento", pregunta: "¿Qué agua va en el chiller y cada cuánto se cambia?", respuesta: "Solo agua destilada (nunca del grifo: los minerales obstruyen y dañan el tubo). Cambio cada 2-4 semanas según uso." },
    { categoria: "Mantenimiento", pregunta: "¿Cuál es la temperatura ideal del chiller?", respuesta: "Entre 15 y 25 °C. Si sube de 25, apaga y deja enfriar antes de seguir cortando." },
    { categoria: "Mantenimiento", pregunta: "¿Cómo lubrico los rieles y cada cuánto?", respuesta: "Limpia con paño de microfibra, aplica unas gotas de aceite 3-EN-UNO y mueve el cabezal a mano para distribuir. Semanal si usas la máquina a diario." },
    { categoria: "Mantenimiento", pregunta: "¿Cada cuánto hago mantenimiento?", respuesta: "Diario: limpieza de superficie. Semanal: lubricar rieles. Cada 2 semanas: limpiar lente y espejos. Mensual: cambiar agua del chiller." },
    { categoria: "Materiales", pregunta: "¿Qué materiales puedo cortar y grabar?", respuesta: "Madera, MDF, acrílico, cartón, cuero, tela, papel y caucho. No cortes PVC ni metales. Ante un material nuevo con dudas, consulta a soporte." },
    { categoria: "Seguridad", pregunta: "¿Puedo cortar PVC?", respuesta: "No, nunca. Genera gas cloro tóxico que daña la máquina y es peligroso para tu salud." },
    { categoria: "Seguridad", pregunta: "¿Necesito gafas para mirar el láser?", respuesta: "No mires directamente al haz. La puerta de la máquina tiene protección UV: opera siempre con la tapa cerrada." },
    { categoria: "Seguridad", pregunta: "¿Es obligatorio el extractor de humos?", respuesta: "Sí, obligatorio. Los gases del corte son tóxicos. Nunca operes sin el extractor conectado y funcionando." },
    { categoria: "Garantía y soporte", pregunta: "¿Tengo capacitación incluida?", respuesta: "Sí, acceso gratuito de por vida a C4V School. Se activa con tu compra y recibes el link por WhatsApp. Todos los cursos, para todos los clientes." },
    { categoria: "Garantía y soporte", pregunta: "¿Qué incluye mi compra además de la máquina?", respuesta: "Capacitación de por vida, soporte técnico en español por WhatsApp, garantía RECI del tubo láser, comunidad de +60.000 emprendedores y asesora dedicada por país." }
  ],

  soporte_guia: [
    { titulo: "El láser perdió fuerza / no corta como antes", sintoma: "No atraviesa el material o el corte salió débil.", causas: "Lente sucia (los residuos absorben energía) o tubo agotado.", accion: "Limpia la lente con alcohol isopropílico y haz un corte de prueba. Si sigue débil, abre un ticket: puede ser el tubo." },
    { titulo: "Encendí la máquina sin el chiller", sintoma: "El láser operó sin enfriamiento.", causas: "El tubo se sobrecalienta y puede quemarse.", accion: "Apaga de inmediato. Si estuvo activo >10 s sin enfriamiento, NO la uses y abre ticket URGENTE." },
    { titulo: "El panel Ruida muestra una alarma", sintoma: "Alarma, pitido o código en el panel.", causas: "Conexión eléctrica, chiller o conexiones de agua.", accion: "Apaga; revisa conexiones, chiller y agua; reinicia. Si persiste, abre ticket con el código exacto." },
    { titulo: "El chiller se sobrecalienta (>25 °C)", sintoma: "La temperatura sube del rango 15-25 °C.", causas: "Nivel de agua bajo, agua del grifo o uso prolongado.", accion: "Apaga y deja enfriar; verifica nivel y que sea agua destilada; cámbiala si toca. Si persiste, abre ticket." },
    { titulo: "Se intentó cortar PVC u otro material no permitido", sintoma: "Olor fuerte, humo anormal o residuos.", causas: "El PVC genera gas cloro tóxico que daña la máquina.", accion: "Detén, ventila y limpia residuos. Usa solo materiales permitidos. Si hay fallas posteriores, abre ticket indicando el material." }
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
    { id: "explora", titulo: "Explora tu plataforma", detalle: "Date una vuelta por Academia, Soporte y el Banco de Diseños.", href: "#/academia" },
    { id: "cert", titulo: "Conoce tu Certificado de Calidad", detalle: "Mira el estado de tu máquina y qué garantiza.", href: "#/certificado" },
    { id: "curso", titulo: "Haz el curso «Bienvenida: Tus Primeros Pasos»", detalle: "10 minutos para arrancar con el pie derecho.", href: "#/academia" },
    { id: "espacio", titulo: "Prepara tu espacio", detalle: "Guía de preinstalación: eléctrico, pozo a tierra y ambiente.", href: "#/preparacion" },
    { id: "soporte", titulo: "Ten a mano tu soporte", detalle: "WhatsApp 924 662 205, los 365 días. Y descubre la Bolsa de Trabajos.", href: "#/soporte" }
  ]
};
