import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '../ui/Button.jsx'
import styles from './BronzeComps.module.css'

// Sits under the list: reveals the next page when scrolled near (and on click,
// for keyboard users). The observer is rebuilt per page, so if it is still in
// view after a page lands, it fires again.
export default function LoadMore({ onMore, shown }) {
  const { t } = useTranslation()
  const ref = useRef(null)
  useEffect(() => {
    const node = ref.current
    if (!node || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) onMore()
    }, { rootMargin: '0px 0px 300px 0px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [onMore, shown])

  return (
    <div ref={ref} className={styles.loadMore}>
      <Button variant="ghost" onClick={onMore}>{t('bronze.loadMore')}</Button>
    </div>
  )
}
