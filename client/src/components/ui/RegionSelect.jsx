import { REGIONS } from '../../utils/riotSearch.js'

/**
 * Region `<select>` shared by every summoner search surface (page, nav, hero,
 * bookmark modal). Owns the single source of truth for the region option list;
 * callers pass their own `className` so each placement keeps its intended chrome.
 */
export default function RegionSelect({ value, onChange, className, ...rest }) {
  // Native <select> keeps focus after a pick, which leaves any :focus-driven caret
  // stuck pointing up. Blur on change so the dropdown chrome resets immediately.
  const handleChange = e => {
    onChange?.(e)
    e.currentTarget.blur()
  }

  return (
    <select className={className} value={value} onChange={handleChange} {...rest}>
      {REGIONS.map(r => (
        <option key={r} value={r}>{r.toUpperCase()}</option>
      ))}
    </select>
  )
}
