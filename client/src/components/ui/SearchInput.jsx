import { forwardRef } from 'react'
import styles from './SearchInput.module.css'

const SearchInput = forwardRef(function SearchInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  hint,
  hintId,
  className,
  ...rest
}, ref) {
  return (
    <div className={[styles.wrap, hint ? styles.hasHint : null, className].filter(Boolean).join(' ')}>
      <input
        ref={ref}
        type={type}
        className={styles.input}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        {...rest}
      />
      {hint && <kbd id={hintId} className={styles.hint}>{hint}</kbd>}
    </div>
  )
})

export default SearchInput
