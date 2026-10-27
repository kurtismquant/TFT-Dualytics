import { useLayoutEffect, useState } from 'react'

// Tracks an element's content-box width in px via ResizeObserver; 0 until it's
// measured. Takes the element itself (keep it in state with a callback ref) so
// it re-subscribes when the element mounts later or is swapped.
export function useElementWidth(element) {
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    if (!element) return undefined
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(element)
    return () => observer.disconnect()
  }, [element])

  return width
}
