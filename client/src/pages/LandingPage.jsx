import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LandingSearch from '../components/LandingSearchBar.jsx'
import { useChampions } from '../hooks/useChampions.js'
import { useTopComps } from '../hooks/useTopComps.js'
import { useStats } from '../hooks/useStats.js'
import BookmarkStrip from '../components/BookmarkStrip.jsx'
import { CURRENT_SET } from '../constants/game.js'
import { ROUTES } from '../constants/routes.js'
import styles from './LandingPage.module.css'


function Starfield() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined

    const ctx = canvas.getContext('2d')
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    let raf, w, h, stars

    const resize = () => {
      w = canvas.width = canvas.offsetWidth
      h = canvas.height = canvas.offsetHeight
      const count = Math.floor((w * h) / 9000)
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        z: Math.random() * 0.7 + 0.3,
        s: Math.random() * 1.2 + 0.2,
        tw: Math.random() * Math.PI * 2,
      }))
    }

    resize()
    window.addEventListener('resize', resize)

    const drawStars = () => {
      ctx.clearRect(0, 0, w, h)
      for (const s of stars) {
        const a = 0.25 + 0.45 * s.z
        ctx.fillStyle = `rgba(250,250,255,${a})`
        ctx.fillRect(s.x, s.y, s.s, s.s)
      }
    }

    if (reducedMotion?.matches) {
      window.removeEventListener('resize', resize)
      const handleStaticResize = () => {
        resize()
        drawStars()
      }
      window.addEventListener('resize', handleStaticResize)
      drawStars()
      return () => {
        window.removeEventListener('resize', handleStaticResize)
      }
    }

    let t0 = performance.now()

    const tick = () => {
      const now = performance.now()
      const dt = (now - t0) / 1000
      t0 = now
      ctx.clearRect(0, 0, w, h)
      for (const s of stars) {
        s.x -= dt * 4 * s.z
        s.tw += dt * 1.5
        if (s.x < -2) s.x = w + 2
        const a = 0.25 + 0.45 * s.z * (0.6 + 0.4 * Math.sin(s.tw))
        ctx.fillStyle = `rgba(250,250,255,${a})`
        ctx.fillRect(s.x, s.y, s.s, s.s)
      }

      raf = requestAnimationFrame(tick)
    }

    tick()
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={canvasRef} className={styles.fixed} style={{ zIndex: 0 }} />
}

function HeroSign() {
  const signOuterRef = useRef(null)
  const size = 150
  const outside = size * 0.5

  useEffect(() => {
    const node = signOuterRef.current
    if (!node) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (reducedMotion.matches) return

    let raf = 0

    const updateParallax = (clientX, clientY) => {
      const offsetX = ((clientX / window.innerWidth) - 0.5) * 10
      const offsetY = ((clientY / window.innerHeight) - 0.5) * 10

      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        node.style.setProperty('--parallax-x', `${offsetX.toFixed(2)}px`)
        node.style.setProperty('--parallax-y', `${offsetY.toFixed(2)}px`)
        node.style.setProperty('--parallax-invert-x', `${(-offsetX).toFixed(2)}px`)
        node.style.setProperty('--parallax-invert-y', `${(-offsetY).toFixed(2)}px`)
      })
    }

    const handlePointerMove = (event) => {
      updateParallax(event.clientX, event.clientY)
    }

    const resetParallax = () => {
      node.style.setProperty('--parallax-x', '0px')
      node.style.setProperty('--parallax-y', '0px')
      node.style.setProperty('--parallax-invert-x', '0px')
      node.style.setProperty('--parallax-invert-y', '0px')
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('blur', resetParallax)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('blur', resetParallax)
    }
  }, [])

  return (
    <div className={styles.heroWrap}>
      <div ref={signOuterRef} className={styles.signOuter}>
        {/* Top-right dango: rotate 45° so head points up-right */}
        <div
          className={styles.dangoTR}
          style={{ width: size, height: size, top: -outside, right: -outside }}
        >
          <div className={styles.dangoMotionFast}>
            <img
              src="/assets/dango-limeberry-cutout.png"
              alt=""
              className={styles.dangoImg}
              style={{ transform: 'rotate(45deg)' }}
            />
          </div>
        </div>

        <div
          className={styles.dangoBL}
          style={{ width: size, height: size, bottom: -outside-20, left: -outside-20 }}
        >
          <div className={styles.dangoMotionSlow}>
            <img
              src="/assets/dango-limeberry-cutout.png"
              alt=""
              className={styles.dangoImg}
            />
          </div>
        </div>

        <div className={styles.sign}>
          <div className={styles.tick + ' ' + styles.tickTL} />
          <div className={styles.tick + ' ' + styles.tickTR} />
          <div className={styles.tick + ' ' + styles.tickBL} />
          <div className={styles.tick + ' ' + styles.tickBR} />
          <h1 className={styles.signWordmark}>
            <span className={styles.signDu}>DU</span>ALYTICS
          </h1>
        </div>
      </div>
    </div>
  )
}

function Tagline() {
  const { t } = useTranslation()
  return (
    <div className={styles.tagline}>
      <div className={styles.taglineEyebrow}>{t('landing.taglineEyebrow', { set: CURRENT_SET })}</div>
      <div className={styles.taglineBody}>{t('landing.taglineBody')}</div>
    </div>
  )
}

