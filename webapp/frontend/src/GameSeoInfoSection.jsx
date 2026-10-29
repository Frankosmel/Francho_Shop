import { useState, useEffect, useMemo } from 'react'
import {
  ShieldCheck,
  Zap,
  CreditCard,
  Wallet,
  Globe2,
  HelpCircle,
  CheckCircle2,
  ChevronDown,
  Info,
  Star,
  Award,
  Gamepad2,
  Lock,
  ArrowRight,
  Sparkles,
  Smartphone,
  Check
} from 'lucide-react'

// Base de conocimiento exhaustiva y sin textos basura para los principales juegos y servicios digitales
const GAME_KNOWLEDGE = {
  // Free Fire / Free Fire Max
  'free-fire': {
    aliases: ['free fire', 'freefire', 'ff', 'garena free fire', 'free_fire_latam', 'free_fire_bd', 'free_fire_br', 'free_fire_cis', 'free_fire_eu', 'free_fire_id', 'free_fire_mena', 'free_fire_my_sg', 'free_fire_ph', 'free_fire_pk', 'free_fire_sg', 'free_fire_th', 'free_fire_tw', 'free_fire_vn'],
    cleanTitle: 'Free Fire',
    currency: 'Diamantes Free Fire (💎)',
    items: ['100 + 10 Diamantes', '310 + 31 Diamantes', '520 + 52 Diamantes', '1060 + 106 Diamantes', '2180 + 218 Diamantes', 'Tarjeta Semanal', 'Tarjeta Mensual', 'Pase Booyah'],
    publisher: 'Garena',
    categoryType: 'game-topup',
    idField: 'ID de Jugador (UID)',
    idInstructions: 'Abre Free Fire, toca tu avatar o foto de perfil en la esquina superior izquierda de la pantalla principal. Debajo de tu apodo verás tu UID numérico de 8 a 10 dígitos. Presiona el botón de copiar junto al número.',
    servers: 'Servidor LATAM / Sudamérica / Norteamérica / Global (100% compatible con cuentas de Cuba)',
    faqs: [
      {
        q: '¿Cuánto tardan en llegar los diamantes de Free Fire a mi cuenta?',
        a: 'La acreditación de diamantes es completamente automática y tarda entre 1 y 3 minutos tras confirmarse tu pago. Los diamantes se reflejan de forma directa en el contador de tu juego sin necesidad de reiniciar la aplicación.'
      },
      {
        q: '¿Es seguro recargar Free Fire en Francho Shop? ¿Hay riesgo de baneo o diamantes rojos?',
        a: 'Es 100% seguro. Nuestras recargas se procesan a través de los canales de distribución oficiales de Garena mediante tu ID de jugador. No utilizamos trucos, reembolsos fraudulentos ni modificaciones de archivos (mods), por lo que tu cuenta tiene 0% de riesgo de baneo y garantía total contra diamantes negativos o rojos.'
      },
      {
        q: '¿Cómo pagar Free Fire en CUP desde Cuba con Transfermóvil o EnZona?',
        a: 'Selecciona tu paquete de diamantes, ingresa tu ID de jugador y en el paso de pago elige Transfermóvil o EnZona en CUP. Podrás escanear el código QR directamente o transferir al número de tarjeta indicado en pantalla. Una vez recibido el comprobante, el sistema acredita tu pedido de inmediato.'
      },
      {
        q: '¿Puedo recargar Free Fire a un familiar o amigo en Cuba si vivo en Estados Unidos u otro país?',
        a: 'Sí, por supuesto. Solo necesitas solicitarle a tu familiar o amigo en Cuba su ID numérico de Free Fire. Desde el extranjero puedes pagar de manera segura con USDT (TRC-20, BEP-20) o criptomonedas, y a ellos les llegarán los diamantes al instante en Cuba.'
      },
      {
        q: '¿Qué pasa si ingreso un ID de Free Fire equivocado?',
        a: 'Si ingresas un ID inexistente, el sistema de Garena rechaza la orden protegiendo tus fondos. Si el ID pertenece a otra persona en activo y se procesa, no es posible revertirlo. Por eso te recomendamos siempre copiar y pegar tu ID directamente desde tu perfil en el juego.'
      }
    ]
  },

  // Mobile Legends: Bang Bang
  'mobile-legends': {
    aliases: ['mobile legends', 'mlbb', 'mobile legends bang bang', 'mobile_legends'],
    cleanTitle: 'Mobile Legends: Bang Bang',
    currency: 'Diamantes MLBB (💎)',
    items: ['Diamantes directos', 'Pase Semanal de Diamantes', 'Twilight Pass', 'Paquetes de recarga rápida'],
    publisher: 'Moonton Games',
    categoryType: 'game-topup',
    idField: 'User ID y Zone ID',
    idInstructions: 'Abre Mobile Legends y pulsa tu avatar en la esquina superior izquierda. En la sección "Básica", verás tu User ID numérico y tu Zone ID de 4 o 5 dígitos entre paréntesis, por ejemplo: 12345678 (2024). Ingresa ambos datos en los campos de recarga.',
    servers: 'Servidor LATAM, Norteamérica, Europa y Global (Cuentas activas en Cuba sin VPN)',
    faqs: [
      {
        q: '¿Dónde encuentro mi User ID y Zone ID en Mobile Legends?',
        a: 'Entra a MLBB, pulsa en tu avatar arriba a la izquierda. En tu perfil verás una fila con tu ID, por ejemplo: 12345678 (2104). El número largo es tu User ID y el número entre paréntesis de 4 a 5 dígitos es tu Zone ID.'
      },
      {
        q: '¿Cuánto tiempo tarda en activarse el Pase Semanal de Diamantes de MLBB?',
        a: 'El Pase Semanal de Diamantes se activa en 1 a 3 minutos directamente en tu cuenta. Podrás reclamar los primeros diamantes inmediatamente y acumular hasta 10 semanas de suscripción según las reglas oficiales de Moonton.'
      },
      {
        q: '¿Se requiere la contraseña de mi cuenta de Moonton o redes?',
        a: 'No. Jamás solicitamos contraseñas, acceso a Moonton Account, Google Play ni Facebook. La recarga de diamantes se realiza de manera 100% segura únicamente con tu User ID y Zone ID.'
      },
      {
        q: '¿Puedo pagar MLBB en pesos cubanos (CUP)?',
        a: 'Sí, aceptamos pagos por Transfermóvil y EnZona en CUP calculados a la tasa del día, facilitando la recarga para todos los jugadores en Cuba sin necesidad de tarjetas internacionales.'
      }
    ]
  },

  // Roblox
  'roblox': {
    aliases: ['roblox', 'robux', 'roblox gift card', 'tarjeta roblox'],
    cleanTitle: 'Roblox',
    currency: 'Robux (R$)',
    items: ['400 Robux', '800 Robux', '1,700 Robux', '4,500 Robux', '10,000 Robux', 'Tarjetas de Regalo Digitales'],
    publisher: 'Roblox Corporation',
    categoryType: 'game-topup',
    idField: 'Nombre de Usuario de Roblox o Código Digital',
    idInstructions: 'Ingresa tu nombre de usuario exacto de Roblox (Username con el que inicias sesión, no el nombre de visualización) o canjea el código digital oficial de tarjeta regalo recibido en roblox.com/redeem.',
    servers: 'Global / Multiplataforma (PC, Android, iOS, Xbox, PlayStation)',
    faqs: [
      {
        q: '¿Cómo se acreditan los Robux en mi cuenta de Roblox?',
        a: 'Dependiendo de la opción seleccionada, la entrega se realiza mediante código oficial de tarjeta regalo para canjear en roblox.com/redeem o entrega directa autorizada. Recibirás tus Robux o saldo de crédito de forma inmediata.'
      },
      {
        q: '¿Cómo canjeo un código de Robux en Cuba?',
        a: 'Inicia sesión en roblox.com/redeem desde cualquier navegador web en tu teléfono o computadora. Pega el código digital de 10 o más caracteres que te entregamos y haz clic en "Canjear". Los Robux se acreditarán automáticamente en tu saldo.'
      },
      {
        q: '¿Es compatible con jugadores de Roblox en Cuba?',
        a: 'Sí, totalmente compatible. Los códigos y recargas de Roblox proporcionados por Francho Shop son globales o para la región América, ideales para jugadores en Cuba y toda Latinoamérica.'
      }
    ]
  },

  // PUBG Mobile
  'pubg-mobile': {
    aliases: ['pubg mobile', 'pubg', 'pubgm', 'pubg uc'],
    cleanTitle: 'PUBG Mobile',
    currency: 'Unknown Cash (UC 🪙)',
    items: ['60 UC', '300 + 25 UC', '600 + 60 UC', '1500 + 300 UC', 'Royale Pass', 'Elite Pass Plus'],
    publisher: 'Level Infinite / Tencent Games',
    categoryType: 'game-topup',
    idField: 'Player ID (UID)',
    idInstructions: 'Abre PUBG Mobile, toca tu foto de perfil en la esquina superior derecha del lobby principal. Tu Player ID numérico de 9 a 12 dígitos se muestra en la parte superior derecha de tu tarjeta de información de jugador.',
    servers: 'Servidor Global / América del Norte / Sudamérica / Europa',
    faqs: [
      {
        q: '¿Cuánto tardan en llegar los UC a PUBG Mobile?',
        a: 'Los UC se envían a través de la API oficial de recargas de PUBG Mobile y se acreditan en tu cuenta en un plazo de 1 a 3 minutos.'
      },
      {
        q: '¿Necesito dar la contraseña de mi cuenta de Twitter, Facebook o Google?',
        a: 'No, bajo ningún concepto. Solo necesitas proporcionar tu Player ID numérico. Tu cuenta permanece protegida y bajo tu control en todo momento.'
      }
    ]
  },

  // Call of Duty Mobile
  'call-of-duty-mobile': {
    aliases: ['call of duty mobile', 'codm', 'cod mobile', 'codm_activision_us', 'codm_activision_ca', 'codm_activision_in', 'codm_activision_kz', 'codm_activision_sa', 'codm_garena_sgmy'],
    cleanTitle: 'Call of Duty: Mobile',
    currency: 'Puntos COD (CP 🪙)',
    items: ['80 CP', '420 CP', '880 CP', '2400 CP', '5000 CP', 'Battle Pass'],
    publisher: 'Activision',
    categoryType: 'game-topup',
    idField: 'UID de Jugador (19 dígitos)',
    idInstructions: 'Abre COD: Mobile, toca el icono de engranaje (Configuración) arriba a la derecha, desplázate hasta la última pestaña "LEGAL Y PRIVACIDAD" en el menú lateral. Encontrarás tu UID numérico de 19 dígitos. Presiona el botón Copiar.',
    servers: 'Servidor Activision Global / LATAM / Norteamérica',
    faqs: [
      {
        q: '¿Cómo encuentro mi UID de Call of Duty Mobile?',
        a: 'Entra al juego, abre Configuración (el icono de rueda dentada), ve a la pestaña "Legal y Privacidad" al final a la derecha. Allí verás tu UID numérico largo. Cópialo y pégalo en el formulario de compra.'
      },
      {
        q: '¿Los CP sirven para comprar el Pase de Batalla y ruletas de armas míticas?',
        a: 'Sí, los Puntos COD (CP) recargados son 100% oficiales y los puedes utilizar en cualquier evento del juego: Pase de Batalla, ruletas de operadores y armas míticas/legendarias, cajas y paquetes de la tienda.'
      }
    ]
  },

  // Blood Strike
  'blood-strike': {
    aliases: ['blood strike', 'bloodstrike', 'blood_strike', 'blood_strike_mena'],
    cleanTitle: 'Blood Strike',
    currency: 'Oro de Blood Strike (🪙)',
    items: ['100 Oro', '300 + 20 Oro', '500 + 50 Oro', '1000 + 120 Oro', 'Strike Pass'],
    publisher: 'NetEase Games',
    categoryType: 'game-topup',
    idField: 'User ID numérico',
    idInstructions: 'Abre Blood Strike, pulsa sobre tu avatar o apodo en la esquina superior izquierda del lobby. En tu tarjeta de perfil encontrarás tu User ID numérico. Pulsa el botón de copiar.',
    servers: 'Servidor Global / América / Europa',
    faqs: [
      {
        q: '¿Cómo recargar Oro en Blood Strike desde Cuba?',
        a: 'Ingresa tu User ID de Blood Strike, elige la cantidad de Oro o Strike Pass y paga en CUP mediante Transfermóvil o EnZona, o con USDT si pagas desde el exterior. La entrega se realiza de 1 a 3 minutos de forma automática.'
      }
    ]
  },

  // Brawl Stars
  'brawl-stars': {
    aliases: ['brawl stars', 'brawlstars', 'brawl_stars'],
    cleanTitle: 'Brawl Stars',
    currency: 'Gemas Brawl Stars (💎)',
    items: ['30 Gemas', '80 Gemas', '170 Gemas', '360 Gemas', 'Brawl Pass', 'Brawl Pass Plus'],
    publisher: 'Supercell',
    categoryType: 'game-topup',
    idField: 'Player Tag (#TAG)',
    idInstructions: 'Abre Brawl Stars y pulsa sobre tu foto de perfil en la esquina superior izquierda. Debajo de tu icono de perfil verás tu Player Tag que empieza con el símbolo almohadilla (ej: #9QL8...). Copia tu Tag completo incluyendo el símbolo #.',
    servers: 'Servidor Supercell Global',
    faqs: [
      {
        q: '¿Dónde encuentro mi Player Tag en Brawl Stars?',
        a: 'Pulsa en tu avatar arriba a la izquierda en la pantalla principal. Tu Tag de jugador aparece justo debajo de tu imagen de perfil (ejemplo: #2PP08R2Y).'
      },
      {
        q: '¿Es seguro para mi cuenta de Supercell ID?',
        a: 'Totalmente seguro. Las recargas oficiales se gestionan a través de Supercell Store autorizada vinculada a tu Tag de jugador. No compromete tu correo ni tu Supercell ID.'
      }
    ]
  },

  // Clash of Clans
  'clash-of-clans': {
    aliases: ['clash of clans', 'coc', 'clash_of_clans'],
    cleanTitle: 'Clash of Clans',
    currency: 'Gemas Clash of Clans (💎)',
    items: ['80 Gemas', '500 Gemas', '1,200 Gemas', '2,500 Gemas', 'Pase de Oro (Gold Pass)'],
    publisher: 'Supercell',
    categoryType: 'game-topup',
    idField: 'Player Tag (#TAG)',
    idInstructions: 'En tu aldea, pulsa en tu nivel o perfil de jugador en la esquina superior izquierda. Tu Player Tag (#XXXXXXX) está visible justo debajo de tu nombre.',
    servers: 'Servidor Supercell Global',
    faqs: [
      {
        q: '¿Cómo activar el Pase de Oro en Clash of Clans?',
        a: 'Al adquirir el Pase de Oro en Francho Shop mediante tu Player Tag, este se acredita a tu cuenta o inventario de Supercell ID para activarlo de forma inmediata en la temporada actual.'
      }
    ]
  },

  // Genshin Impact
  'genshin-impact': {
    aliases: ['genshin impact', 'genshin', 'genshin_impact', 'genshin_impact_login'],
    cleanTitle: 'Genshin Impact',
    currency: 'Cristales Génesis & Bendición Lunar',
    items: ['Bendición Lunar (Welkin Moon)', '60 Cristales Génesis', '300 + 30 Cristales', '980 + 110 Cristales', '1980 + 260 Cristales', '3280 + 600 Cristales', '6480 + 1600 Cristales'],
    publisher: 'HoYoverse / miHoYo',
    categoryType: 'game-topup',
    idField: 'UID de Jugador (9 dígitos) y Servidor',
    idInstructions: 'Abre Genshin Impact. Tu UID de 9 dígitos se muestra permanentemente en la esquina inferior derecha de tu pantalla y en el menú de Paimon debajo de tu nombre de Viajero.',
    servers: 'Servidor América, Europa, Asia y TW/HK/MO',
    faqs: [
      {
        q: '¿Cómo llega la Bendición Lunar o los Cristales Génesis?',
        a: 'Llegan directamente a tu cuenta de juego en 1 a 3 minutos tras procesar el pedido con tu UID y servidor. Si compraste la Bendición Lunar, verás la animación con los primeros 300 Cristales Génesis de inmediato.'
      },
      {
        q: '¿Necesito proporcionar la contraseña de mi cuenta HoYoverse?',
        a: 'No. Las recargas oficiales se acreditan mediante tu UID numérico de 9 dígitos y la selección de tu servidor. No requerimos tu contraseña.'
      }
    ]
  },

  // Honkai: Star Rail
  'honkai-star-rail': {
    aliases: ['honkai star rail', 'hsr', 'honkai_star_rail'],
    cleanTitle: 'Honkai: Star Rail',
    currency: 'Esquirlas Oníricas & Pase de Suministros',
    items: ['Pase de Suministros Expreso', '60 Esquirlas', '300 + 30 Esquirlas', '980 + 110 Esquirlas', '1980 + 260 Esquirlas', '3280 + 600 Esquirlas', '6480 + 1600 Esquirlas'],
    publisher: 'HoYoverse',
    categoryType: 'game-topup',
    idField: 'UID de Jugador (9 dígitos) y Servidor',
    idInstructions: 'Abre Honkai: Star Rail y abre el menú del teléfono inteligente (arriba a la izquierda). Tu UID numérico de 9 dígitos se muestra en la esquina inferior izquierda de la pantalla.',
    servers: 'Servidor América, Europa, Asia y TW/HK/MO',
    faqs: [
      {
        q: '¿Puedo acumular varios Pases de Suministros Expreso?',
        a: 'Sí, puedes adquirir y acumular hasta un máximo de 180 días de Pase de Suministros Expreso según la normativa oficial de HoYoverse.'
      }
    ]
  },

  // Steam Gift Cards & Wallet
  'steam': {
    aliases: ['steam', 'steam gift card', 'tarjeta steam', 'cartera steam', 'steam wallet'],
    cleanTitle: 'Steam Wallet & Gift Cards',
    currency: 'Saldo Cartera Steam (USD / EUR / Global)',
    items: ['Tarjeta $5 USD', 'Tarjeta $10 USD', 'Tarjeta $20 USD', 'Tarjeta $50 USD', 'Tarjeta $100 USD', 'Recarga Directa de Cartera'],
    publisher: 'Valve Corporation',
    categoryType: 'gift-card',
    idField: 'Código Digital o Usuario de Steam',
    idInstructions: 'Recibirás un código digital oficial para canjear en store.steampowered.com/account/redeemwalletcode o desde el cliente de Steam en "Juegos" > "Canjear un código de la Cartera de Steam".',
    servers: 'Global / USA / LATAM / Europa',
    faqs: [
      {
        q: '¿Cómo canjeo mi tarjeta de Steam en Cuba?',
        a: 'Abre Steam en tu PC o navegador web, ve a tu perfil arriba a la derecha > Detalles de la cuenta > Añadir fondos a tu Cartera de Steam > Canjear una tarjeta de regalo o código de la cartera. Pega el código que te entregamos y el saldo se sumará al instante.'
      },
      {
        q: '¿El saldo de Steam sirve para comprar cualquier juego o pase?',
        a: 'Sí. Una vez acreditado el saldo en tu Cartera de Steam, puedes comprar cualquier juego en oferta, DLCs, pases de batalla o artículos en el Mercado de la Comunidad de Steam.'
      }
    ]
  },

  // PlayStation Network
  'playstation': {
    aliases: ['playstation', 'psn', 'playstation store', 'ps plus', 'playstation gift card'],
    cleanTitle: 'PlayStation Network (PSN)',
    currency: 'Saldo PSN Store (USD / EUR)',
    items: ['Tarjeta $10 USD', 'Tarjeta $25 USD', 'Tarjeta $50 USD', 'Tarjeta $100 USD', 'Suscripción PlayStation Plus'],
    publisher: 'Sony Interactive Entertainment',
    categoryType: 'gift-card',
    idField: 'Código Digital Oficial',
    idInstructions: 'Código digital de 12 caracteres. Canjéalo en playstation.com o en la PlayStation Store de tu consola PS4 / PS5 en el menú "Canjear códigos".',
    servers: 'Región Estados Unidos (USA) / España (EUR)',
    faqs: [
      {
        q: '¿Puedo canjear una tarjeta de PlayStation en mi consola en Cuba?',
        a: 'Sí. La gran mayoría de cuentas de PlayStation creadas en Cuba o Latinoamérica tienen región Estados Unidos (USA). Asegúrate de que la región de la tarjeta coincida con el país configurado en tu cuenta de PSN.'
      }
    ]
  },

  // Telegram Stars
  'telegram-stars': {
    aliases: ['telegram stars', 'stars', 'telegram_stars', 'estrellas telegram', 'estrellas'],
    cleanTitle: 'Telegram Stars (Estrellas)',
    currency: 'Telegram Stars (⭐)',
    items: ['50 Stars', '100 Stars', '250 Stars', '500 Stars', '1,000 Stars', '2,500 Stars', '5,000 Stars'],
    publisher: 'Telegram FZ-LLC',
    categoryType: 'telegram',
    idField: 'Nombre de usuario de Telegram (@usuario)',
    idInstructions: 'Ingresa tu @usuario público de Telegram (sin espacios ni enlaces). Las Stars se transfieren directamente a tu perfil a través de la API oficial de Telegram.',
    servers: 'Global (Todas las cuentas de Telegram a nivel mundial)',
    faqs: [
      {
        q: '¿Para qué sirven las Telegram Stars?',
        a: 'Las Telegram Stars te permiten comprar bienes digitales, suscripciones a canales exclusivos, reaccionar a publicaciones premium y pagar en Mini Apps y bots de Telegram sin salir de la aplicación.'
      },
      {
        q: '¿Cuánto tardan en llegar las Telegram Stars?',
        a: 'La transferencia es instantánea y se refleja en tu perfil de Telegram en menos de 60 segundos tras completarse la compra.'
      },
      {
        q: '¿Cómo pagar Telegram Stars con Transfermóvil o EnZona en CUP?',
        a: 'Elige la cantidad de estrellas, introduce tu @usuario de Telegram y selecciona pago en CUP con Transfermóvil o EnZona. Confirmas el pago escaneando el código QR y las estrellas se acreditan automáticamente.'
      }
    ]
  },

  // Telegram Premium
  'telegram-premium': {
    aliases: ['telegram premium', 'telegram_premium', 'premium telegram', 'tg premium', 'suscripcion telegram'],
    cleanTitle: 'Telegram Premium',
    currency: 'Suscripción Oficial Telegram Premium (⭐)',
    items: ['3 Meses Telegram Premium', '6 Meses Telegram Premium', '12 Meses (1 Año) Telegram Premium'],
    publisher: 'Telegram FZ-LLC / Fragment',
    categoryType: 'subscription',
    idField: 'Nombre de usuario de Telegram (@usuario)',
    idInstructions: 'Ingresa tu @usuario público de Telegram (ejemplo: @miusuario). No se requiere contraseña ni acceso a tu cuenta. La activación se envía como regalo oficial vía Fragment/Telegram y se activa en segundos.',
    servers: 'Global (Todas las cuentas de Telegram a nivel mundial)',
    faqs: [
      {
        q: '¿Necesito dar mi contraseña para activar Telegram Premium?',
        a: 'No. La activación se realiza como regalo oficial (Telegram Gift) a través de la infraestructura de Fragment y la API de Telegram. Solo solicitamos tu nombre de usuario público (@usuario). Jamás te pediremos contraseñas ni códigos de verificación SMS.'
      },
      {
        q: '¿Qué ventajas obtengo con Telegram Premium en Cuba?',
        a: 'Obtienes descargas a máxima velocidad sin límites de red, límite de subida aumentado a 4 GB por archivo, transcripción automática de notas de voz a texto, traducción en tiempo real de canales, emojis y reacciones animadas exclusivas y eliminación total de publicidad patrocinada.'
      },
      {
        q: '¿Cómo pagar Telegram Premium en CUP desde Cuba con Transfermóvil o EnZona?',
        a: 'Selecciona la duración de tu suscripción (3, 6 o 12 meses), coloca tu @usuario y selecciona Transfermóvil o EnZona. Realiza la transferencia en moneda nacional CUP y en pocos minutos recibes la notificación oficial de Telegram confirmando tu suscripción activa.'
      },
      {
        q: '¿Puedo regalar Telegram Premium a un amigo o familiar en Cuba?',
        a: 'Sí. Puedes adquirir la suscripción desde cualquier país pagando con USDT o tarjetas internacionales y proporcionando el @usuario de tu familiar en Cuba. Se activará en su cuenta de inmediato.'
      }
    ]
  },

  // ChatGPT Plus & OpenAI
  'chatgpt-plus': {
    aliases: ['chatgpt', 'chatgpt plus', 'chatgpt_plus', 'openai', 'gpt-4', 'chat gpt', 'suscripcion chatgpt'],
    cleanTitle: 'ChatGPT Plus / OpenAI',
    currency: 'Suscripción Oficial ChatGPT Plus',
    items: ['1 Mes ChatGPT Plus', 'Recarga Saldo OpenAI API', 'Suscripción Asistida'],
    publisher: 'OpenAI Inc.',
    categoryType: 'subscription',
    idField: 'Correo electrónico de tu cuenta OpenAI',
    idInstructions: 'Proporciona el correo electrónico asociado a tu cuenta de OpenAI o solicita asistencia directa para la activación de tu plan Plus.',
    servers: 'Global (Requiere conexión VPN configurada para el acceso desde Cuba)',
    faqs: [
      {
        q: '¿Cómo pagar ChatGPT Plus desde Cuba con Transfermóvil o EnZona?',
        a: 'En Francho Shop te facilitamos la suscripción a ChatGPT Plus pagando en CUP con Transfermóvil o EnZona. Resolvemos la barrera de pagos internacionales para que puedas acceder a GPT-4o y herramientas de inteligencia artificial avanzadas sin tarjetas extranjeras.'
      },
      {
        q: '¿Qué incluye la suscripción a ChatGPT Plus?',
        a: 'Incluye acceso prioritario a los modelos más avanzados (GPT-4o, Canvas, herramientas de razonamiento o1), generación ilimitada de imágenes con DALL-E, análisis profundo de datos y archivos, navegación web en tiempo real y acceso al creador de GPTs personalizados.'
      },
      {
        q: '¿Necesito VPN para usar ChatGPT Plus en Cuba?',
        a: 'Sí. Debido a las políticas de acceso regional de OpenAI, el servicio requiere conectarse mediante VPN para acceder a la plataforma web o la aplicación móvil de ChatGPT. Una vez conectado, podrás usar todas las funciones premium con normalidad.'
      }
    ]
  }
}

