import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LandingSearch from '../components/LandingSearchBar.jsx'
import { useChampions } from '../hooks/useChampions.js'
import { useTopComps } from '../hooks/useTopComps.js'
import { useStats } from '../hooks/useStats.js'
import { useLeaderboard } from '../hooks/useLeaderboard.js'
import BookmarkStrip from '../components/BookmarkStrip.jsx'
import { CURRENT_SET } from '../constants/game.js'
import { ROUTES } from '../constants/routes.js'
import styles from './LandingPage.module.css'


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
          <KineticWordmark />
        </div>
      </div>
    </div>
  )
}

// Types out an array of strings one character at a time, line by line.
// Returns the partially-typed text per line, which line is currently active,
// and whether the whole sequence has finished (used to drop the caret).
function useTypewriter(segments, { speed = 34, startDelay = 300, lineDelay = 400 } = {}) {
  // Stable dependency: re-run only when the actual text changes (e.g. language switch).
  const key = segments.join('\n')
  const [typed, setTyped] = useState(() => segments.map(() => ''))
  const [activeLine, setActiveLine] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const lines = key.split('\n')
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (reducedMotion?.matches) {
      setTyped(lines)
      setActiveLine(lines.length - 1)
      setDone(true)
      return undefined
    }

    setTyped(lines.map(() => ''))
    setActiveLine(0)
    setDone(false)

    let timeoutId
    let line = 0
    let char = 0

    const typeNext = () => {
      if (line >= lines.length) {
        setDone(true)
        return
      }
      const current = lines[line]
      if (char <= current.length) {
        setTyped((prev) => {
          const next = [...prev]
          next[line] = current.slice(0, char)
          return next
        })
        char += 1
        timeoutId = setTimeout(typeNext, speed)
      } else {
        line += 1
        char = 0
        setActiveLine(line)
        timeoutId = setTimeout(typeNext, lineDelay)
      }
    }

    timeoutId = setTimeout(typeNext, startDelay)
    return () => clearTimeout(timeoutId)
  }, [key])

  return { typed, activeLine, done }
}

const WORDMARK = 'DUALYTICS'
// Aerospace/HUD-flavored glyph pool the wordmark scrambles through (no katakana).
// Widest glyphs (M W # %) are omitted so they don't overflow the snug decode cells.
const DECODE_GLYPHS = 'ABCDEFGHIJKLNOPQRSTUVXYZ0123456789/<>'

// Scrambles `text` on mount and resolves it left→right into the final string.
// Unresolved positions cycle a random glyph every `tickMs`; one more position
// locks in every `revealEvery` ms. Returns the current display string + done flag.
// Mirrors useTypewriter's reduced-motion handling: shows the final text instantly.
function useDecodeText(text, { tickMs = 50, revealEvery = 100, startDelay = 150 } = {}) {
  const [display, setDisplay] = useState(text)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (reducedMotion?.matches) {
      setDisplay(text)
      setDone(true)
      return undefined
    }

    const randomGlyph = () => DECODE_GLYPHS[Math.floor(Math.random() * DECODE_GLYPHS.length)]
    const lockEvery = Math.max(1, Math.round(revealEvery / tickMs))

    setDisplay(text.split('').map((c) => (c === ' ' ? ' ' : randomGlyph())).join(''))
    setDone(false)

    let revealed = 0
    let tick = 0
    let intervalId

    const run = () => {
      intervalId = setInterval(() => {
        tick += 1
        if (tick % lockEvery === 0) revealed += 1

        if (revealed >= text.length) {
          setDisplay(text)
          setDone(true)
          clearInterval(intervalId)
          return
        }

        let out = ''
        for (let i = 0; i < text.length; i += 1) {
          out += i < revealed || text[i] === ' ' ? text[i] : randomGlyph()
        }
        setDisplay(out)
      }, tickMs)
    }

    const startId = setTimeout(run, startDelay)

    return () => {
      clearTimeout(startId)
      clearInterval(intervalId)
    }
  }, [text, tickMs, revealEvery, startDelay])

  return { display, done }
}

// The DUALYTICS hero logo: decodes in on load. The h1 keeps a stable accessible
// name while the per-character spans (which briefly show scrambled glyphs) are
// hidden from screen readers.
function KineticWordmark() {
  const { display } = useDecodeText(WORDMARK)

  return (
    <h1 className={styles.signWordmark} aria-label={WORDMARK}>
      <span className={styles.signChars} aria-hidden="true">
        {display.split('').map((char, i) => (
          <span
            key={i}
            className={i < 2 ? `${styles.signChar} ${styles.signDu}` : styles.signChar}
          >
            {char}
          </span>
        ))}
      </span>
    </h1>
  )
}

function Tagline() {
  const { t } = useTranslation()
  const body = t('landing.taglineBody')
  // Eyebrow renders statically; only the body line uses the typewriter effect.
  const { typed, done } = useTypewriter([body])

  return (
    <div className={styles.tagline}>
      <div className={styles.taglineEyebrow}>{t('landing.taglineEyebrow', { set: CURRENT_SET })}</div>
      <div className={styles.taglineBody}>
        {typed[0]}
        {!done && <span className={styles.caret} aria-hidden="true" />}
      </div>
    </div>
  )
}

const DESTINATIONS = [
  { key: 'comps', to: ROUTES.comps, sigil: 'comps' },
  { key: 'stats', to: ROUTES.stats, sigil: 'stats' },
  { key: 'leaderboard', to: ROUTES.leaderboard, sigil: 'ladder' },
  { key: 'builder', to: ROUTES.builder, sigil: 'hex' },
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

  if (kind === 'ladder') return (
    <svg width={s} height={s} viewBox="0 0 22 22" fill="none" aria-hidden="true" focusable="false">
      <line x1="1" y1="20" x2="21" y2="20" stroke={c}/>
      <polygon points="11,1 12.4,4 15.6,4 13,6 14,9 11,7.2 8,9 9,6 6.4,4 9.6,4" stroke={c}/>
      <rect x="2" y="12" width="5" height="8" stroke={c}/>
      <rect x="8.5" y="9" width="5" height="11" stroke={c}/>
      <rect x="15" y="15" width="5" height="5" stroke={c}/>
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
  const { data: leaderboardData } = useLeaderboard('na')

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

    if (destination.key === 'leaderboard') {
      return {
        ...base,
        stat: stat(leaderboardData?.entries?.length ?? 0, t('landing.statRankedPlayers')),
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
