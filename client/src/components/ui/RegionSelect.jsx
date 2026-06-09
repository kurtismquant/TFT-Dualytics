import { REGIONS } from '../../utils/riotSearch.js'

/**
 * Region `<select>` shared by every summoner search surface (page, nav, hero,
 * bookmark modal). Owns the single source of truth for the region option list;
 * callers pass their own `className` so each placement keeps its intended chrome.
 */
export default function RegionSelect({ value, onChange, className, ...rest }) {
  return (
    <select className={className} value={value} onChange={onChange} {...rest}>
      {REGIONS.map(r => (
        <option key={r} value={r}>{r.toUpperCase()}</option>
      ))}
    </select>
  )
}