const DESTINATIONS = [
  { key: 'comps', to: ROUTES.comps, sigil: 'comps' },
  { key: 'builder', to: ROUTES.builder, sigil: 'hex' },
  { key: 'stats', to: ROUTES.stats, sigil: 'stats' },
]

const formatCount = (value) => {
  if (!Number.isFinite(value) || value <= 0) return null
  return value.toLocaleString()
}

const stat = (value, label) => {
  const formatted = formatCount(value)
  return formatted ? { v: formatted, l: label } : null
}

function Sigil({ kind, bright }) {
  const c = bright ? 'var(--text-primary)' : 'var(--text-muted)'
  const s = 22

  if (kind === 'comps') return (
    <svg width={s} height={s} viewBox="0 0 22 22" fill="none" aria-hidden="true" focusable="false">
      <rect x="1" y="3" width="9" height="6" stroke={c}/>
      <rect x="12" y="3" width="9" height="6" stroke={c}/>
      <rect x="1" y="13" width="9" height="6" stroke={c}/>
      <rect x="12" y="13" width="9" height="6" stroke={c}/>
    </svg>
  )

  if (kind === 'hex') return (
    <svg width={s} height={s} viewBox="0 0 22 22" fill="none" aria-hidden="true" focusable="false">
      <polygon points="11,1 20,6 20,16 11,21 2,16 2,6" stroke={c}/>
      <polygon points="11,7 15,9 15,13 11,15 7,13 7,9" stroke={c}/>
    </svg>
  )

  if (kind === 'stats') return (
    <svg width={s} height={s} viewBox="0 0 22 22" fill="none" aria-hidden="true" focusable="false">
      <line x1="3" y1="19" x2="20" y2="19" stroke={c}/>
      <rect x="4" y="10" width="3" height="7" stroke={c}/>
      <rect x="10" y="6" width="3" height="11" stroke={c}/>
      <rect x="16" y="3" width="3" height="14" stroke={c}/>
    </svg>
  )

  return (
    <svg width={s} height={s} viewBox="0 0 22 22" fill="none" aria-hidden="true" focusable="false">
      <circle cx="11" cy="11" r="9" stroke={c}/>
      <line x1="11" y1="6" x2="11" y2="6.5" stroke={c} strokeWidth="2"/>
      <line x1="11" y1="10" x2="11" y2="16" stroke={c}/>
    </svg>
  )
}

function DestCard({ to, title, eyebrow, body, stat: primaryStat, stat2, sigil }) {
  const [hover, setHover] = useState(false)
  const stats = [primaryStat, stat2].filter(Boolean)

  return (
    <Link
      to={to}
      className={styles.destCard}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className={styles.destCardTop}>
        <span className={styles.destEyebrow}>{eyebrow}</span>
        <Sigil kind={sigil} bright={hover} />
      </div>
      <div className={styles.destTitle}>
        {title.toUpperCase()}
        <span className={styles.destArrow}>-&gt;</span>
      </div>
      <div className={styles.destBody}>{body}</div>
      {stats.length > 0 && (
        <div className={styles.destStats}>
          {stats.map(({ v, l }) => (
            <div key={l}>
              <span className={styles.statVal}>{v}</span>
              <span className={styles.statLabel}>{l}</span>
            </div>
          ))}
        </div>
      )}
    </Link>
  )
}

function DestinationGrid() {
  const { t } = useTranslation()
  const { data: champions } = useChampions()
  const { data: compsData } = useTopComps()
  const { data: statsData } = useStats({ type: 'units' })

  const comps = compsData?.comps || []
  const destinations = DESTINATIONS.map((destination) => {
    const base = {
      ...destination,
      title: t(`landing.${destination.key}Title`),
      eyebrow: t(`landing.${destination.key}Eyebrow`),
      body: t(`landing.${destination.key}Body`),
    }

    if (destination.key === 'comps') {
      return {
        ...base,
        stat: stat(comps.length, t('landing.statTopComps')),
        stat2: stat(compsData?.matchCount ?? 0, t('landing.statGamesAnalyzed')),
      }
    }

    if (destination.key === 'builder') {
      return {
        ...base,
        stat: stat(champions?.length ?? 0, t('landing.statUnits')),
      }
    }

    if (destination.key === 'stats') {
      return {
        ...base,
        stat: stat(statsData?.rows?.length ?? 0, t('landing.statUnitsTracked')),
        stat2: stat(statsData?.matchCount ?? 0, t('landing.statPatchGames')),
      }
    }

    return base
  })

  return (
    <div className={styles.destGrid}>
      {destinations.map(({ key, ...destination }) => (
        <DestCard key={key} {...destination} />
      ))}
    </div>
  )
}

export default function LandingPage() {
  const [region, setRegion] = useState('na')
  return (
    <div className={styles.page}>
      <Starfield />
      <div className={styles.scanline} />
      <div className={styles.main}>
        <HeroSign />
        <Tagline />
        <LandingSearch region={region} setRegion={setRegion} />
        <BookmarkStrip activeRegion={region} />
        <DestinationGrid />
      </div>
    </div>
  )
}
