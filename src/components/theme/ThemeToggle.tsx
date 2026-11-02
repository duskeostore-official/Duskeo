import { useTheme } from '../../theme/useTheme'
import { MoonIcon, SunIcon } from '../common/Icons'

/** One-click light/dark switch in the header (controlled by SHOW_THEME_TOGGLE). */
export function ThemeToggle() {
  const { themeName, toggleTheme } = useTheme()
  const isDark = themeName === 'dark'
  const label = isDark ? 'Switch to light theme' : 'Switch to dark theme'

  return (
    <button className="header-icon theme-toggle" onClick={toggleTheme} aria-label={label} title={label}>
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}
