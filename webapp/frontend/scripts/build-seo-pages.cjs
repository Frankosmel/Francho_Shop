const fs = require('fs')
const path = require('path')

const { GUIDE_ARTICLES, GUIDE_CATEGORIES } = require('../src/guidesData.js')

const PUBLIC_DIR = path.resolve(__dirname, '../public')
const GUIAS_DIR = path.join(PUBLIC_DIR, 'guias')

if (!fs.existsSync(GUIAS_DIR)) {
  fs.mkdirSync(GUIAS_DIR, { recursive: true })
}

function escapeHtml(str) {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// 1. Generar /guias/index.html (Página principal de guías)
const indexHtml = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Guías de Recargas, Topup y Juegos Online en Cuba 2026 | Francho Shop</title>
  <meta name="description" content="Aprende cómo recargar Free Fire, Mobile Legends, Roblox, PUBG, Steam y comprar números virtuales en Cuba con Transfermóvil, EnZona y USDT 24/7.">
  <meta name="keywords" content="recargas cuba, topup cuba, diamantes free fire cuba, transfermovil recargas, recargas roblox cuba, mlbb cuba">
  <link rel="canonical" href="https://franchoshop.com/guias">
  <meta property="og:title" content="Guías de Recargas, Topup y Juegos Online en Cuba 2026 | Francho Shop">
  <meta property="og:description" content="Aprende cómo recargar Free Fire, Mobile Legends, Roblox, PUBG, Steam y comprar números virtuales en Cuba con Transfermóvil, EnZona y USDT 24/7.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://franchoshop.com/guias">
  <meta property="og:image" content="https://franchoshop.com/og-image.png">
  <link rel="icon" type="image/jpeg" href="/franchoshop.jpg">
  <style>
    :root { --accent: #22d3ee; --bg: #0f1419; --card: #151b22; --border: rgba(255,255,255,0.1); }
    body { margin:0; background:var(--bg); color:#fff; font-family:Inter,system-ui,-apple-system,sans-serif; line-height:1.6; }
    a { color:inherit; text-decoration:none; }
    .wrap { max-width:1040px; margin:0 auto; padding:24px 16px 80px; }
    .hero { background:linear-gradient(135deg, var(--card), rgba(34,211,238,0.1)); border:1px solid rgba(34,211,238,0.3); border-radius:24px; padding:32px; margin-bottom:32px; box-shadow:0 10px 30px rgba(0,0,0,0.5); }
    .badge { display:inline-flex; align-items:center; gap:6px; background:rgba(34,211,238,0.15); color:var(--accent); border-radius:999px; padding:6px 14px; font-size:12px; font-weight:800; border:1px solid rgba(34,211,238,0.3); margin-bottom:12px; }
    h1 { font-size:32px; font-weight:900; line-height:1.15; margin:0 0 12px; }
    h2 { font-size:20px; font-weight:800; margin:0 0 8px; color:#fff; }
    p { color:rgba(255,255,255,0.75); font-size:15px; margin:0 0 16px; }
    .btn { display:inline-flex; align-items:center; gap:8px; background:var(--accent); color:#071018; font-weight:900; padding:12px 24px; border-radius:14px; transition:transform 0.15s; font-size:14px; }
    .btn:hover { transform:scale(1.02); }
    .btn-secondary { background:rgba(255,255,255,0.1); color:#fff; border:1px solid var(--border); }
    .grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(310px, 1fr)); gap:16px; }
    .card { background:var(--card); border:1px solid var(--border); border-radius:18px; padding:20px; display:flex; flex-direction:column; justify-content:space-between; transition:border-color 0.2s, transform 0.2s; }
    .card:hover { border-color:var(--accent); transform:translateY(-2px); }
    .tag { font-size:11px; font-weight:800; color:var(--accent); background:rgba(34,211,238,0.1); padding:4px 8px; border-radius:6px; align-self:flex-start; margin-bottom:10px; }
    .meta { font-size:12px; color:rgba(255,255,255,0.4); margin-top:14px; padding-top:12px; border-top:1px solid var(--border); display:flex; justify-content:space-between; }
    footer { text-align:center; color:rgba(255,255,255,0.4); font-size:13px; margin-top:48px; border-top:1px solid var(--border); padding-top:24px; }
    @media(max-width:640px) { h1 { font-size:24px; } .hero { padding:20px; } }
  </style>
</head>
<body>
  <main class="wrap">
    <div style="margin-bottom:16px;">
      <a href="/" style="font-weight:700; color:var(--accent); font-size:14px;">← Volver a Francho Shop</a>
    </div>

    <section class="hero">
      <div class="badge">📖 Centro de Guías Oficiales & SEO</div>
      <h1>Guías de Recargas, Topup y Juegos Online en Cuba 2026</h1>
      <p>Aprende cómo recargar diamantes, monedas, comprar gift cards y números virtuales desde Cuba usando Transfermóvil, EnZona y USDT con acreditación automática 24/7.</p>
      <div style="display:flex; gap:12px; flex-wrap:wrap;">
        <a class="btn" href="/">Entrar a la Tienda</a>
        <a class="btn btn-secondary" href="https://wa.me/5356246700" target="_blank" rel="noopener">Soporte por WhatsApp</a>
      </div>
    </section>

    <div style="margin-bottom:20px;">
      <h2 style="font-size:22px;">Artículos y Guías Destacadas</h2>
      <p style="font-size:14px; margin-bottom:0;">Selecciona una guía para conocer paso a paso cómo comprar, precios, tiempos de entrega y métodos de pago.</p>
    </div>

    <section class="grid">
      ${GUIDE_ARTICLES.map(art => `
        <a class="card" href="/guias/${art.slug}">
          <div>
            <span class="tag">${escapeHtml(art.badge || 'Guía Verificada')}</span>
            <h2>${escapeHtml(art.cardTitle)}</h2>
            <p style="font-size:13px; line-height:1.5;">${escapeHtml(art.description)}</p>
          </div>
          <div class="meta">
            <span>${escapeHtml(art.updatedDate)}</span>
            <span style="color:var(--accent); font-weight:700;">Leer guía →</span>
          </div>
        </a>
      `).join('')}
    </section>

    <footer>
      <p>Francho Shop · Recargas de Videojuegos · Gift Cards · Números Virtuales · Hecho para Cuba y el mundo</p>
      <p>© 2026 Francho Shop. Todos los derechos reservados.</p>
    </footer>
  </main>
</body>
</html>`

fs.writeFileSync(path.join(GUIAS_DIR, 'index.html'), indexHtml, 'utf8')
console.log('✅ Creado /guias/index.html')

// 2. Generar cada una de las 9 guías individuales pre-renderizadas
for (const art of GUIDE_ARTICLES) {
  const artDir = path.join(GUIAS_DIR, art.slug)
  if (!fs.existsSync(artDir)) {
    fs.mkdirSync(artDir, { recursive: true })
  }

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": (art.faq || []).map(([q, a]) => ({
      "@type": "Question",
      "name": q,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": a
      }
    }))
  }

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": art.h1,
    "description": art.description,
    "author": {
      "@type": "Organization",
      "name": "Francho Shop",
      "url": "https://franchoshop.com"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Francho Shop",
      "logo": {
        "@type": "ImageObject",
        "url": "https://franchoshop.com/franchoshop.jpg"
      }
    },
    "datePublished": "2026-10-08",
    "dateModified": "2026-10-08",
    "mainEntityOfPage": `https://franchoshop.com/guias/${art.slug}`
  }

  const artHtml = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(art.title)}</title>
  <meta name="description" content="${escapeHtml(art.description)}">
  <meta name="keywords" content="${escapeHtml(art.keywords || '')}">
  <link rel="canonical" href="https://franchoshop.com/guias/${art.slug}">
  <meta property="og:title" content="${escapeHtml(art.title)}">
  <meta property="og:description" content="${escapeHtml(art.description)}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="https://franchoshop.com/guias/${art.slug}">
  <meta property="og:image" content="https://franchoshop.com/og-image.png">
  <link rel="icon" type="image/jpeg" href="/franchoshop.jpg">

  <!-- Schema.org FAQPage & Article -->
  <script type="application/ld+json">
  ${JSON.stringify(faqSchema, null, 2)}
  </script>
  <script type="application/ld+json">
  ${JSON.stringify(articleSchema, null, 2)}
  </script>

  <style>
    :root { --accent: #22d3ee; --bg: #0f1419; --card: #151b22; --border: rgba(255,255,255,0.1); }
    body { margin:0; background:var(--bg); color:#fff; font-family:Inter,system-ui,-apple-system,sans-serif; line-height:1.65; }
    a { color:inherit; text-decoration:none; }
    .wrap { max-width:860px; margin:0 auto; padding:24px 16px 80px; }
    .hero { background:linear-gradient(135deg, var(--card), rgba(34,211,238,0.12)); border:1px solid rgba(34,211,238,0.3); border-radius:24px; padding:32px; margin-bottom:24px; }
    .badge { display:inline-flex; align-items:center; gap:6px; background:rgba(34,211,238,0.15); color:var(--accent); border-radius:999px; padding:6px 14px; font-size:12px; font-weight:800; border:1px solid rgba(34,211,238,0.3); margin-bottom:12px; }
    h1 { font-size:30px; font-weight:900; line-height:1.2; margin:0 0 16px; }
    h2 { font-size:22px; font-weight:800; margin:28px 0 14px; color:#fff; border-bottom:1px solid var(--border); padding-bottom:8px; }
    h3 { font-size:17px; font-weight:700; margin:16px 0 6px; color:var(--accent); }
    p { color:rgba(255,255,255,0.8); font-size:15px; margin:0 0 16px; }
    ul, ol { color:rgba(255,255,255,0.8); padding-left:22px; margin:0 0 18px; font-size:15px; }
    li { margin-bottom:8px; }
    .btn { display:inline-flex; align-items:center; justify-content:center; gap:8px; background:var(--accent); color:#071018; font-weight:900; padding:14px 28px; border-radius:14px; transition:transform 0.15s; font-size:15px; }
    .btn:hover { transform:scale(1.02); }
    .btn-secondary { background:rgba(255,255,255,0.08); color:#fff; border:1px solid var(--border); }
    .stats { display:grid; grid-template-columns:repeat(auto-fit, minmax(170px, 1fr)); gap:12px; margin:20px 0; }
    .stat-card { background:var(--card); border:1px solid var(--border); border-radius:14px; padding:14px; text-align:center; }
    .stat-label { font-size:11px; font-weight:800; color:rgba(255,255,255,0.4); text-transform:uppercase; margin-bottom:4px; }
    .stat-val { font-size:15px; font-weight:900; color:var(--accent); }
    .box { background:var(--card); border:1px solid var(--border); border-radius:18px; padding:22px; margin:20px 0; }
    .faq-item { background:rgba(255,255,255,0.03); border:1px solid var(--border); border-radius:12px; padding:16px; margin-bottom:10px; }
    .faq-q { font-weight:800; font-size:15px; color:#fff; margin-bottom:6px; }
    .faq-a { font-size:14px; color:rgba(255,255,255,0.7); margin:0; }
    .cta-banner { background:linear-gradient(90deg, rgba(34,211,238,0.2), var(--card)); border:1px solid rgba(34,211,238,0.3); border-radius:20px; padding:28px; text-align:center; margin:32px 0; }
    footer { text-align:center; color:rgba(255,255,255,0.4); font-size:13px; margin-top:40px; border-top:1px solid var(--border); padding-top:24px; }
    @media(max-width:640px) { h1 { font-size:24px; } .hero { padding:20px; } }
  </style>
</head>
<body>
  <main class="wrap">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
      <a href="/guias" style="font-weight:700; color:var(--accent); font-size:14px;">← Volver al catálogo de guías</a>
      <a href="/" style="font-weight:700; font-size:13px; color:rgba(255,255,255,0.6);">Ir a Francho Shop</a>
    </div>

    <article>
      <header class="hero">
        <div class="badge">${escapeHtml(art.badge || 'Guía Oficial')} • ${escapeHtml(art.readTime)} • ${escapeHtml(art.updatedDate)}</div>
        <h1>${escapeHtml(art.h1)}</h1>
        <div style="color:#fcd34d; font-size:13px; font-weight:700; margin-bottom:16px;">⭐ ${escapeHtml(art.rating || '4.9/5 en satisfacción gamer')}</div>

        ${art.intro.map(p => `<p>${escapeHtml(p)}</p>`).join('')}

        <div style="display:flex; gap:12px; flex-wrap:wrap; margin-top:20px;">
          <a class="btn" href="/">Recargar Ahora en Francho Shop</a>
          <a class="btn btn-secondary" href="https://wa.me/5356246700" target="_blank" rel="noopener">Consultar por WhatsApp</a>
        </div>
      </header>

      ${art.quickStats ? `
        <div class="stats">
          ${art.quickStats.map(st => `
            <div class="stat-card">
              <div class="stat-label">${escapeHtml(st.label)}</div>
              <div class="stat-val">${escapeHtml(st.value)}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}

      ${art.howToFindId ? `
        <div class="box" style="border-color:rgba(34,211,238,0.3);">
          <h2 style="margin-top:0; border:none; padding:0;">${escapeHtml(art.howToFindId.title)}</h2>
          <ol>
            ${art.howToFindId.steps.map(s => `<li>${escapeHtml(s)}</li>`).join('')}
          </ol>
        </div>
      ` : ''}

      ${art.sections.map(sec => `
        <section class="box">
          <h2 style="margin-top:0;">${escapeHtml(sec.title)}</h2>
          ${sec.text ? `<p>${escapeHtml(sec.text)}</p>` : ''}
          ${sec.list ? `<ul>${sec.list.map(l => `<li>${escapeHtml(l)}</li>`).join('')}</ul>` : ''}
          ${sec.steps ? `<ol>${sec.steps.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ol>` : ''}
        </section>
      `).join('')}

      ${art.faq && art.faq.length > 0 ? `
        <section class="box">
          <h2 style="margin-top:0;">Preguntas Frecuentes sobre esta Recarga</h2>
          ${art.faq.map(([q, a]) => `
            <div class="faq-item">
              <div class="faq-q">❓ ${escapeHtml(q)}</div>
              <p class="faq-a">${escapeHtml(a)}</p>
            </div>
          `).join('')}
        </section>
      ` : ''}

      <div class="cta-banner">
        <h2 style="margin:0 0 10px; border:none; padding:0;">¿Listo para recargar en minutos?</h2>
        <p>Entra a Francho Shop, selecciona tu paquete y paga fácil con Transfermóvil, EnZona o USDT.</p>
        <a class="btn" href="/">Entrar a la Tienda Oficial</a>
      </div>
    </article>

    <footer>
      <p><a href="/guias" style="color:var(--accent);">Ver más guías de juegos</a> · <a href="/">Francho Shop Portada</a></p>
      <p>© 2026 Francho Shop. Tienda líder en Cuba y Latinoamérica.</p>
    </footer>
  </main>
</body>
</html>`

  fs.writeFileSync(path.join(artDir, 'index.html'), artHtml, 'utf8')
  console.log(`✅ Creado /guias/${art.slug}/index.html`)
}

console.log('🎉 Todas las páginas SEO pre-renderizadas fueron creadas exitosamente.')
