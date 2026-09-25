import styles from './StatIcon.module.css'
import adIcon from '../assets/icons/AD_icon.png'
import apIcon from '../assets/icons/AP_icon.png'
import asIcon from '../assets/icons/AS_icon.png'
import armorIcon from '../assets/icons/Armor_icon.png'
import hpIcon from '../assets/icons/HP_icon.png'
import mrIcon from '../assets/icons/MR_icon.png'
import durabilityIcon from '../assets/icons/Durability_icon.png'
import manaIcon from '../assets/icons/Mana_icon.png'
import rangeIcon from '../assets/icons/Range_icon.png'

const PNG_ICONS = {
  ad: adIcon,
  ap: apIcon,
  as: asIcon,
  armor: armorIcon,
  hp: hpIcon,
  mr: mrIcon,
  durability: durabilityIcon,
  mana: manaIcon,
  range: rangeIcon,
  amp: 'https://raw.communitydragon.org/latest/game/assets/ux/traiticons/trait_icon_14_amp.tft_set14.png',
}

export default function StatIcon({ type, size = 13 }) {
  const src = PNG_ICONS[type]
  if (!src) return null
  // rem (not px) so the icon follows the Interface Size setting.
  const dim = `${size / 16}rem`
  return (
    <img
      className={styles.icon}
      src={src}
      style={{ width: dim, height: dim }}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  )
}
