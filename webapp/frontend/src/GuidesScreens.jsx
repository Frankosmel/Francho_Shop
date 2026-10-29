import React, { useState, useEffect } from 'react'
import {
  ArrowLeft, ShoppingCart, MessageCircle, Globe2, Check,
  CircleHelp, Sparkles, Gamepad2, ChevronRight, Search, ShieldCheck,
  Zap, CreditCard, DollarSign, Clock, Star, AlertCircle, Share2,
  Copy, BookOpen, Layers
} from 'lucide-react'
import { GUIDE_CATEGORIES, GUIDE_ARTICLES, GUIDE_BY_SLUG } from './guidesData'

const WHATSAPP_SUPPORT_URL = 'https://wa.me/5356246700'

export function GuidesIndexScreen({ onOpenGuide, onHome, onSelectGame }) {
  const [activeCategory, setActiveCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredArticles = GUIDE_ARTICLES.filter(article => {
    const matchesCat = activeCategory === 'all' || article.category === activeCategory
    const q = searchQuery.toLowerCase().trim()
    const matchesQuery = !q ||
      article.title.toLowerCase().includes(q) ||
      article.description.toLowerCase().includes(q) ||
      (article.keywords || '').toLowerCase().includes(q) ||
      article.cardTitle.toLowerCase().includes(q)
    return matchesCat && matchesQuery
  })

  return (
    <main className="p-3 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* Hero Header */}
      <section className="relative overflow-hidden rounded-3xl border border-accent/25 bg-gradient-to-br from-card via-card to-accent/10 p-6 md:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/15 border border-accent/30 text-xs font-bold text-accent">
            <BookOpen className="h-4 w-4" /> Centro de Guías Oficiales & SEO Francho Shop
          </div>
          <h1 className="text-2xl md:text-4xl font-black text-white tracking-tight leading-tight">
            Guías de Recargas, Topup y Juegos Online en Cuba 2026
          </h1>
          <p className="text-sm md:text-base text-white/70 max-w-2xl leading-relaxed">
            Aprende cómo recargar diamantes, monedas, comprar gift cards y números virtuales desde Cuba usando Transfermóvil, EnZona y USDT con acreditación automática 24/7.
          </p>

          <div className="pt-2 flex flex-wrap gap-3">
            <button
              onClick={onHome}
              className="btn-primary inline-flex items-center gap-2 text-sm font-bold shadow-lg shadow-accent/20"
            >
              <ShoppingCart className="h-4 w-4" /> Ir a la Tienda Principal
            </button>
            <a
              href={WHATSAPP_SUPPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/90 text-sm font-semibold transition"
            >
              <MessageCircle className="h-4 w-4 text-green-400" /> Soporte en WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* Buscador y Filtros */}
      <section className="space-y-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar guías (ej: Free Fire, Mobile Legends, Robux, Transfermóvil, Steam)..."
            className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-card border border-white/10 text-white placeholder-white/40 text-sm focus:outline-none focus:border-accent transition shadow-inner"
          />
        </div>

        {/* Categorías Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {GUIDE_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition active:scale-95 ${
                activeCategory === cat.id
                  ? 'bg-accent text-black shadow-md shadow-accent/20'
                  : 'bg-card border border-white/10 text-white/70 hover:bg-white/10'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </section>

      {/* Grid de Artículos */}
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredArticles.map(article => (
          <article
            key={article.slug}
            onClick={() => onOpenGuide(article.slug)}
            className="group card p-5 flex flex-col justify-between cursor-pointer border border-white/10 hover:border-accent/40 bg-card hover:bg-card/90 transition-all duration-200 rounded-2xl hover:shadow-xl hover:shadow-accent/5 active:scale-[0.99]"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-accent/10 border border-accent/20 text-[11px] font-bold text-accent">
                  <Sparkles className="h-3 w-3" /> {article.badge || 'Oficial'}
                </span>
                <span className="text-[11px] text-white/40 font-medium">
                  {article.readTime}
                </span>
              </div>

              <h2 className="text-base md:text-lg font-bold text-white group-hover:text-accent transition leading-snug">
                {article.cardTitle}
              </h2>

              <p className="text-xs text-white/60 line-clamp-3 leading-relaxed">
                {article.description}
              </p>
            </div>

            <div className="pt-4 mt-3 border-t border-white/5 flex items-center justify-between text-xs font-semibold text-accent">
              <span className="flex items-center gap-1 text-white/40 font-normal">
                <Clock className="h-3.5 w-3.5" /> {article.updatedDate}
              </span>
              <span className="inline-flex items-center gap-1 group-hover:translate-x-1 transition">
                Leer guía completa <ChevronRight className="h-4 w-4" />
              </span>
            </div>
          </article>
        ))}
      </section>

      {filteredArticles.length === 0 && (
        <div className="card p-8 text-center space-y-3">
          <p className="text-white/60">No se encontraron guías para "{searchQuery}".</p>
          <button
            onClick={() => { setSearchQuery(''); setActiveCategory('all') }}
            className="btn-primary text-xs max-w-xs mx-auto"
          >
            Ver todas las guías
          </button>
        </div>
      )}

      {/* Ventajas y Garantías */}
      <section className="rounded-2xl border border-white/10 bg-card p-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        <div className="space-y-1">
          <Zap className="h-6 w-6 text-yellow-400 mx-auto" />
          <h3 className="font-bold text-sm text-white">Entrega en 1-3 Min</h3>
          <p className="text-xs text-white/50">Automatización directa al ID</p>
        </div>
        <div className="space-y-1">
          <CreditCard className="h-6 w-6 text-green-400 mx-auto" />
          <h3 className="font-bold text-sm text-white">Transfermóvil & EnZona</h3>
          <p className="text-xs text-white/50">Pagos cómodos en CUP</p>
        </div>
        <div className="space-y-1">
          <ShieldCheck className="h-6 w-6 text-accent mx-auto" />
          <h3 className="font-bold text-sm text-white">100% Sin Contraseñas</h3>
          <p className="text-xs text-white/50">Tus credenciales están seguras</p>
        </div>
        <div className="space-y-1">
          <DollarSign className="h-6 w-6 text-cyan-400 mx-auto" />
          <h3 className="font-bold text-sm text-white">USDT Cripto</h3>
          <p className="text-xs text-white/50">OxaPay, Binance & TRC20</p>
        </div>
      </section>
    </main>
  )
}

