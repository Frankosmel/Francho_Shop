import { useState, useMemo, useEffect } from 'react'
import {
  BookOpen, Search, ShieldCheck, ShieldAlert, ShoppingCart, Store,
  Sparkles, Check, ArrowLeft, ArrowRight, ChevronRight, MessageCircle,
  HelpCircle, AlertTriangle, Clock, Star, DollarSign, WalletCards,
  Package, Award, Info, Lock, Zap, ExternalLink, RefreshCcw, FileText
} from 'lucide-react'

// ════════════════════════════════════════════════════════════════
//   DATOS DE LOS 3 MENÚS DEL CENTRO DE AYUDA (22 ARTÍCULOS)
// ════════════════════════════════════════════════════════════════

export const HELP_MENUS = [
  {
    id: 'buyer',
    title: 'Comprador del Mercado',
    count: 7,
    icon: ShoppingCart,
    badge: '7 artículos',
    description: 'Guía esencial para compradores: tipos de servicios, pagos con USDT/Saldo, recepción segura, garantías y reembolsos.'
  },
  {
    id: 'seller',
    title: 'Vendedor del Mercado',
    count: 8,
    icon: Store,
    badge: '8 artículos',
    description: 'Academia para vendedores: cómo publicar con plantillas oficiales, entrega digital, soporte a casos y cobro de ganancias.'
  },
  {
    id: 'subscriptions',
    title: 'GamsGo / Francho Shop: Suscripciones & Cuentas',
    count: 7,
    icon: Sparkles,
    badge: '7 artículos',
    description: 'Todo sobre cuentas compartidas, perfiles privados con PIN, grupos familiares, licencias de IA y recargas de juegos por ID.'
  }
]