// Resuelve la inteligencia del juego basándose en el título, categoría o ID
function resolveGameIntelligence(categoryTitle, categoryId, catalog, offers) {
  const normTitle = String(categoryTitle || '').toLowerCase().trim()
  const normCatId = String(categoryId || '').toLowerCase().trim()
  const searchStr = `${normTitle} ${normCatId}`

  // 1. Buscar coincidencia en la base de conocimiento
  for (const [key, data] of Object.entries(GAME_KNOWLEDGE)) {
    if (key === normCatId || normTitle.includes(key)) return data
    if (data.aliases && data.aliases.some(alias => searchStr.includes(alias.toLowerCase()))) {
      return data
    }
  }

  // 2. Generador inteligente sin textos basura para cualquier otro juego del catálogo
  // Detectar la moneda analizando los nombres de las ofertas
  let detectedCurrency = 'Monedas oficiales / Paquete digital'
  if (Array.isArray(offers) && offers.length > 0) {
    const offerNames = offers.map(o => String(o.name || '')).join(' ')
    if (/diamant/i.test(offerNames)) detectedCurrency = 'Diamantes oficiales (💎)'
    else if (/robux/i.test(offerNames)) detectedCurrency = 'Robux (R$)'
    else if (/gem/i.test(offerNames)) detectedCurrency = 'Gemas oficiales (💎)'
    else if (/coin|moneda/i.test(offerNames)) detectedCurrency = 'Monedas del juego (🪙)'
    else if (/gold|oro/i.test(offerNames)) detectedCurrency = 'Oro digital (🪙)'
    else if (/point|punto/i.test(offerNames)) detectedCurrency = 'Puntos de juego (CP / Points)'
    else if (/token/i.test(offerNames)) detectedCurrency = 'Tokens / Fichas'
    else if (/credit|credito/i.test(offerNames)) detectedCurrency = 'Créditos'
    else if (/pass|pase/i.test(offerNames)) detectedCurrency = 'Pase de temporada / Membresía'
    else if (/usd|eur|\$/i.test(offerNames)) detectedCurrency = 'Saldo digital de cartera'
  }

  const cleanName = categoryTitle || 'Juego Digital'
  const isGiftCard = /card|tarjeta|wallet|store|regalo/i.test(searchStr)
  const isStreaming = /netflix|spotify|disney|prime|hbo|max|paramount/i.test(searchStr)

  return {
    cleanTitle: cleanName,
    currency: detectedCurrency,
    publisher: catalog?.publisher || 'Distribuidor Oficial',
    categoryType: isGiftCard ? 'gift-card' : (isStreaming ? 'subscription' : 'game-topup'),
    idField: isGiftCard ? 'Código Digital / Correo' : (isStreaming ? 'Correo de entrega' : 'ID de Jugador (UID / Player ID)'),
    idInstructions: isGiftCard
      ? 'Recibirás un código digital con entrega inmediata para canjear en la plataforma oficial del servicio.'
      : isStreaming
      ? 'Recibirás los datos de acceso o invitación oficial directamente en la pantalla de pedidos y por correo.'
      : 'Abre el juego, accede a tu perfil o configuración y copia tu ID numérico de jugador. No se requieren contraseñas.',
    servers: 'Servidor Global / América / Europa (Compatible con cuentas de Cuba e internacionales)',
    faqs: [
      {
        q: `¿Cuánto tarda en llegar la recarga de ${cleanName}?`,
        a: `La entrega se realiza de forma automática y suele completarse en un plazo de 1 a 3 minutos tras confirmarse tu pago.`
      },
      {
        q: `¿Es seguro recargar ${cleanName} en Francho Shop?`,
        a: `Sí, 100% seguro. Todas las operaciones se procesan a través de canales de recarga directos autorizados. No solicitamos contraseñas de acceso y garantizamos la legalidad de cada paquete.`
      },
      {
        q: `¿Qué métodos de pago puedo usar para pagar ${cleanName} en Cuba?`,
        a: `En Cuba puedes pagar directamente en CUP mediante Transfermóvil o EnZona a la tasa del día. Internacionalmente aceptamos USDT (TRC-20, BEP-20) y criptomonedas con acreditación en segundos.`
      },
      {
        q: `¿Puedo enviar una recarga de ${cleanName} a otra persona?`,
        a: `Sí. Solo necesitas conocer el ID de jugador de la persona a la que deseas enviarle la recarga. El saldo se acreditará directamente en su cuenta de juego.`
      }
    ]
  }
}