export function GuideDetailScreen({ slug, onOpenGuide, onHome, onSelectGame }) {
  const article = GUIDE_BY_SLUG[slug] || GUIDE_ARTICLES[0]
  const related = GUIDE_ARTICLES.filter(item => item.slug !== article.slug).slice(0, 4)
  const [copiedLink, setCopiedLink] = useState(false)
  const [openFaqIndex, setOpenFaqIndex] = useState(null)

  // Inyección de Schema.org FAQPage y Article para Google Rich Snippets
  useEffect(() => {
    const faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": (article.faq || []).map(([question, answer]) => ({
        "@type": "Question",
        "name": question,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": answer
        }
      }))
    }

    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.id = 'seo-article-faq-schema'
    script.text = JSON.stringify(faqSchema)
    document.head.appendChild(script)

    return () => {
      const existing = document.getElementById('seo-article-faq-schema')
      if (existing) existing.remove()
    }
  }, [article.slug])

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: article.title,
        text: article.description,
        url: window.location.href,
      }).catch(() => {})
    } else {
      navigator.clipboard.writeText(window.location.href)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2500)
    }
  }

  const handleGoToBuy = () => {
    if (article.gameTarget && article.gameTarget !== 'all') {
      if (onSelectGame) {
        onSelectGame(article.gameTarget)
        return
      }
    }
    onHome()
  }

  return (
    <main className="p-3 md:p-6 max-w-4xl mx-auto space-y-6">
      {/* Botón Volver y Compartir */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => onOpenGuide('')}
          className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 px-3.5 py-2 text-xs font-bold text-white transition active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" /> Volver al catálogo de guías
        </button>

        <button
          onClick={handleShare}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-card border border-white/10 text-xs font-semibold text-white/80 hover:text-white hover:bg-white/10 transition"
        >
          {copiedLink ? <Check className="h-4 w-4 text-green-400" /> : <Share2 className="h-4 w-4" />}
          {copiedLink ? '¡Enlace copiado!' : 'Compartir guía'}
        </button>
      </div>

      {/* Hero del Artículo */}
      <header className="rounded-3xl border border-accent/20 bg-gradient-to-br from-card via-card to-accent/10 p-6 md:p-8 shadow-2xl space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/15 border border-accent/30 font-bold text-accent">
            <Globe2 className="h-3.5 w-3.5" /> {article.badge || 'Guía Verificada'}
          </span>
          <span className="flex items-center gap-1 text-white/50">
            <Clock className="h-3.5 w-3.5" /> {article.readTime}
          </span>
          <span className="flex items-center gap-1 text-white/50">
            • {article.updatedDate}
          </span>
        </div>

        <h1 className="text-2xl md:text-4xl font-black text-white leading-tight">
          {article.h1}
        </h1>

        <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
          <Star className="h-4 w-4 fill-amber-300" />
          <span>{article.rating || '4.9/5 en satisfacción gamer'}</span>
        </div>

        {/* Intro */}
        <div className="space-y-3 text-sm md:text-base text-white/80 leading-relaxed pt-2">
          {article.intro.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        {/* Botones de acción directa */}
        <div className="pt-2 flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleGoToBuy}
            className="btn-primary flex-1 inline-flex items-center justify-center gap-2 text-sm font-black shadow-lg shadow-accent/25"
          >
            <ShoppingCart className="h-5 w-5" />
            Recargar Ahora en Francho Shop
          </button>
          <a
            href={WHATSAPP_SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white font-bold text-sm inline-flex items-center justify-center gap-2 transition"
          >
            <MessageCircle className="h-5 w-5 text-green-400" />
            Consultar por WhatsApp
          </a>
        </div>
      </header>

      {/* Métricas rápidas del juego */}
      {article.quickStats && (
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {article.quickStats.map((st, i) => (
            <div key={i} className="card p-3.5 text-center rounded-2xl border border-white/10 space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-white/40">
                {st.label}
              </span>
              <p className="text-sm md:text-base font-black text-accent truncate">
                {st.value}
              </p>
            </div>
          ))}
        </section>
      )}

      {/* Paquetes Populares Disponibles */}
      {article.popularPackages && (
        <section className="card p-6 rounded-2xl border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg md:text-xl font-black text-white flex items-center gap-2">
              <Layers className="h-5 w-5 text-accent" /> Paquetes y Denominaciones Populares
            </h2>
            <span className="text-xs text-white/50">Disponibles 24/7</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {article.popularPackages.map((pkg, i) => (
              <div
                key={i}
                className="p-4 rounded-xl bg-bg/80 border border-white/10 flex flex-col justify-between space-y-2 hover:border-accent/40 transition"
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-xs px-2 py-0.5 rounded bg-accent/15 text-accent font-bold">
                      {pkg.tag}
                    </span>
                  </div>
                  <h3 className="font-bold text-white text-sm">{pkg.name}</h3>
                  <p className="text-xs text-white/60 leading-relaxed mt-1">{pkg.desc}</p>
                </div>
                <button
                  onClick={handleGoToBuy}
                  className="mt-2 text-xs font-bold text-accent hover:underline inline-flex items-center gap-1 self-start"
                >
                  Ver precio en CUP/USD <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Cómo encontrar tu ID */}
      {article.howToFindId && (
        <section className="card p-6 rounded-2xl border border-white/10 space-y-3 bg-gradient-to-r from-card to-blue-950/20">
          <h2 className="text-lg md:text-xl font-black text-white flex items-center gap-2">
            <Gamepad2 className="h-5 w-5 text-cyan-400" /> {article.howToFindId.title}
          </h2>
          <ol className="space-y-2.5 pt-2">
            {article.howToFindId.steps.map((step, idx) => (
              <li key={idx} className="flex items-start gap-3 text-sm text-white/80">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-300 font-bold text-xs mt-0.5">
                  {idx + 1}
                </span>
                <span className="leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Secciones del Artículo */}
      <div className="space-y-4">
        {article.sections.map((section, idx) => (
          <section key={idx} className="card p-6 rounded-2xl border border-white/10 space-y-3">
            <h2 className="text-lg md:text-xl font-black text-white leading-snug">
              {section.title}
            </h2>
            {section.text && (
              <p className="text-sm md:text-base text-white/70 leading-relaxed">
                {section.text}
              </p>
            )}
            {section.list && (
              <ul className="space-y-2 pt-1">
                {section.list.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-white/80 leading-relaxed">
                    <Check className="h-4 w-4 text-green-400 flex-shrink-0 mt-1" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}
            {section.steps && (
              <ol className="space-y-3 pt-2">
                {section.steps.map((st, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-white/80">
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent font-bold text-xs mt-0.5">
                      {i + 1}
                    </span>
                    <span className="leading-relaxed">{st}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        ))}
      </div>

      {/* Preguntas Frecuentes Acordeón */}
      {article.faq && article.faq.length > 0 && (
        <section className="card p-6 rounded-2xl border border-white/10 space-y-4">
          <div className="flex items-center gap-2">
            <CircleHelp className="h-6 w-6 text-accent" />
            <h2 className="text-lg md:text-xl font-black text-white">
              Preguntas Frecuentes sobre esta Recarga
            </h2>
          </div>

          <div className="space-y-2 pt-2">
            {article.faq.map(([q, a], idx) => {
              const isOpen = openFaqIndex === idx
              return (
                <div
                  key={idx}
                  className="rounded-xl border border-white/5 bg-bg/60 overflow-hidden transition"
                >
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full p-4 text-left font-bold text-sm text-white flex items-center justify-between gap-3 hover:bg-white/5 transition"
                  >
                    <span>{q}</span>
                    <ChevronRight
                      className={`h-4 w-4 text-accent transition-transform duration-200 flex-shrink-0 ${
                        isOpen ? 'rotate-90' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 text-xs md:text-sm text-white/70 leading-relaxed border-t border-white/5 pt-2">
                      {a}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Banner de CTA Final */}
      <section className="rounded-3xl border border-accent/30 bg-gradient-to-r from-accent/20 via-card to-card p-6 md:p-8 text-center space-y-4 shadow-xl">
        <h2 className="text-xl md:text-2xl font-black text-white">
          ¿Listo para recibir tu recarga en minutos?
        </h2>
        <p className="text-sm text-white/70 max-w-xl mx-auto">
          Ingresa a la tienda, selecciona tu paquete y paga al instante con Transfermóvil, EnZona o USDT.
        </p>
        <button
          onClick={handleGoToBuy}
          className="btn-primary inline-flex items-center gap-2 text-sm font-black px-8 py-3.5 shadow-xl shadow-accent/20"
        >
          <ShoppingCart className="h-5 w-5" />
          Comprar Ahora en Francho Shop
        </button>
      </section>

      {/* Otras Guías Relacionadas */}
      <section className="card p-6 rounded-2xl border border-white/10 space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-accent" /> Otras Guías Populares de Juegos
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {related.map(item => (
            <button
              key={item.slug}
              onClick={() => onOpenGuide(item.slug)}
              className="p-3.5 rounded-xl bg-bg border border-white/5 hover:border-accent/40 text-left transition flex items-center justify-between group active:scale-[0.99]"
            >
              <div>
                <h3 className="text-xs md:text-sm font-bold text-white group-hover:text-accent transition">
                  {item.cardTitle}
                </h3>
                <span className="text-[11px] text-white/40">{item.readTime}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-white/30 group-hover:text-accent transition" />
            </button>
          ))}
        </div>
      </section>
    </main>
  )
}
