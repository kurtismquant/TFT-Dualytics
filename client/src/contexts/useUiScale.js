import { UI_SCALES } from '../constants/uiScale.js'
import { useSettings } from './useSettings.js'

// Numeric Interface Size factor (1 = compact) for pixel values computed in JS.
export function useUiScale() {
  return UI_SCALES[useSettings().uiScale]
}
