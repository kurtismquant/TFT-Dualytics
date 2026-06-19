import { useEffect, useState } from 'react'

// Subscribes to a CSS media query and re-renders when it changes.
// SSR/no-window safe (returns false until mounted).
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia(query).matches
      : false,
  )

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}

// Mobile breakpoint — keep in sync with --bp-md in src/styles/breakpoints.css.
export function useIsMobile() {
  return useMediaQuery('(max-width: 720px)')
}

// Tablet-and-below — keep in sync with --bp-lg.
export function useIsTabletDown() {
  return useMediaQuery('(max-width: 1024px)')
}