export const HELP_ARTICLES = {
  // ─────────────────────────────────────────────────────────────
  // 1. COMPRADOR DEL MERCADO (7 ARTÍCULOS)
  // ─────────────────────────────────────────────────────────────
  'service-types-explained': {
    slug: 'service-types-explained',
    category: 'buyer',
    categoryTitle: 'Comprador del Mercado',
    title: 'Explicación de Tipos de Servicio (Lectura Obligatoria para Compradores)',
    subtitle: 'Comprende los 6 tipos de servicios del mercado, cómo se entregan, qué datos debes proporcionar y su garantía.',
    readingTime: '5 min de lectura',
    date: '2026-06-29',
    badge: 'Lectura Obligatoria',
    sections: [
      {
        title: '1. Resumen de los Seis Tipos de Servicio',
        text: 'Antes de realizar una compra en Francho Shop, es fundamental que conozcas los 6 formatos de entrega disponibles en el mercado digital:',
        table: {
          headers: ['Tipo de Servicio', 'Quién provee la cuenta', 'Qué debes proporcionar', 'Qué recibes', '¿Incluye garantía?'],
          rows: [
            ['Suscripción Digital', 'Vendedor', 'Nada (algunos requieren email)', 'Credenciales / Código / Invitación familiar', 'Sí (según duración)'],
            ['Cuentas de Juegos', 'Vendedor', 'Nada', 'Credenciales completas + correo de recuperación', 'Sí (5 a 14 días)'],
            ['Recargas Directas (Top Ups)', 'Tú', 'Player ID (UID) o datos de login', 'Recarga acreditada directo al juego', 'Acreditación garantizada'],
            ['Tarjetas de Regalo (Gift Cards)', 'Tú', 'Nada', 'Código digital de canje alfanumérico', 'Canje 100% válido'],
            ['Objetos en Juego', 'Tú', 'Datos del juego / servidor', 'Entrega directa in-game (trade / servidor)', 'Según categoría'],
            ['Monedas en Juegos', 'Tú', 'Datos del personaje / servidor', 'Transferencia segura dentro del juego', 'Según categoría']
          ]
        }
      },
      {
        title: '2. Suscripciones Digitales y Modalidades de Uso',
        text: 'En las suscripciones digitales, el vendedor entrega una cuenta ya activa o un acceso oficial. Fíjate en el título del producto para conocer el método de compartición exacto:',
        list: [
          'Full Access (Acceso Total): Uso exclusivo de la cuenta completa. Máxima estabilidad, puedes cambiar datos si la ficha lo autoriza.',
          '1 Perfil Privado (Private Profile): Uso exclusivo de 1 pantalla o perfil con tu propio PIN. El resto de la cuenta es gestionado por el vendedor. Es la opción más popular para streaming.',
          'Perfil Compartido (Shared Profile): Varias personas comparten el mismo perfil. Precio ultra económico.',
          'Cuenta Compartida (Shared Account): Muy común para herramientas de IA (ChatGPT, Claude). Las credenciales se comparten entre varios miembros autorizados.',
          'Grupo Familiar (Family Group Share): Invitación oficial para unirte a una familia de Google o Spotify en tu propio correo electrónico.',
          'Código / Enlace de Activación: Un cupón o link que activa el plan directamente en tu propia cuenta personal.'
        ]
      },
      {
        title: '3. Tabla de Garantía Mínima Obligatoria',
        text: 'Todas las suscripciones vendidas en el mercado cuentan con periodos de protección respaldados por FranchoShield:',
        list: [
          '1 Mes de servicio: al menos 10 a 30 días de garantía con reemplazo.',
          '3 Meses de servicio: al menos 30 días de garantía total.',
          '6 Meses de servicio: al menos 60 días de garantía total.',
          '12 Meses (1 Año): al menos 90 a 365 días de cobertura garantizada.'
        ]
      },
      {
        title: '4. Regla de Oro: Todo dentro de Francho Shop',
        text: 'Todas las transacciones, entregas y soporte ocurren dentro de la plataforma y el bot oficial. Las entregas o acuerdos fuera del sistema pierden la protección de FranchoShield.'
      }
    ]
  },

  'shopping-tips-safety': {
    slug: 'shopping-tips-safety',
    category: 'buyer',
    categoryTitle: 'Comprador del Mercado',
    title: 'Consejos de Compra y Seguridad (Guía del Comprador)',
    subtitle: '5 puntos obligatorios a revisar antes de pagar y cómo prevenir estafas en el mercado digital.',
    readingTime: '4 min de lectura',
    date: '2026-06-05',
    badge: 'Seguridad',
    sections: [
      {
        title: '1. Los 5 Puntos Clave Antes de Comprar',
        steps: [
          'Compara Precio vs Duración: Si un precio es absurdamente bajo respecto al mercado, revisa si es cuenta compartida o si tiene menor cobertura.',
          'Verifica la Garantía y Términos: Asegúrate de leer cuántos días de cobertura posventa ofrece el vendedor en la ficha del producto.',
          'Revisa el Método de Entrega: Confirma si es Stock Inmediato (te llega en 1 segundo), código, recarga por ID o entrega manual.',
          'Reputación del Vendedor: Revisa las estrellas (⭐ 4.9+), total de ventas completadas y su nivel (Top Seller, Tienda Oficial).',
          'Restricciones de Región y Dispositivo: Verifica si la cuenta requiere VPN, si es región Global o específica, o si solo funciona en móviles o PC.'
        ]
      },
      {
        title: '2. Prevención Activa contra Estafas',
        text: 'Para tu total seguridad, sigue estas normas estrictas de la plataforma:',
        list: [
          'Nunca aceptes entregas por WhatsApp, Telegram privado o Discord: Todos los productos deben entregarse por el chat oficial de la orden.',
          'Nunca entregues tus contraseñas personales bancarias o códigos OTP: El soporte oficial de Francho Shop JAMÁS te pedirá tu contraseña.',
          'Para recargas por Player ID: Solo necesitas entregar tu ID numérico. Nunca entregues tu contraseña para una recarga por UID.'
        ]
      }
    ]
  },

  'payment-methods-fees': {
    slug: 'payment-methods-fees',
    category: 'buyer',
    categoryTitle: 'Comprador del Mercado',
    title: 'Métodos de Pago y Tarifas (Guía del Comprador)',
    subtitle: 'Pagos transparentes en USDT Cripto vía OxaPay, Saldo de Cuenta Francho Shop y Telegram Stars.',
    readingTime: '3 min de lectura',
    date: '2026-06-25',
    badge: 'Finanzas',
    sections: [
      {
        title: '1. Métodos de Pago Disponibles en Francho Shop',
        text: 'En Francho Shop operamos con métodos modernos, directos y descentralizados adaptados a nuestro ecosistema global y para Cuba:',
        list: [
          'Saldo Francho Shop: La forma más rápida. Recargas tu saldo una vez y compras cualquier producto con 1 solo clic sin demoras.',
          'Criptomonedas vía OxaPay: Aceptamos USDT (redes TRC20, TON, BEP20, Polygon), Bitcoin (BTC), Litecoin (LTC), Solana (SOL) y Ethereum (ETH).',
          'Telegram Stars: Para compras rápidas integradas directamente dentro de la aplicación móvil de Telegram.',
          'Cupones de Descuento y Saldo de Referidos: Puedes aplicar códigos promocionales o usar tus comisiones ganadas por compartir productos.'
        ]
      },
      {
        title: '2. Moneda de Referencia y Tipo de Cambio',
        text: 'El catálogo y los precios del mercado están expresados en USDT (Tether), una stablecoin anclada 1:1 con el Dólar Estadounidense ($1 USDT = $1 USD). No hay sorpresas por fluctuación en tus compras.'
      },
      {
        title: '3. Sin Pasarelas Tradicionales Obsoletas',
        text: 'En Francho Shop no utilizamos procesadores problemáticos ni cuentas bancarias tradicionales sujetas a bloqueos internacionales (no usamos PayPal ni transferencias bancarias de terceros). Tu dinero y tus compras son directos y protegidos.'
      }
    ]
  },

  'how-to-receive-confirm-orders': {
    slug: 'how-to-receive-confirm-orders',
    category: 'buyer',
    categoryTitle: 'Comprador del Mercado',
    title: 'Cómo Recibir y Confirmar Pedidos (Guía del Comprador)',
    subtitle: 'Paso a paso para ver tus credenciales, verificar la entrega y confirmar tu orden de forma segura.',
    readingTime: '4 min de lectura',
    date: '2026-07-10',
    badge: 'Pedidos',
    sections: [
      {
        title: '1. Dónde Encontrar tus Datos de Pedido',
        text: 'Una vez completado el pago, tu pedido aparece de inmediato en la sección "Mis Pedidos" y recibes una notificación oficial a través de nuestro Bot en Telegram.',
        steps: [
          'Abre el menú principal y toca en "Mis Pedidos".',
          'Toca sobre el pedido activo para abrir la Ficha de la Orden.',
          'Si el producto tiene Stock Digital Automático, verás inmediatamente tus credenciales (usuario y contraseña o código) con botón de copiar.',
          'Si es Entrega Manual o Recarga por ID, verás el estado en tiempo real (Pendiente ➔ En proceso ➔ Entregado).'
        ]
      },
      {
        title: '2. Cómo Probar y Confirmar la Orden',
        text: 'Prueba el acceso a la cuenta o verifica tu saldo en el juego antes de confirmar. Si todo está correcto, el pedido queda finalizado y puedes dejar una calificación con estrellas (⭐) al vendedor.'
      }
    ]
  },

  'warranty-dealshield-coverage': {
    slug: 'warranty-dealshield-coverage',
    category: 'buyer',
    categoryTitle: 'Comprador del Mercado',
    title: 'Periodo de Garantía y Cobertura FranchoShield (Guía del Comprador)',
    subtitle: 'Cómo funciona la protección de compra con depósito en custodia (escrow) y garantía de reemplazo.',
    readingTime: '4 min de lectura',
    date: '2026-07-15',
    badge: 'Garantía',
    sections: [
      {
        title: '1. ¿Qué es FranchoShield?',
        text: 'FranchoShield es nuestro sistema automatizado de protección al comprador. Cuando realizas una compra, el dinero del vendedor no se libera inmediatamente: queda retenido en un fondo de custodia (escrow) durante todo el periodo de protección.',
        list: [
          'Garantía de funcionamiento: Si la cuenta deja de funcionar durante el tiempo cubierto, el vendedor tiene la obligación de reemplazarla.',
          'Auto-reemplazo disponible: Puedes solicitar un nuevo acceso directo desde el botón de soporte si la cuenta presenta fallas.',
          'Reembolso asegurado: Si el vendedor no puede proporcionar un reemplazo válido, el sistema te reembolsa el saldo a tu cuenta.'
        ]
      },
      {
        title: '2. Lo que NO Cubre la Garantía',
        text: 'La garantía queda anulada si el comprador cambia la contraseña de un perfil compartido, si usa trampas o hacks en juegos que provoquen el baneo del título, o si comparte la cuenta con terceros no autorizados.'
      }
    ]
  },

  'after-sales-dispute-resolution': {
    slug: 'after-sales-dispute-resolution',
    category: 'buyer',
    categoryTitle: 'Comprador del Mercado',
    title: 'Reglas de Posventa y Resolución de Disputas (Edición Comprador)',
    subtitle: 'Protocolo oficial para reportar un problema, chatear con el vendedor y solicitar mediación del equipo Francho Shop.',
    readingTime: '4 min de lectura',
    date: '2026-07-20',
    badge: 'Disputas',
    sections: [
      {
        title: '1. Protocolo de 3 Pasos ante Incidencias',
        steps: [
          'Paso 1 - Abre un Caso Post-Compra: En el detalle de tu pedido, toca "Reportar Problema" o "Abrir Caso". Describe claramente lo que ocurre y adjunta una captura de pantalla.',
          'Paso 2 - Respuesta del Vendedor: El vendedor recibe una alerta inmediata y dispone de un plazo máximo de 12 a 24 horas para solucionar o enviar reemplazo.',
          'Paso 3 - Escalado a Mediación de Francho Shop: Si el vendedor no responde o no ofrece una solución justa, puedes tocar "Solicitar Mediación del Administrador". Un moderador humano revisará las pruebas y emitirá un fallo inapelable.'
        ]
      }
    ]
  },

  'refund-policy-buyer': {
    slug: 'refund-policy-buyer',
    category: 'buyer',
    categoryTitle: 'Comprador del Mercado',
    title: 'Política de Reembolso del Mercado (Guía del Comprador)',
    subtitle: 'Términos claros de cuándo aplica reembolso, plazos de acreditación y excepciones según el tipo de producto.',
    readingTime: '3 min de lectura',
    date: '2026-07-22',
    badge: 'Reembolsos',
    sections: [
      {
        title: '1. Casos con Reembolso 100% Garantizado',
        list: [
          'Códigos o Gift Cards que resulten inválidos o ya utilizados antes del momento de la compra.',
          'Cuentas o suscripciones caídas dentro del periodo de garantía donde el vendedor no disponga de stock de reemplazo.',
          'Pedidos de entrega manual que superen el tiempo máximo prometido sin haber sido procesados.'
        ]
      },
      {
        title: '2. Casos No Reembolsables',
        list: [
          'Recargas directas aplicadas con éxito al Player ID que el comprador escribió en el formulario.',
          'Códigos de canje digitales que ya fueron activados con éxito.',
          'Cambios de opinión del comprador tras haber recibido y visualizado las credenciales funcionales.',
          'Fallas técnicas, saturación de servidores, indisponibilidad temporal o respuestas erróneas originadas directamente por proveedores externos o plataformas de Inteligencia Artificial (Google Gemini, OpenAI ChatGPT, etc.). Una vez entregada la suscripción activa y funcional, los cortes en la infraestructura de Google u otros terceros escapan al control de la tienda y no son objeto de devolución.',
          'Problemas de conectividad local del usuario, cortes de energía, o restricciones de IP/bloqueos regionales impuestos por Google/proveedores externos que requieran configuración de VPN por parte del cliente.'
        ]
      },
      {
        title: '3. Acreditación Instantánea',
        text: 'Los reembolsos aprobados se acreditan de inmediato a tu Saldo de Cuenta Francho Shop para que puedas realizar otra compra al instante o solicitar retiro a tu billetera personal.'
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────
  // 2. VENDEDOR DEL MERCADO (8 ARTÍCULOS)
  // ─────────────────────────────────────────────────────────────
  'seller-start-guide': {
    slug: 'seller-start-guide',
    category: 'seller',
    categoryTitle: 'Vendedor del Mercado',
    title: 'Cómo Empezar a Vender y Publicar Productos (Guía del Vendedor)',
    subtitle: 'Requisitos, uso de plantillas del Catálogo Maestro y cómo estructurar tus ofertas para maximizar ventas.',
    readingTime: '5 min de lectura',
    date: '2026-08-01',
    badge: 'Inicio Vendedor',
    sections: [
      {
        title: '1. Requisitos para ser Vendedor Verificado',
        text: 'Para vender en Francho Shop debes contar con una cuenta activa, configurar el nombre e imagen de tu tienda, y comprometerte a brindar soporte posventa dentro de la plataforma.',
        steps: [
          'Ingresa a tu Perfil y abre el Panel de Vendedor.',
          'Configura los datos de tu Tienda (Nombre comercial, logo y descripción).',
          'Ve a la pestaña "Mis Productos" y toca "Crear Producto".'
        ]
      },
      {
        title: '2. El Asistente del Catálogo Maestro Oficial',
        text: 'Usa el botón "✨ Elegir del Catálogo Oficial". El asistente te permite seleccionar en 4 pasos guiados el servicio (ChatGPT, Claude, Netflix, Free Fire) y paquete exacto, autocompletando descripciones, garantías e iconos profesionales estandarizados.'
      }
    ]
  },

  'seller-delivery-rules': {
    slug: 'seller-delivery-rules',
    category: 'seller',
    categoryTitle: 'Vendedor del Mercado',
    title: 'Reglas de Entrega y Tiempos de Respuesta (Vendedor)',
    subtitle: 'Entrega automática vs entrega manual, cumplimiento de plazos prometidos y sanciones por retraso.',
    readingTime: '4 min de lectura',
    date: '2026-08-03',
    badge: 'Operaciones',
    sections: [
      {
        title: '1. Tiempos de Entrega Prometidos',
        text: 'El tiempo que configures en tu oferta (ej: "Instante ⚡", "20 minutos", "1 hora") es un compromiso contractual con el cliente:',
        list: [
          'Stock Digital Inmediato: El sistema entrega automáticamente el código o cuenta en 1 segundo al recibir el pago.',
          'Entrega Manual: Tienes la obligación de atender el pedido dentro del plazo establecido en la publicación.',
          'Si vas a ausentarte: Pausa tus productos activos o reduce el stock a 0 para no acumular órdenes demoradas.'
        ]
      }
    ]
  },

  'seller-digital-stock-management': {
    slug: 'seller-digital-stock-management',
    category: 'seller',
    categoryTitle: 'Vendedor del Mercado',
    title: 'Gestión de Stock Digital (Códigos y Cuentas Automáticas)',
    subtitle: 'Cómo subir inventario línea por línea, reposición continua y alertas de stock bajo.',
    readingTime: '4 min de lectura',
    date: '2026-08-05',
    badge: 'Inventario',
    sections: [
      {
        title: '1. Carga de Stock Línea por Línea',
        text: 'Al seleccionar entrega por Stock Digital, puedes pegar múltiples credenciales en el cuadro de texto. Cada línea representa un ítem que se entregará a un comprador distinto:',
        list: [
          'Formato para Cuentas: correo:contraseña (o correo:contraseña:perfil:pin)',
          'Formato para Códigos / Keys: CÓDIGO-ALFANUMÉRICO-ACTIVACIÓN',
          'Entrega atómica: El sistema bloquea cada línea para que ningún ítem se entregue dos veces.'
        ]
      }
    ]
  },

  'seller-cases-support': {
    slug: 'seller-cases-support',
    category: 'seller',
    categoryTitle: 'Vendedor del Mercado',
    title: 'Atención de Casos Post-Compra y Soporte al Cliente (Vendedor)',
    subtitle: 'Gestión de incidencias desde el panel de Casos, reposición rápida y cómo evitar penalizaciones.',
    readingTime: '4 min de lectura',
    date: '2026-08-08',
    badge: 'Casos y Soporte',
    sections: [
      {
        title: '1. Gestión Profesional de Casos',
        text: 'Cuando un comprador reporta un inconveniente con su cuenta, se crea automáticamente un Caso Post-Compra en tu panel:',
        steps: [
          'Revisa el mensaje y la evidencia adjunta por el cliente.',
          'Si la cuenta cayó o el código no funcionó, envía inmediatamente un reemplazo válido.',
          'Mantén una comunicación respetuosa y resuelve el caso dentro de las 24 horas para evitar mediación negativa.'
        ]
      }
    ]
  },

  'seller-ratings-levels': {
    slug: 'seller-ratings-levels',
    category: 'seller',
    categoryTitle: 'Vendedor del Mercado',
    title: 'Reputación, Calificaciones y Niveles de Vendedor (Top Seller)',
    subtitle: 'Factores que determinan tu insignia de tienda y cómo destacar en la comparativa de precios.',
    readingTime: '4 min de lectura',
    date: '2026-08-10',
    badge: 'Reputación',
    sections: [
      {
        title: '1. Niveles de Vendedor en el Marketplace',
        list: [
          'Vendedor Verificado 🛡️: Cuenta verificada con permisos para publicar productos.',
          'Vendedor Pro ⭐: Más de 10 ventas exitosas con calificación promedio superior a 4.8 estrellas.',
          'Top Seller 🏆: Más de 30 ventas, excelente velocidad de entrega y tasa mínima de disputas. Destacado con badge prioritario en el Buy Box.',
          'Tienda Oficial 👑: Tiendas certificadas oficialmente por la administración de Francho Shop.'
        ]
      }
    ]
  },

  'seller-security-rules': {
    slug: 'seller-security-rules',
    category: 'seller',
    categoryTitle: 'Vendedor del Mercado',
    title: 'Reglas de Seguridad y Prohibición de Contacto Externo (Vendedor)',
    subtitle: 'Tolerancia cero a enlaces externos, WhatsApp o cobros privados. Protección de la comunidad Francho Shop.',
    readingTime: '3 min de lectura',
    date: '2026-08-12',
    badge: 'Seguridad Vendedor',
    sections: [
      {
        title: '1. Política Estricta Anti-Contacto Externo',
        text: 'Queda terminantemente prohibido incluir en descripciones, títulos, notas o imágenes: números de teléfono, enlaces de WhatsApp, canales de Telegram, Discord o métodos de pago directos.',
        list: [
          'Toda interacción debe transcurrir por el chat oficial de la orden.',
          'La evasión de plataforma para evitar comisiones conlleva el bloqueo permanente de la tienda y la retención de saldos.',
          'Cualquier intento de fraude o estafa a un usuario será sancionado de forma irrevocable.'
        ]
      }
    ]
  },

  'seller-earnings-withdrawals': {
    slug: 'seller-earnings-withdrawals',
    category: 'seller',
    categoryTitle: 'Vendedor del Mercado',
    title: 'Tarifas, Comisiones de la Web, Horarios y Retiros en USDT',
    subtitle: 'Comisión oficial de la plataforma, fees fijos de retiro, horarios comerciales UTC-4 y plazos de liberación de saldo.',
    readingTime: '5 min de lectura',
    date: '2026-09-10',
    badge: 'Finanzas & Retiros',
    sections: [
      {
        title: '1. Comisiones del Marketplace (Ganancias de la Web)',
        text: 'Francho Shop cobra una comisión porcentual sobre el valor final de cada venta exitosa para financiar la infraestructura de servidores, bots, seguridad y mediación 24/7:',
        table: {
          headers: ['Nivel de Vendedor', 'Comisión Francho Shop', 'Fee Mínimo por Venta', 'Beneficio'],
          rows: [
            ['Vendedor Verificado', '10.0%', '$0.10 USDT', 'Acceso al catálogo maestro y pasarelas'],
            ['Vendedor Pro', '8.0%', '$0.10 USDT', 'Prioridad en el recomendador de ofertas'],
            ['Top Seller', '6.0%', '$0.10 USDT', 'Insignia destacada y menor comisión'],
            ['Tienda Oficial', '5.0%', '$0.10 USDT', 'Soporte VIP y acuerdos de exclusividad']
          ]
        },
        alert: {
          type: 'info',
          title: 'Transparencia Total',
          content: 'El saldo neto que recibes en tu billetera ya tiene descontada la comisión de la web. Nunca se cobran tarifas ocultas ni cuotas mensuales por publicar.'
        }
      },
      {
        title: '2. Tarifas y Parámetros de Retiro en USDT',
        text: 'Para garantizar la estabilidad y costear el gas de red blockchain, las solicitudes de retiro se rigen bajo los siguientes parámetros oficiales:',
        table: {
          headers: ['Parámetro', 'Valor Oficial', 'Detalles'],
          rows: [
            ['Monto Mínimo de Retiro', '$10.00 USDT', 'Evita congestión por micro-retiros'],
            ['Fee Fijo de Retiro', '$1.00 USDT', 'Cubre el gas blockchain de la red BEP20 y procesamiento'],
            ['Red Blockchain Oficial', 'USDT BEP20 (BNB Chain)', 'Transferencias seguras y verificables en blockchain'],
            ['Formato de Dirección', '0x... (42 caracteres)', 'Compatible con Binance, Trust Wallet, Metamask, OKX, Bybit']
          ]
        }
      },
      {
        title: '3. Horarios Oficiales de Liquidación y Retiros',
        text: 'El departamento financiero y el Seller Manager (Ben) operan en el horario comercial estándar de Francho Shop:',
        list: [
          'Horario Operativo de Liquidación: Lunes a Domingo de 07:00 a 17:00 (UTC-4).',
          'Tiempos de Procesamiento en Horario Hábil: Los retiros solicitados dentro del horario se liquidan en un plazo promedio de 1 a 4 horas.',
          'Solicitudes Fuera de Horario: Toda solicitud ingresada después de las 17:00 UTC-4 se procesará al día siguiente a partir de las 07:00 UTC-4.',
          'Auditoría Automática: Cada retiro es verificado para garantizar que los pedidos asociados hayan sido entregados a satisfacción.'
        ]
      },
      {
        title: '4. Periodos de Retención de Seguridad (Custodia Escrow / Hold)',
        text: 'Para proteger a los compradores y prevenir fraudes o cuentas recuperadas, los ingresos por ventas pasan por un periodo de custodia antes de liberarse a Saldo Disponible:',
        table: {
          headers: ['Tipo de Entrega / Antigüedad', 'Periodo de Retención (Hold)', 'Motivo de Seguridad'],
          rows: [
            ['Entrega Automática (Stock / Códigos)', '2 días', 'Verificación de validez y canje conforme del comprador'],
            ['Entrega Manual (Cuentas y Servicios)', '7 días', 'Cobertura ante caídas o reclamos posventa'],
            ['Vendedores Nuevos (Primeros 30 días)', '14 días', 'Periodo de prueba para consolidar historial']
          ]
        }
      },
      {
        title: '5. Cero Dependencia de PayPal o Bancos Tradicionales',
        text: 'En Francho Shop NO se realizan pagos ni retiros por PayPal ni intermediarios bancarios propensos a bloqueos arbitrarios. Todos los pagos se liquidan directamente en USDT hacia tu wallet personal sin riesgo de congelamientos.'
      }
    ]
  },

  'seller-disputes-evidence': {
    slug: 'seller-disputes-evidence',
    category: 'seller',
    categoryTitle: 'Vendedor del Mercado',
    title: 'Resolución de Disputas y Evidencia de Entrega (Vendedor)',
    subtitle: 'Qué documentación presentar ante un reclamo falso o disputa para proteger tus fondos.',
    readingTime: '4 min de lectura',
    date: '2026-08-18',
    badge: 'Disputas Vendedor',
    sections: [
      {
        title: '1. Protección al Vendedor con Evidencia Válida',
        text: 'Si un comprador abre una reclamación injustificada o fraudulenta, el equipo de mediación revisará tus comprobantes:',
        list: [
          'Para Recargas por ID: Captura oficial del portal de recargas con el UID del cliente, número de pedido y sello de tiempo.',
          'Para Cuentas: Comprobante de vigencia de la suscripción y registro de que las credenciales entregadas eran correctas.',
          'Para Códigos: Verificación de que el código no había sido utilizado antes del momento de la compra.'
        ]
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────
  // 3. SUSCRIPCIONES & CUENTAS (7 ARTÍCULOS)
  // ─────────────────────────────────────────────────────────────
  'shared-vs-private-accounts': {
    slug: 'shared-vs-private-accounts',
    category: 'subscriptions',
    categoryTitle: 'GamsGo / Francho Shop: Suscripciones & Cuentas',
    title: 'Cuentas Compartidas vs Cuentas Privadas: Diferencias y Recomendaciones',
    subtitle: 'Aviso de seguridad oficial, diferencias de precio y cuál elegir según tu uso personal o familiar.',
    readingTime: '4 min de lectura',
    date: '2026-06-20',
    badge: 'Cuentas & Streaming',
    sections: [
      {
        title: '1. Aviso de Seguridad de Cuentas Compartidas',
        alert: {
          type: 'warning',
          title: 'Aviso Oficial de Seguridad:',
          content: 'Las cuentas compartidas son utilizadas por varias personas, lo que puede ocasionar restricciones de uso. Recientemente, las políticas de estos servicios han sido ajustadas y los controles de riesgo son más estrictos. Se recomienda leer cuidadosamente la descripción del producto y la garantía posventa antes de comprar, y priorizar planes de menor duración con mayor cobertura.'
        }
      },
      {
        title: '2. Comparativa Directa',
        table: {
          headers: ['Característica', 'Cuenta Compartida / Slot', 'Cuenta Privada 100%'],
          rows: [
            ['Precio', 'Ultra bajo (desde $2.50 - $4.99 USDT)', 'Precio estándar de suscripción'],
            ['Uso simultáneo', 'Solo 1 dispositivo según tu perfil', 'Todos los dispositivos de la cuenta'],
            ['Historial y Favoritos', 'Compartido o por perfil asignado', '100% tuyo y privado'],
            ['Modificación de datos', 'Prohibido cambiar contraseña o correo', 'Permitido configurar a tu nombre'],
            ['Recomendación', 'Ahorro máximo para uso personal', 'Máxima estabilidad y uso intensivo']
          ]
        }
      }
    ]
  },

  'streaming-private-profiles': {
    slug: 'streaming-private-profiles',
    category: 'subscriptions',
    categoryTitle: 'GamsGo / Francho Shop: Suscripciones & Cuentas',
    title: 'Perfiles Privados con PIN en Netflix, Disney+ y Plataformas SVOD',
    subtitle: 'Cómo configurar y proteger tu perfil asignado, control de idioma, historial y dispositivos compatibles.',
    readingTime: '3 min de lectura',
    date: '2026-06-22',
    badge: 'Streaming',
    sections: [
      {
        title: '1. Reglas de Uso en Streaming con PIN',
        list: [
          'Accede a la cuenta con el correo y contraseña provistos en tu pedido.',
          'Selecciona únicamente el número o nombre de perfil asignado a ti.',
          'Puedes colocarle un PIN de 4 dígitos a tu perfil para que otros usuarios no entren a tu historial.',
          'Nunca cambies la contraseña ni el correo principal de la cuenta, de lo contrario perderás la garantía.'
        ]
      }
    ]
  },

  'family-groups-youtube-spotify': {
    slug: 'family-groups-youtube-spotify',
    category: 'subscriptions',
    categoryTitle: 'GamsGo / Francho Shop: Suscripciones & Cuentas',
    title: 'Grupos Familiares en YouTube Premium y Spotify (Invitaciones por Email)',
    subtitle: 'Cómo unirte a un grupo familiar oficial en tu propia cuenta sin compartir tu contraseña.',
    readingTime: '4 min de lectura',
    date: '2026-06-25',
    badge: 'Música & Video',
    sections: [
      {
        title: '1. Activación sin Compartir Contraseña',
        text: 'Para YouTube Premium y Spotify Familiar no necesitas dar tu contraseña personal a nadie:',
        steps: [
          'Al hacer el pedido, indica la dirección de correo electrónico que usas en tu cuenta.',
          'El vendedor te enviará un enlace de invitación oficial de Google Families o Spotify.',
          'Abre el enlace y haz clic en "Unirme a la familia". Tu cuenta se convertirá en Premium de inmediato.',
          'Importante para Google: Google solo permite cambiar de grupo familiar 1 vez cada 12 meses.'
        ]
      }
    ]
  },

  'ai-subscriptions-chatgpt-claude': {
    slug: 'ai-subscriptions-chatgpt-claude',
    category: 'subscriptions',
    categoryTitle: 'GamsGo / Francho Shop: Suscripciones & Cuentas',
    title: 'Suscripciones de Inteligencia Artificial: ChatGPT Plus/Pro, Claude y Gemini',
    subtitle: 'Límites de mensajes, acceso a modelos avanzados (GPT-4o, o1, Claude 3.5 Sonnet) y buenas prácticas.',
    readingTime: '5 min de lectura',
    date: '2026-06-28',
    badge: 'Inteligencia Artificial',
    sections: [
      {
        title: '1. Acceso a Modelos de Vanguardia',
        text: 'Nuestras suscripciones de IA te permiten utilizar los modelos más potentes del mundo a una fracción del costo:',
        list: [
          'ChatGPT Plus / Pro: Acceso a GPT-4o, Canvas, generación de imágenes DALL-E, análisis de datos y OpenAI o1.',
          'Claude Pro: Acceso completo a Claude 3.5 Sonnet, generación de código y vista previa en vivo de Artifacts.',
          'Google One AI Premium: Gemini 1.5 Pro integrado con 2TB de almacenamiento en Google Drive, Gmail y Fotos.'
        ]
      },
      {
        title: '2. Buenas Prácticas de Conexión',
        text: 'Para mantener la estabilidad de la cuenta, evita realizar cientos de consultas por minuto con scripts automatizados y utiliza navegadores actualizados sin extensiones invasivas.'
      }
    ]
  },

  'game-topups-uid-guide': {
    slug: 'game-topups-uid-guide',
    category: 'subscriptions',
    categoryTitle: 'GamsGo / Francho Shop: Suscripciones & Cuentas',
    title: 'Recargas de Juegos por Player ID: Free Fire, Roblox, PUBG y Más',
    subtitle: 'Cómo encontrar tu ID de jugador, servidor correcto y tiempos de acreditación automática.',
    readingTime: '3 min de lectura',
    date: '2026-07-02',
    badge: 'Recargas Juegos',
    sections: [
      {
        title: '1. Cómo Obtener tu Player ID',
        list: [
          'Free Fire: Toca en tu perfil arriba a la izquierda. Tu UID numérico aparece debajo de tu apodo (ej: 123456789).',
          'Roblox: Tu nombre de usuario exacto registrado en Roblox.',
          'PUBG Mobile: Toca tu avatar; el Character ID numérico se encuentra en la esquina superior.',
          'Mobile Legends: Requiere tu User ID y tu Zone ID (que aparece entre paréntesis).'
        ]
      },
      {
        title: '2. Rapidez y Seguridad Total',
        text: 'Las recargas por ID son 100% oficiales y no requieren acceso a tu cuenta. El saldo llega a tu inventario en pocos minutos.'
      }
    ]
  },

  'digital-licenses-software': {
    slug: 'digital-licenses-software',
    category: 'subscriptions',
    categoryTitle: 'GamsGo / Francho Shop: Suscripciones & Cuentas',
    title: 'Licencias Digitales y Activación de Software (Windows, Office, Canva Pro)',
    subtitle: 'Instrucciones de activación de claves alfanuméricas oficiales y canje de licencias de por vida.',
    readingTime: '4 min de lectura',
    date: '2026-07-05',
    badge: 'Software & Licencias',
    sections: [
      {
        title: '1. Activación de Windows 10 y Windows 11',
        text: 'Las claves OEM digitales se activan directamente en los servidores de Microsoft:',
        steps: [
          'Ve a Inicio ➔ Configuración ➔ Sistema ➔ Activación.',
          'Toca "Cambiar clave de producto".',
          'Pega la clave de 25 caracteres recibida en tu pedido y pulsa "Activar".'
        ]
      },
      {
        title: '2. Canva Pro e Invitaciones de Equipo',
        text: 'Para Canva Pro, el vendedor te envía un enlace oficial de invitación de equipo a tu correo. Al entrar con tu cuenta habitual, se desbloquean todas las plantillas y Magic Studio por 1 año garantizado.'
      }
    ]
  },

  'account-warranty-replacement-faq': {
    slug: 'account-warranty-replacement-faq',
    category: 'subscriptions',
    categoryTitle: 'GamsGo / Francho Shop: Suscripciones & Cuentas',
    title: 'Garantía Posventa y Reemplazo Rápido de Cuentas',
    subtitle: 'Qué hacer si una cuenta presenta problemas durante el periodo de garantía y cómo recibir reemplazo.',
    readingTime: '3 min de lectura',
    date: '2026-07-08',
    badge: 'Posventa',
    sections: [
      {
        title: '1. Flujo Rápido de Solución de Incidencias',
        steps: [
          'Verifica primero si ingresaste el correo y contraseña correctamente respetando mayúsculas.',
          'Si la suscripción fue cancelada o no te permite entrar, ve a tu Pedido y toca "Reportar Problema".',
          'El vendedor te asignará una cuenta nueva de reemplazo de inmediato.',
          'Si el vendedor se demora más de 24 horas, el sistema te devuelve el saldo automáticamente.'
        ]
      }
    ]
  }
}

// ════════════════════════════════════════════════════════════════
//   COMPONENTE PRINCIPAL: CENTRO DE AYUDA (HELP CENTER SCREEN)
// ════════════════════════════════════════════════════════════════

export function HelpCenterScreen({ onNav, initialSlug = null, initialMenu = null }) {
  const [selectedMenu, setSelectedMenu] = useState(initialMenu)
  const [activeSlug, setActiveSlug] = useState(initialSlug)
  const [search, setSearch] = useState('')

  // Sincronizar si cambia initialSlug
  useEffect(() => {
    if (initialSlug) {
      setActiveSlug(initialSlug)
      if (HELP_ARTICLES[initialSlug]) {
        setSelectedMenu(HELP_ARTICLES[initialSlug].category)
      }
    }
  }, [initialSlug])

  useEffect(() => {
    if (initialMenu) {
      setSelectedMenu(initialMenu)
    }
  }, [initialMenu])

  // Lista de todos los artículos para búsqueda global
  const allArticles = useMemo(() => Object.values(HELP_ARTICLES), [])

  // Artículos filtrados por búsqueda global
  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    return allArticles.filter(art =>
      art.title.toLowerCase().includes(q) ||
      art.subtitle.toLowerCase().includes(q) ||
      art.categoryTitle.toLowerCase().includes(q) ||
      (art.badge && art.badge.toLowerCase().includes(q))
    )
  }, [allArticles, search])

  // Artículo activo actualmente si se está leyendo (NIVEL 3)
  const currentArticle = activeSlug ? HELP_ARTICLES[activeSlug] : null

  // Objeto del menú seleccionado actualmente (NIVEL 2)
  const activeMenuObj = useMemo(() => {
    const menuId = currentArticle?.category || selectedMenu
    return HELP_MENUS.find(m => m.id === menuId) || null
  }, [currentArticle, selectedMenu])

  // Artículos del menú seleccionado
  const menuArticles = useMemo(() => {
    if (!selectedMenu) return []
    return allArticles.filter(art => art.category === selectedMenu)
  }, [allArticles, selectedMenu])

  // ─────────────────────────────────────────────────────────────
  // NIVEL 3: VISTA DE LECTURA DE ARTÍCULO ESPECÍFICO
  // ─────────────────────────────────────────────────────────────
  if (currentArticle) {
    const related = allArticles
      .filter(a => a.category === currentArticle.category && a.slug !== currentArticle.slug)
      .slice(0, 3)

    return (
      <div className="px-2.5 py-4 md:p-6 max-w-4xl mx-auto text-left space-y-6">
        {/* Navegación hacia atrás y Migas de Pan */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveSlug(null)}
            className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition flex items-center gap-1.5 active:scale-95 shadow"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver a {currentArticle.categoryTitle}</span>
          </button>

          <div className="flex items-center gap-1.5 text-xs text-white/50">
            <button
              type="button"
              onClick={() => { setActiveSlug(null); setSelectedMenu(null); setSearch(''); }}
              className="hover:text-accent transition"
            >
              Centro de Ayuda
            </button>
            <span>/</span>
            <button
              type="button"
              onClick={() => setActiveSlug(null)}
              className="hover:text-accent transition font-bold text-white/70"
            >
              {currentArticle.categoryTitle}
            </button>
          </div>
        </div>

        {/* Encabezado del Artículo */}
        <header className="card p-5 sm:p-7 rounded-3xl bg-card border border-white/10 shadow-xl space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-1 rounded-full bg-accent/20 text-accent font-black text-[10px] uppercase tracking-wider">
              {currentArticle.badge}
            </span>
            <span className="text-white/40 text-xs flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {currentArticle.readingTime}
            </span>
            <span className="text-white/40 text-xs">· Actualizado: {currentArticle.date}</span>
          </div>

          <h1 className="text-xl sm:text-3xl font-black text-white leading-tight">
            {currentArticle.title}
          </h1>

          <p className="text-xs sm:text-sm text-white/70 leading-relaxed">
            {currentArticle.subtitle}
          </p>

          <div className="pt-2 flex items-center justify-between border-t border-white/5 text-xs text-white/40">
            <span>Autor: Equipo de Francho Shop</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <ShieldCheck className="h-4 w-4" /> Verificado Oficial
            </span>
          </div>
        </header>

        {/* Cuerpo del Artículo */}
        <article className="space-y-4">
          {currentArticle.sections.map((sec, idx) => (
            <div key={idx} className="card p-5 sm:p-6 rounded-2xl bg-card/80 border border-white/10 space-y-3">
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                {sec.title}
              </h2>

              {sec.alert && (
                <div className={`p-4 rounded-xl border flex items-start gap-3 text-xs leading-relaxed ${
                  sec.alert.type === 'warning'
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                    : 'border-accent/30 bg-accent/10 text-white'
                }`}>
                  <ShieldAlert className="h-5 w-5 flex-shrink-0 text-amber-400 mt-0.5" />
                  <div className="space-y-1">
                    <strong className="block font-black text-amber-300">{sec.alert.title}</strong>
                    <p>{sec.alert.content}</p>
                  </div>
                </div>
              )}

              {sec.text && (
                <p className="text-xs sm:text-sm text-white/75 leading-relaxed">
                  {sec.text}
                </p>
              )}

              {sec.table && (
                <div className="overflow-x-auto rounded-xl border border-white/10 my-2">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-white/5 text-white/60 font-black uppercase text-[10px] tracking-wider border-b border-white/10">
                      <tr>
                        {sec.table.headers.map((h, hIdx) => (
                          <th key={hIdx} className="px-3.5 py-2.5 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {sec.table.rows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-white/5 transition-colors">
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className="px-3.5 py-2 text-white/80 whitespace-nowrap sm:whitespace-normal">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {sec.list && (
                <ul className="space-y-2 pt-1">
                  {sec.list.map((item, lIdx) => (
                    <li key={lIdx} className="text-xs sm:text-sm text-white/75 flex items-start gap-2 leading-relaxed">
                      <span className="h-1.5 w-1.5 rounded-full bg-accent mt-2 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}

              {sec.steps && (
                <div className="space-y-2.5 pt-1">
                  {sec.steps.map((st, sIdx) => (
                    <div key={sIdx} className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5 text-xs text-white/80 leading-relaxed">
                      <span className="h-5 w-5 rounded-full bg-accent/20 text-accent font-black text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                        {sIdx + 1}
                      </span>
                      <span>{st}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </article>

        {/* Footer simple para volver */}
        <div className="pt-4 border-t border-white/10 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setActiveSlug(null)}
            className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition flex items-center gap-2 active:scale-95 shadow"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver a {currentArticle.categoryTitle}</span>
          </button>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────
  // VISTA DE BÚSQUEDA GLOBAL (Si el usuario escribe en el buscador)
  // ─────────────────────────────────────────────────────────────
  if (search.trim()) {
    return (
      <div className="px-2.5 py-4 md:p-6 max-w-5xl mx-auto text-left space-y-6">
        {/* Banner de Búsqueda */}
        <div className="card p-6 rounded-3xl bg-card border border-white/10 shadow-xl space-y-3">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setSearch('')}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white/80 text-xs font-bold transition flex items-center gap-1.5"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Limpiar búsqueda y volver</span>
            </button>
            <span className="text-xs text-white/40">
              {searchResults.length} {searchResults.length === 1 ? 'coincidencia' : 'coincidencias'}
            </span>
          </div>

          <div className="relative pt-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-accent" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar en la ayuda (ej: reembolsos, garantía, USDT, entrega)..."
              className="w-full bg-black/40 border border-accent/40 rounded-full pl-11 pr-10 py-3 text-xs sm:text-sm text-white placeholder:text-white/40 outline-none focus:border-accent transition shadow-inner"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/50 hover:text-white transition"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Resultados */}
        <div className="space-y-3">
          <h2 className="text-xs font-black text-white/60 uppercase tracking-wider px-1">
            Resultados encontrados para "{search}"
          </h2>

          {searchResults.length === 0 ? (
            <div className="card p-12 text-center text-white/40 rounded-3xl border border-white/10 space-y-2">
              <p className="text-sm font-bold text-white/70">No encontramos resultados para tu búsqueda</p>
              <p className="text-xs">Prueba con palabras clave como <strong>garantía</strong>, <strong>reembolso</strong>, <strong>USDT</strong>, <strong>stock</strong> o <strong>disputa</strong>.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {searchResults.map((art) => (
                <button
                  key={art.slug}
                  type="button"
                  onClick={() => {
                    setSelectedMenu(art.category)
                    setActiveSlug(art.slug)
                  }}
                  className="group p-4 sm:p-5 rounded-2xl bg-card hover:bg-white/5 border border-white/10 hover:border-accent/40 text-left transition-all active:scale-[0.99] flex flex-col justify-between shadow-sm"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/15 text-accent font-black uppercase tracking-wider">
                        {art.categoryTitle} · {art.badge}
                      </span>
                      <span className="text-[10px] text-white/40 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {art.readingTime}
                      </span>
                    </div>

                    <h3 className="font-extrabold text-sm sm:text-base text-white group-hover:text-accent transition-colors leading-snug">
                      {art.title}
                    </h3>

                    <p className="text-xs text-white/55 line-clamp-2 leading-relaxed">
                      {art.subtitle}
                    </p>
                  </div>

                  <div className="pt-3 mt-3 border-t border-white/5 flex items-center justify-between text-xs text-accent font-bold">
                    <span>Leer guía completa</span>
                    <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────
  // NIVEL 2: VISTA DE LA SECCIÓN SELECCIONADA (DENTRO DEL MENÚ)
  // Al tocar una de las 3 secciones se abre este menú con sus temas
  // ─────────────────────────────────────────────────────────────
  if (selectedMenu && activeMenuObj) {
    const Icon = activeMenuObj.icon

    return (
      <div className="px-2.5 py-4 md:p-6 max-w-5xl mx-auto text-left space-y-6">
        {/* Navegación hacia atrás y Migas de Pan */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => setSelectedMenu(null)}
            className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white/90 text-xs font-bold transition flex items-center gap-1.5 active:scale-95 shadow"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver a Secciones de Ayuda</span>
          </button>

          <div className="flex items-center gap-1.5 text-xs text-white/50">
            <button
              type="button"
              onClick={() => setSelectedMenu(null)}
              className="hover:text-accent transition"
            >
              Centro de Ayuda
            </button>
            <span>/</span>
            <span className="text-white font-bold">{activeMenuObj.title}</span>
          </div>
        </div>

        {/* Tarjeta Cabecera de la Sección Seleccionada */}
        <div className="card p-6 sm:p-7 rounded-3xl bg-card border border-white/10 shadow-xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-accent text-black flex items-center justify-center font-black flex-shrink-0 shadow-lg shadow-accent/20">
                <Icon className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-accent/20 text-accent uppercase tracking-wider">
                    {activeMenuObj.badge}
                  </span>
                  <span className="text-xs text-white/40 font-bold">Oficial Francho Shop</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-white">
                  {activeMenuObj.title}
                </h1>
                <p className="text-xs sm:text-sm text-white/60 max-w-2xl leading-relaxed">
                  {activeMenuObj.description}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Listado de Artículos dentro de este Menú */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-black text-white/70 uppercase tracking-wider flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-accent" />
              <span>Temas y Guías en esta sección ({menuArticles.length})</span>
            </h2>
            <span className="text-xs text-white/40">Toca una opción para abrir su guía</span>
          </div>

          <div className="space-y-2.5">
            {menuArticles.map((art, idx) => (
              <button
                key={art.slug}
                type="button"
                onClick={() => setActiveSlug(art.slug)}
                className="group w-full p-4 sm:p-5 rounded-2xl bg-card hover:bg-white/5 border border-white/10 hover:border-accent/40 text-left transition-all active:scale-[0.99] flex items-center justify-between gap-4 shadow-sm"
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 text-accent font-black text-xs flex items-center justify-center flex-shrink-0 group-hover:bg-accent group-hover:text-black transition-colors mt-0.5">
                    {String(idx + 1).padStart(2, '0')}
                  </div>

                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/15 text-accent font-black uppercase tracking-wider">
                        {art.badge}
                      </span>
                      <span className="text-[10px] text-white/40 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {art.readingTime}
                      </span>
                    </div>

                    <h3 className="font-extrabold text-sm sm:text-base text-white group-hover:text-accent transition-colors leading-snug">
                      {art.title}
                    </h3>

                    <p className="text-xs text-white/50 line-clamp-2 leading-relaxed">
                      {art.subtitle}
                    </p>
                  </div>
                </div>

                <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40 group-hover:text-accent group-hover:border-accent/40 transition-colors flex-shrink-0">
                  <ChevronRight className="h-5 w-5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Volver al pie de sección */}
        <div className="pt-2 flex items-center justify-start">
          <button
            type="button"
            onClick={() => setSelectedMenu(null)}
            className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition flex items-center gap-2 active:scale-95 shadow"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver a Secciones</span>
          </button>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────
  // NIVEL 1: PANTALLA PRINCIPAL (SOLO LAS 3 SECCIONES)
  // Solo se muestran las 3 secciones grandes, nada más.
  // Al tocar en una, se abre su dicho menú (Nivel 2).
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="px-2.5 py-4 md:p-6 max-w-5xl mx-auto text-left space-y-6">
      {/* Banner Principal */}
      <div className="card p-6 sm:p-8 rounded-3xl bg-card border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="relative z-10 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/15 border border-accent/30 text-accent text-xs font-extrabold">
            <BookOpen className="h-4 w-4" />
            <span>Centro de Ayuda Oficial</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
            ¿Cómo podemos ayudarte hoy?
          </h1>

          <p className="text-xs sm:text-sm text-white/60 max-w-2xl leading-relaxed">
            Selecciona una de las 3 secciones principales para acceder a las guías oficiales, normativas de comercio seguro y garantías de Francho Shop.
          </p>

          {/* Buscador global */}
          <div className="relative pt-2 max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar en la ayuda (ej: reembolsos, garantía, USDT, entrega)..."
              className="w-full bg-black/40 border border-white/15 rounded-full pl-11 pr-4 py-3 text-xs sm:text-sm text-white placeholder:text-white/40 outline-none focus:border-accent transition shadow-inner"
            />
          </div>
        </div>
      </div>

      {/* SOLO LAS TRES SECCIONES PRINCIPALES */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-black text-white/60 uppercase tracking-wider">
            Secciones de Ayuda Oficiales (3 Menús)
          </h2>
          <span className="text-xs text-white/40">Toca una sección para ingresar</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {HELP_MENUS.map(menu => {
            const Icon = menu.icon

            return (
              <button
                key={menu.id}
                type="button"
                onClick={() => setSelectedMenu(menu.id)}
                className="group card p-5 sm:p-6 rounded-3xl bg-card hover:bg-white/5 border border-white/10 hover:border-accent/50 text-left transition-all active:scale-[0.98] flex flex-col justify-between h-56 sm:h-60 shadow-xl relative overflow-hidden"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-12 h-12 rounded-2xl bg-accent/15 border border-accent/30 text-accent flex items-center justify-center font-black group-hover:scale-110 group-hover:bg-accent group-hover:text-black transition-all">
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-accent/15 text-accent border border-accent/25">
                      {menu.badge}
                    </span>
                  </div>

                  <h3 className="font-black text-base sm:text-lg text-white group-hover:text-accent transition-colors">
                    {menu.title}
                  </h3>

                  <p className="text-xs text-white/55 line-clamp-3 mt-1.5 leading-relaxed">
                    {menu.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs text-accent font-extrabold">
                  <span>Abrir menú ({menu.count} guías)</span>
                  <div className="w-7 h-7 rounded-lg bg-accent/15 flex items-center justify-center group-hover:bg-accent group-hover:text-black transition-colors">
                    <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

    </div>
  )
}