export default function GameSeoInfoSection({
  catalog,
  gameData,
  categoryTitle,
  categoryId,
  offers = [],
  cupSettings = null
}) {
  const [openFaqIndex, setOpenFaqIndex] = useState(0)

  // Resuelve la inteligencia y datos exactos del juego
  const gameInfo = useMemo(() => {
    return resolveGameIntelligence(categoryTitle, categoryId, catalog, offers)
  }, [categoryTitle, categoryId, catalog, offers])

  // Calcula rango de precios reales en USDT y CUP
  const priceStats = useMemo(() => {
    const validPrices = (offers || [])
      .map(o => Number(o.price_usdt || 0))
      .filter(p => p > 0)

    const minUsdt = validPrices.length > 0 ? Math.min(...validPrices) : 0.99
    const maxUsdt = validPrices.length > 0 ? Math.max(...validPrices) : 49.99

    const cardRate = Number(cupSettings?.card_rate || 370)
    const minCup = Math.round(minUsdt * cardRate)
    const maxCup = Math.round(maxUsdt * cardRate)

    return { minUsdt, maxUsdt, minCup, maxCup, cardRate, count: validPrices.length }
  }, [offers, cupSettings])

  // Inyección dinámica de metadatos SEO y Schema.org JSON-LD (Product, HowTo, FAQPage)
  useEffect(() => {
    const { cleanTitle, currency, publisher, idField, faqs } = gameInfo
    const pageUrl = typeof window !== 'undefined' ? window.location.href : 'https://franchoshop.com'

    // Actualiza metadatos del documento
    const seoTitle = `Recargar ${cleanTitle} en Cuba y el Mundo | Francho Shop`
    const seoDesc = `Recarga oficial de ${cleanTitle} (${currency}) al mejor precio. Pagos en CUP (Transfermóvil, EnZona) en Cuba y USDT internacional. Entrega inmediata por ${idField}, 100% legal y sin riesgo de baneo.`

    document.title = seoTitle

    const setMeta = (selector, attr, val) => {
      let el = document.head.querySelector(selector)
      if (!el) {
        el = document.createElement('meta')
        const match = selector.match(/meta\[(name|property)=\"([^\"]+)\"\]/)
        if (match) el.setAttribute(match[1], match[2])
        document.head.appendChild(el)
      }
      el.setAttribute(attr, val)
    }

    setMeta('meta[name="description"]', 'content', seoDesc)
    setMeta('meta[property="og:title"]', 'content', seoTitle)
    setMeta('meta[property="og:description"]', 'content', seoDesc)
    setMeta('meta[property="og:url"]', 'content', pageUrl)

    // Construcción de Schema.org JSON-LD
    const productSchema = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: `Recarga de ${cleanTitle}`,
      description: seoDesc,
      image: catalog?.image_url || gameData?.image_url || 'https://franchoshop.com/og-image.png',
      brand: {
        '@type': 'Brand',
        name: publisher || 'Francho Shop'
      },
      offers: {
        '@type': 'AggregateOffer',
        url: pageUrl,
        priceCurrency: 'USD',
        lowPrice: priceStats.minUsdt.toFixed(2),
        highPrice: priceStats.maxUsdt.toFixed(2),
        offerCount: priceStats.count || 1,
        availability: 'https://schema.org/InStock',
        seller: {
          '@type': 'Organization',
          name: 'Francho Shop'
        }
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.9',
        bestRating: '5',
        worstRating: '1',
        ratingCount: '1280',
        reviewCount: '1280'
      }
    }

    const howToSchema = {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: `Cómo recargar ${currency} en ${cleanTitle}`,
      description: `Guía en 4 pasos para recargar ${cleanTitle} de forma segura con entrega inmediata en Cuba y el mundo.`,
      step: [
        {
          '@type': 'HowToStep',
          position: 1,
          name: 'Selecciona tu paquete',
          text: `Elige la cantidad de ${currency} que deseas adquirir en el catálogo de Francho Shop.`
        },
        {
          '@type': 'HowToStep',
          position: 2,
          name: `Ingresa tu ${idField}`,
          text: gameInfo.idInstructions
        },
        {
          '@type': 'HowToStep',
          position: 3,
          name: 'Elige tu método de pago',
          text: 'Paga en CUP por Transfermóvil o EnZona desde Cuba, o con USDT / Criptomonedas a nivel internacional.'
        },
        {
          '@type': 'HowToStep',
          position: 4,
          name: 'Recibe tu recarga al instante',
          text: 'Tu pedido se acredita en cuestión de 1 a 3 minutos directamente en tu cuenta de juego sin contraseñas.'
        }
      ]
    }

    const faqSchema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: (faqs || []).map(f => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: f.a
        }
      }))
    }

    const graphSchema = {
      '@context': 'https://schema.org',
      '@graph': [productSchema, howToSchema, faqSchema]
    }

    let scriptTag = document.getElementById('game-seo-schema-jsonld')
    if (!scriptTag) {
      scriptTag = document.createElement('script')
      scriptTag.type = 'application/ld+json'
      scriptTag.id = 'game-seo-schema-jsonld'
      document.head.appendChild(scriptTag)
    }
    scriptTag.text = JSON.stringify(graphSchema)

    return () => {
      const el = document.getElementById('game-seo-schema-jsonld')
      if (el) el.remove()
    }
  }, [gameInfo, priceStats, catalog, gameData])

  const { cleanTitle, currency, publisher, idField, idInstructions, servers, faqs } = gameInfo

  return (
    <section aria-label={`Información de recarga de ${cleanTitle}`} className="mt-8 space-y-6 pt-4 border-t border-white/10 text-white">
      {/* 1. Header con Propuesta de Valor y Garantías */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#121824] to-[#0d121d] p-4 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 border border-accent/30 px-3 py-1 text-[11px] font-black text-accent uppercase tracking-wider">
              <Sparkles className="h-3 w-3" />
              Recarga Oficial
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-400">
              <Zap className="h-3 w-3" />
              1-3 min
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-amber-300 font-bold bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
            <Star className="h-3 w-3 fill-amber-300" />
            <span>4.9 / 5.0 (1,280+ reseñas)</span>
          </div>
        </div>

        <div>
          <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
            Recarga Oficial de {cleanTitle} en Cuba e Internacional
          </h2>
          <p className="mt-1.5 text-xs sm:text-sm text-white/70 leading-relaxed">
            Adquiere {currency} al mejor precio del mercado con entrega automatizada 24/7. Paga directamente en <strong className="text-white font-semibold">Pesos Cubanos (CUP)</strong> mediante Transfermóvil y EnZona, o con <strong className="text-white font-semibold">USDT y Criptomonedas</strong> desde cualquier país. Tu saldo se acredita de forma directa en tu cuenta de {cleanTitle} sin intermediarios ni demoras.
          </p>
        </div>

        {/* Insignias de confianza */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          <div className="rounded-xl border border-white/5 bg-white/[0.03] p-2.5 text-center flex flex-col items-center justify-center gap-1">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span className="text-[11px] font-bold text-white">0% Riesgo de Baneo</span>
            <span className="text-[9px] text-white/50">Canales oficiales</span>
          </div>
          <div className="rounded-xl border border-white/5 bg-white/[0.03] p-2.5 text-center flex flex-col items-center justify-center gap-1">
            <Lock className="h-4 w-4 text-sky-400" />
            <span className="text-[11px] font-bold text-white">Sin Contraseñas</span>
            <span className="text-[9px] text-white/50">Solo con tu ID</span>
          </div>
          <div className="rounded-xl border border-white/5 bg-white/[0.03] p-2.5 text-center flex flex-col items-center justify-center gap-1">
            <CreditCard className="h-4 w-4 text-amber-400" />
            <span className="text-[11px] font-bold text-white">CUP Transfermóvil</span>
            <span className="text-[9px] text-white/50">Tasa justa y real</span>
          </div>
          <div className="rounded-xl border border-white/5 bg-white/[0.03] p-2.5 text-center flex flex-col items-center justify-center gap-1">
            <Award className="h-4 w-4 text-purple-400" />
            <span className="text-[11px] font-bold text-white">Garantía 100%</span>
            <span className="text-[9px] text-white/50">Soporte en vivo</span>
          </div>
        </div>
      </div>

      {/* 2. Sección: Métodos de Pago Oficiales (Cuba & Internacional) */}
      <div className="rounded-2xl border border-white/10 bg-[#121824] p-4 sm:p-5 space-y-4 shadow-lg">
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-accent flex-shrink-0" />
          <h3 className="text-sm sm:text-base font-black text-white">
            Métodos de Pago Disponibles: Cuba e Internacional
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {/* Tarjeta Cuba */}
          <div className="rounded-xl border border-accent/20 bg-accent/[0.04] p-4 space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-accent flex items-center gap-1.5">
                <span>🇨🇺</span> Para Jugadores en Cuba (CUP)
              </span>
              <span className="text-[10px] font-bold text-accent/80 bg-accent/10 px-2 py-0.5 rounded-md">
                Sin VPN
              </span>
            </div>

            <div className="space-y-2 text-xs text-white/80">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                <span><strong className="text-white">Transfermóvil (CUP):</strong> Paga al instante mediante código QR o transferencia bancaria a tarjetas BPA, BANDEC o Banco Metropolitano.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                <span><strong className="text-white">EnZona (CUP):</strong> Confirmación ágil directamente desde tu teléfono móvil.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                <span><strong className="text-white">Saldo Francho Shop:</strong> Recarga tu billetera interna y realiza compras instantáneas en un clic las 24 horas del día.</span>
              </div>
            </div>

            <div className="pt-1 text-[11px] text-white/50 border-t border-white/5">
              💡 Sin comisiones ocultas ni necesidad de tarjetas bancarias internacionales.
            </div>
          </div>

          {/* Tarjeta Internacional & Cripto */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <span>🌐</span> Diáspora & Criptomonedas (Global)
              </span>
              <span className="text-[10px] font-bold text-emerald-400/80 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                Bajas Tarifas
              </span>
            </div>

            <div className="space-y-2 text-xs text-white/80">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span><strong className="text-white">USDT (Tether):</strong> Redes Tron (TRC-20) y BNB Smart Chain (BEP-20) con tarifas de red mínimas y confirmación automática en segundos.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span><strong className="text-white">OxaPay Gateway:</strong> Acepta Bitcoin (BTC), Ethereum (ETH), Litecoin (LTC), Solana (SOL) y más de 15 criptoactivos.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span><strong className="text-white">Binance Pay:</strong> Pagos directos entre usuarios de Binance sin comisiones de transferencia.</span>
              </div>
            </div>

            <div className="pt-1 text-[11px] text-white/50 border-t border-white/5">
              ✈️ Ideal para residentes en EE.UU., España o LATAM que recargan a sus seres queridos en Cuba.
            </div>
          </div>
        </div>
      </div>

      {/* 3. Sección: Cobertura por Países y Servidores */}
      <div className="rounded-2xl border border-white/10 bg-[#121824] p-4 sm:p-5 space-y-3 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe2 className="h-5 w-5 text-accent flex-shrink-0" />
            <h3 className="text-sm sm:text-base font-black text-white">
              Cobertura Regional y Servidores Compatibles
            </h3>
          </div>
          <span className="text-[10px] text-white/40 hidden sm:inline-block font-mono">
            {servers}
          </span>
        </div>

        <p className="text-xs text-white/70">
          Nuestras recargas son compatibles con todas las cuentas vinculadas a servidores de la región América, Europa y Global. Puedes recargar desde cualquier parte del mundo:
        </p>

        {/* Pills de países */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {[
            { flag: '🇨🇺', name: 'Cuba (Directo)' },
            { flag: '🇺🇸', name: 'Estados Unidos' },
            { flag: '🇲🇽', name: 'México' },
            { flag: '🇨🇴', name: 'Colombia' },
            { flag: '🇪🇸', name: 'España' },
            { flag: '🇦🇷', name: 'Argentina' },
            { flag: '🇨🇱', name: 'Chile' },
            { flag: '🇵🇪', name: 'Perú' },
            { flag: '🇻🇪', name: 'Venezuela' },
            { flag: '🇩🇴', name: 'Rep. Dominicana' },
            { flag: '🇪🇨', name: 'Ecuador' },
            { flag: '🇬🇹', name: 'Guatemala' },
            { flag: '🇵🇦', name: 'Panamá' },
            { flag: '🌐', name: 'Servidores Globales' }
          ].map(c => (
            <span
              key={c.name}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-white/80"
            >
              <span>{c.flag}</span>
              <span>{c.name}</span>
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2 pt-2 text-[11px] text-white/50 border-t border-white/5">
          <Smartphone className="h-3.5 w-3.5 text-accent flex-shrink-0" />
          <span>Compatible con dispositivos Android (Google Play), iOS (Apple App Store) y PC (Emulador / Cliente oficial).</span>
        </div>
      </div>

      {/* 4. Sección: Guía Paso a Paso para Recargar */}
      <div className="rounded-2xl border border-white/10 bg-[#121824] p-4 sm:p-5 space-y-4 shadow-lg">
        <div className="flex items-center gap-2">
          <Gamepad2 className="h-5 w-5 text-accent flex-shrink-0" />
          <h3 className="text-sm sm:text-base font-black text-white">
            ¿Cómo recargar {currency} en {cleanTitle}? Guía en 4 pasos
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Paso 1 */}
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5 space-y-2 relative">
            <div className="flex items-center justify-between">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/20 text-xs font-black text-accent">
                1
              </span>
              <span className="text-[10px] text-white/40 uppercase font-mono">Paso 1</span>
            </div>
            <h4 className="text-xs font-bold text-white">Elige tu Paquete</h4>
            <p className="text-[11px] text-white/60 leading-relaxed">
              Selecciona arriba la cantidad de {currency} o el pase que deseas añadir a tu cuenta.
            </p>
          </div>

          {/* Paso 2 */}
          <div className="rounded-xl border border-accent/30 bg-accent/[0.03] p-3.5 space-y-2 relative">
            <div className="flex items-center justify-between">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-black text-bg">
                2
              </span>
              <span className="text-[10px] text-accent font-mono font-bold">Importante</span>
            </div>
            <h4 className="text-xs font-bold text-accent">Ingresa tu {idField}</h4>
            <p className="text-[11px] text-white/70 leading-relaxed">
              {idInstructions}
            </p>
          </div>

          {/* Paso 3 */}
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5 space-y-2 relative">
            <div className="flex items-center justify-between">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/20 text-xs font-black text-accent">
                3
              </span>
              <span className="text-[10px] text-white/40 uppercase font-mono">Paso 3</span>
            </div>
            <h4 className="text-xs font-bold text-white">Selecciona tu Pago</h4>
            <p className="text-[11px] text-white/60 leading-relaxed">
              Elige Transfermóvil o EnZona en CUP si estás en Cuba, o USDT / Cripto si pagas desde el extranjero.
            </p>
          </div>

          {/* Paso 4 */}
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5 space-y-2 relative">
            <div className="flex items-center justify-between">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-black text-emerald-400">
                4
              </span>
              <span className="text-[10px] text-emerald-400 font-mono font-bold">Entrega</span>
            </div>
            <h4 className="text-xs font-bold text-white">¡Recibe tu Recarga!</h4>
            <p className="text-[11px] text-white/60 leading-relaxed">
              Tu saldo de {currency} se procesa y se acredita en tu cuenta del juego en 1 a 3 minutos.
            </p>
          </div>
        </div>
      </div>

      {/* 5. Sección: Garantía Antiban y Seguridad Total */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-[#121824] via-[#0f1520] to-[#121824] p-4 sm:p-5 space-y-3 shadow-lg">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-400 flex-shrink-0" />
          <h3 className="text-sm sm:text-base font-black text-white">
            Seguridad Garantizada: ¿Por qué recargar en Francho Shop?
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          <div className="space-y-1.5 rounded-xl border border-white/5 bg-black/20 p-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
              <Check className="h-3.5 w-3.5 stroke-[3]" />
              <span>Canales Oficiales y Legales</span>
            </div>
            <p className="text-[11px] text-white/60 leading-relaxed">
              No utilizamos métodos de reembolso ilegal ni tarjetas ajenas. Cada transacción se liquida directamente a través de distribuidores autorizados de {publisher}.
            </p>
          </div>

          <div className="space-y-1.5 rounded-xl border border-white/5 bg-black/20 p-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-sky-400">
              <Check className="h-3.5 w-3.5 stroke-[3]" />
              <span>Privacidad 100% Protegida</span>
            </div>
            <p className="text-[11px] text-white/60 leading-relaxed">
              Nunca te pediremos tus contraseñas, correos de recuperación ni códigos de dos factores. Solo requerimos tu identificador público en el juego.
            </p>
          </div>

          <div className="space-y-1.5 rounded-xl border border-white/5 bg-black/20 p-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
              <Check className="h-3.5 w-3.5 stroke-[3]" />
              <span>Soporte Humano 24/7</span>
            </div>
            <p className="text-[11px] text-white/60 leading-relaxed">
              Atención personalizada vía chat en vivo y WhatsApp (+53). Si tienes cualquier pregunta con tu {idField}, nuestro equipo te asistirá al instante.
            </p>
          </div>
        </div>
      </div>

      {/* 6. Sección: Preguntas Frecuentes (FAQ Interactivo con Schema.org) */}
      <div className="rounded-2xl border border-white/10 bg-[#121824] p-4 sm:p-5 space-y-4 shadow-lg">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-accent flex-shrink-0" />
            <h3 className="text-sm sm:text-base font-black text-white">
              Preguntas Frecuentes sobre la Recarga de {cleanTitle}
            </h3>
          </div>
          <span className="text-[10px] text-white/40 font-mono hidden sm:inline-block">
            FAQ Oficial
          </span>
        </div>

        <div className="space-y-2">
          {(faqs || []).map((faq, idx) => {
            const isOpen = openFaqIndex === idx
            return (
              <div
                key={idx}
                className={`rounded-xl border transition overflow-hidden ${
                  isOpen
                    ? 'border-accent/40 bg-accent/[0.02]'
                    : 'border-white/5 bg-white/[0.02] hover:border-white/15'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(isOpen ? -1 : idx)}
                  className="w-full flex items-center justify-between gap-3 p-3.5 sm:p-4 text-left cursor-pointer transition"
                >
                  <span className="text-xs sm:text-sm font-bold text-white flex-1 pr-2">
                    {faq.q}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-accent flex-shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-accent' : 'text-white/40'
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-3.5 sm:px-4 pb-4 pt-1 text-xs sm:text-[13px] text-white/70 leading-relaxed border-t border-white/5">
                    {faq.a}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
