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
import { LANDING_SEED } from '../constants/landingSeed.js'
import styles from './LandingPage.module.css'


function HeroSign() {
  const size = 150
  const outside = size * 0.5

  return (
    <div className={styles.heroWrap}>
      <div className={styles.signOuter}>
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
          <div className={styles.tick + ' ' + styles.tickBR} />
          <KineticWordmark />
        </div>
      </div>
    </div>
  )
}

const WORDMARK = 'DUALYTICS'
// Aerospace/HUD-flavored glyph pool the wordmark scrambles through (no katakana).
// Widest glyphs (M W # %) are omitted so they don't overflow the snug decode cells.
const DECODE_GLYPHS = 'ABCDEFGHIJKLNOPQRSTUVXYZ0123456789/<>'

const randomGlyph = () => DECODE_GLYPHS[Math.floor(Math.random() * DECODE_GLYPHS.length)]
// Replaces every non-space character with a random glyph (the fully-scrambled frame).
const scrambleText = (text) =>
  text.split('').map((c) => (c === ' ' ? ' ' : randomGlyph())).join('')
const prefersReducedMotion = () =>
  !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches

// Returns the non-space character positions of `text` in a random order — the
// order the decode locks them in (Fisher-Yates shuffle).
const shuffledPositions = (text) => {
  const order = []
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] !== ' ') order.push(i)
  }
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order
}

// Scrambles `text` on mount, then resolves it into the final string by locking
// one position at a time in a random order (a "jitter" decode rather than a
// strict left→right reveal). Unlocked positions keep cycling a random glyph
// every `tickMs`; one more locks in every `lockMs`. Returns the current display
// string + done flag. Honors prefers-reduced-motion by showing the text instantly.
function useDecodeText(text, { tickMs = 40, lockMs = 40, startDelay = 120 } = {}) {
  // Seed state to the correct first frame so the effect never has to set state
  // synchronously on mount (which the lint rules flag as a cascading render):
  // reduced motion seeds the final text and "done"; otherwise we seed a
  // fully-scrambled frame that the interval resolves.
  const [display, setDisplay] = useState(() => (prefersReducedMotion() ? text : scrambleText(text)))
  const [done, setDone] = useState(prefersReducedMotion)

  useEffect(() => {
    if (prefersReducedMotion()) return undefined

    const lockEvery = Math.max(1, Math.round(lockMs / tickMs))

    // Random order in which positions snap to their final glyph.
    const order = shuffledPositions(text)
    const locked = new Set()
    let revealed = 0
    let tick = 0
    let intervalId

    const run = () => {
      // Re-seed inside the timer callback (not the effect body) so a text change
      // restarts the decode cleanly without a synchronous in-effect setState.
      setDisplay(scrambleText(text))
      setDone(false)

      intervalId = setInterval(() => {
        tick += 1
        if (tick % lockEvery === 0 && revealed < order.length) {
          locked.add(order[revealed])
          revealed += 1
        }

        if (revealed >= order.length) {
          setDisplay(text)
          setDone(true)
          clearInterval(intervalId)
          return
        }

        let out = ''
        for (let i = 0; i < text.length; i += 1) {
          out += locked.has(i) || text[i] === ' ' ? text[i] : randomGlyph()
        }
        setDisplay(out)
      }, tickMs)
    }

    const startId = setTimeout(run, startDelay)

    return () => {
      clearTimeout(startId)
      clearInterval(intervalId)
    }
  }, [text, tickMs, lockMs, startDelay])

  return { display, done }
}

// The DUALYTICS hero logo: decodes in on load. The h1 keeps a stable accessible
// name while the per-character spans (which briefly show scrambled glyphs) are
// hidden from screen readers.
function KineticWordmark() {
  const { display, done } = useDecodeText(WORDMARK)

  return (
    <h1 className={styles.signWordmark} aria-label={WORDMARK}>
      {/* Fixed-width cells keep the scramble from reflowing; once decoded we drop
          to natural widths so letters (esp. the narrow "I") space evenly. */}
      <span
        className={done ? `${styles.signChars} ${styles.signCharsDone}` : styles.signChars}
        aria-hidden="true"
      >
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

  // The tagline is the value proposition, so it renders immediately and simply
  // fades up — no per-character typing that would delay reading it.
  return (
    <div className={styles.tagline}>
      <div className={styles.taglineEyebrow}>{t('landing.taglineEyebrow', { set: CURRENT_SET })}</div>
      <div className={styles.taglineBody}>{t('landing.taglineBody')}</div>
    </div>
  )
}

const DESTINATIONS = [
  { key: 'comps', to: ROUTES.comps, sigil: 'comps' },
  { key: 'stats', to: ROUTES.stats, sigil: 'stats' },
  { key: 'leaderboard', to: ROUTES.leaderboard, sigil: 'ladder' },
  { key: 'builder', to: ROUTES.builder, sigil: 'hex' },
]

// Builds a stat descriptor for a card. `value` is the live number (may be
// undefined/0 before data arrives); `seed` is the baked-in fallback so the card
// never renders blank on a cold first visit. The live value replaces the seed
// once it loads, and StatValue animates the difference.
const stat = (value, seed, label) => ({
  value: Number.isFinite(value) && value > 0 ? value : seed,
  label,
})

// Animates a number from its previously-shown value to `target` (easeOutCubic).
// First render shows `target` instantly with no animation, so a persisted/cached
// number appears immediately; only later changes (seed -> live) animate. Honors
// prefers-reduced-motion by snapping straight to the value.
function useCountUp(target, duration = 700) {
  const [display, setDisplay] = useState(target)
  const fromRef = useRef(target)

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    const from = fromRef.current
    if (reduced || from === target) {
      fromRef.current = target
      setDisplay(target)
      return undefined
    }

    let raf = 0
    const start = performance.now()
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(from + (target - from) * eased))
      if (t < 1) {
        raf = requestAnimationFrame(step)
      } else {
        fromRef.current = target
      }
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return display
}

function StatValue({ value }) {
  const display = useCountUp(value)
  return <span className={styles.statVal}>{display.toLocaleString()}</span>
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
          {stats.map(({ value, label }) => (
            <div key={label}>
              <StatValue value={value} />
              <span className={styles.statLabel}>{label}</span>
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
        stat: stat(comps.length, LANDING_SEED.topComps, t('landing.statTopComps')),
      }
    }

    if (destination.key === 'builder') {
      return {
        ...base,
        stat: stat(champions?.length, LANDING_SEED.units, t('landing.statUnits')),
      }
    }

    if (destination.key === 'stats') {
      return {
        ...base,
        stat: stat(statsData?.matchCount, LANDING_SEED.patchGames, t('landing.statPatchGames')),
      }
    }

    if (destination.key === 'leaderboard') {
      return {
        ...base,
        stat: stat(leaderboardData?.entries?.length, LANDING_SEED.rankedPlayers, t('landing.statRankedPlayers')),
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
        {/* Reveal sequence on load: bookmark strip (0ms), then card rows
            (50ms / 100ms) — see fadeIn usage in LandingPage.module.css. */}
        <div className={styles.bookmarkReveal}>
          <BookmarkStrip activeRegion={region} />
        </div>
        <DestinationGrid />
      </div>
    </div>
  )
}
