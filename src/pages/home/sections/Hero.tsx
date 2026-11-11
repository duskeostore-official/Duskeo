import heroImage from '../../../assets/images/home/hero-campaign.webp'
import { ROUTES } from '../../../constants/routes'
import { BRAND_TAGLINE } from '../../../constants/site'
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { CAMPAIGN_COLLECTIONS, collectionHref } from '../../../data/campaignCollections'
import { loadStorefrontContent, type StorefrontContent } from '../../../lib/storefront'
import './Hero.css'

export function Hero() {
  const [storefront, setStorefront] = useState<StorefrontContent[]>([])
  const [activeSlideKey, setActiveSlideKey] = useState('hero')
  const [transitionFromSlideKey, setTransitionFromSlideKey] = useState<string | null>(null)
  const activeSlideKeyRef = useRef('hero')
  const pointerStart = useRef<{ x: number; y: number } | null>(null)
  const suppressClick = useRef(false)
  const preloadedImages = useRef(new Set<string>())

  useEffect(() => {
    void loadStorefrontContent().then(({ data }) => setStorefront(data))
  }, [])

  const slides = useMemo(() => {
    const heroContent = storefront.find((item) => item.key === 'hero')
    const campaignOne = storefront.find((item) => item.key === 'campaign-1')
    return [
      {
        key: 'hero',
        title: (heroContent?.title || 'BEYOND\\nORDINARY.').replace(/\\n/g, '\n'),
        eyebrow: heroContent?.eyebrow || 'THE NEXT CHAPTER',
        body: BRAND_TAGLINE,
        image: heroContent?.image_url || heroImage,
        alt: 'DUSKEO campaign model beside glowing ivory spire',
        href: ROUTES.explore,
        actionHref: ROUTES.explore,
        action: 'EXPLORE THE COLLECTION →',
      },
      {
        key: 'campaign-1',
        title: campaignOne?.title || 'ANIME COLLECTION',
        eyebrow: campaignOne?.eyebrow || 'ANIME COLLECTION',
        body: campaignOne?.body || '',
        image: campaignOne?.image_url || '/campaigns/anime.jpeg',
        alt: campaignOne?.title || 'ANIME COLLECTION',
        href: campaignOne?.link_url || '#campaign-1',
        actionHref: collectionHref('anime'),
        action: 'SHOP NOW →',
      },
      ...CAMPAIGN_COLLECTIONS.map((campaign) => {
        const content = storefront.find((item) => item.key === campaign.campaignKey)
        return {
          key: campaign.campaignKey,
          title: content?.title || campaign.title,
          eyebrow: content?.eyebrow || campaign.subtitle,
          body: content?.body || campaign.description,
          image: campaign.image,
          alt: `${campaign.title} — ${campaign.subtitle}. ${campaign.description}`,
          href: `#${campaign.campaignKey}`,
          actionHref: collectionHref(campaign.slug),
          action: 'SHOP NOW →',
        }
      }),
    ]
  }, [storefront])
  const activeSlide = slides.find((slide) => slide.key === activeSlideKey) ?? slides[0]
  const activeIndex = slides.findIndex((slide) => slide.key === activeSlide.key)

  const goToSlide = useCallback((nextSlideKey: string) => {
    const nextSlide = slides.find((slide) => slide.key === nextSlideKey)
    const currentSlide = slides.find((slide) => slide.key === activeSlideKeyRef.current) ?? slides[0]
    if (!nextSlide || nextSlide.key === currentSlide.key) return
    activeSlideKeyRef.current = nextSlide.key
    setTransitionFromSlideKey(currentSlide.key)
    setActiveSlideKey(nextSlide.key)
  }, [slides])

  useEffect(() => {
    if (slides.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let timer = 0
    const start = () => {
      if (document.hidden || timer) return
      timer = window.setInterval(() => {
        const currentIndex = slides.findIndex((slide) => slide.key === activeSlideKeyRef.current)
        const nextIndex = (Math.max(currentIndex, 0) + 1) % slides.length
        goToSlide(slides[nextIndex].key)
      }, 6000)
    }
    const stop = () => {
      window.clearInterval(timer)
      timer = 0
    }
    const onVisibilityChange = () => {
      if (document.hidden) stop()
      else start()
    }
    start()
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [goToSlide, slides])

  useEffect(() => {
    if (transitionFromSlideKey === null) return
    const outgoingKey = transitionFromSlideKey
    const timer = window.setTimeout(() => {
      setTransitionFromSlideKey((current) => current === outgoingKey ? null : current)
    }, 1500)
    return () => window.clearTimeout(timer)
  }, [activeSlideKey, transitionFromSlideKey])

  useEffect(() => {
    const nextImage = slides[(activeIndex + 1) % slides.length]?.image
    if (!nextImage || preloadedImages.current.has(nextImage)) return

    const image = new Image()
    image.decoding = 'async'
    image.fetchPriority = 'low'
    image.src = nextImage
    preloadedImages.current.add(nextImage)
  }, [activeIndex, slides, preloadedImages])

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.target instanceof Element && event.target.closest('.hero-copy a, .hero-dots button')) {
      pointerStart.current = null
      return
    }
    pointerStart.current = { x: event.clientX, y: event.clientY }
  }

  const handleSwipe = (clientX: number, clientY: number) => {
    const start = pointerStart.current
    if (!start) return

    const deltaX = clientX - start.x
    const deltaY = clientY - start.y
    if (Math.abs(deltaX) < 45 || Math.abs(deltaX) < Math.abs(deltaY)) return

    pointerStart.current = null
    suppressClick.current = true
    window.setTimeout(() => {
      suppressClick.current = false
    }, 250)
    const nextIndex = (activeIndex + (deltaX < 0 ? 1 : slides.length - 1)) % slides.length
    goToSlide(slides[nextIndex].key)
  }

  const handlePointerUp = (event: PointerEvent<HTMLElement>) => {
    handleSwipe(event.clientX, event.clientY)
    pointerStart.current = null
  }

  return (
    <section
      className="hero"
      aria-label="Featured DUSKEO campaigns"
      onPointerDown={handlePointerDown}
      onPointerMove={(event) => handleSwipe(event.clientX, event.clientY)}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => { pointerStart.current = null }}
      onClickCapture={(event) => {
        if (!suppressClick.current) return
        event.preventDefault()
        event.stopPropagation()
        suppressClick.current = false
      }}
    >
      <div className="hero-copy">
        <nav className="hero-collection-switch" aria-label="Shop by collection">
          <a href={ROUTES.top} aria-current="page">MEN</a>
          <a href={ROUTES.women}>WOMEN</a>
        </nav>
        <div className="eyebrow">{activeSlide.eyebrow}</div>
        <h1>{activeSlide.title.split('\n').map((line, index) => <span key={`${activeSlide.key}-${index}`}>{index > 0 && <br />}{line}</span>)}</h1>
        <div className="rule" />
        <p className="tagline">{activeSlide.body}</p>
        {activeSlide.action && <a className="outline" href={activeSlide.actionHref}>{activeSlide.action}</a>}
        <div className={`hero-note${activeSlide.key === 'hero' ? '' : ' is-hidden'}`} aria-hidden={activeSlide.key !== 'hero'}>
          PREMIUM ESSENTIALS {'  '}| {'  '}LIMITED DROPS {'  '}| {'  '}BUILT DIFFERENT
        </div>
      </div>
      <div className="hero-art">
        {[...new Set([transitionFromSlideKey, activeSlide.key].filter((key): key is string => key !== null))]
          .map((key) => slides.find((slide) => slide.key === key))
          .filter((slide) => slide !== undefined)
          .map((slide) => {
          const isActive = slide.key === activeSlide.key
          return (
            <img
              key={slide.key}
              className={`hero-art-image${slide.key.startsWith('campaign-') && slide.key !== 'campaign-1' ? ' campaign-art' : ''}${isActive ? ' active' : ' outgoing'}`}
              src={slide.image}
              alt={isActive ? slide.alt : ''}
              aria-hidden={!isActive}
              fetchPriority={slide.key === 'hero' ? 'high' : undefined}
              decoding="async"
              onAnimationEnd={!isActive ? (event) => {
                if (event.animationName === 'hero-fade-out') {
                  setTransitionFromSlideKey((current) => current === slide.key ? null : current)
                }
              } : undefined}
            />
          )
        })}
        {activeSlide.key !== 'hero' && (
          <a className="hero-art-link" href={activeSlide.actionHref} aria-label={`Explore ${activeSlide.title}`} />
        )}
      </div>
      {slides.length > 1 && (
        <div className="hero-dots" aria-label="Featured campaigns">
          {slides.map((slide, index) => (
            <button
              key={slide.key}
              type="button"
              className={index === activeIndex ? 'active' : ''}
              aria-label={`Show ${slide.title.replace(/\n/g, ' ')} slide`}
              aria-current={index === activeIndex ? 'true' : undefined}
              onClick={() => goToSlide(slide.key)}
            />
          ))}
        </div>
      )}
    </section>
  )
}
