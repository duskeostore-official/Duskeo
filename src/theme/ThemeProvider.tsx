import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { CSS_VAR_PREFIX, DEFAULT_THEME, FONT_FAMILY, THEMES, type ThemeName } from '../constants/theme'
import { STORAGE_KEYS } from '../constants/storage'
import { camelToKebab } from '../utils/format'
import { readString, writeString } from '../utils/storage'
import { ThemeContext } from './themeContext'

const themeNames = Object.keys(THEMES) as ThemeName[]

const initialTheme = (): ThemeName => {
  const saved = readString(STORAGE_KEYS.theme)
  return saved && saved in THEMES ? (saved as ThemeName) : DEFAULT_THEME
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeName, setThemeName] = useState<ThemeName>(initialTheme)
  const palette = THEMES[themeName]

  // Push the palette onto <html> as CSS variables; every stylesheet reads them.
  useEffect(() => {
    const root = document.documentElement
    Object.entries(palette).forEach(([key, value]) => {
      root.style.setProperty(CSS_VAR_PREFIX + camelToKebab(key), value)
    })
    root.style.setProperty('--font-family', FONT_FAMILY)
    root.dataset.theme = themeName
    root.style.colorScheme = themeName === 'light' ? 'light' : 'dark'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', palette.bg)
    writeString(STORAGE_KEYS.theme, themeName)
  }, [palette, themeName])

  const toggleTheme = useCallback(() => {
    setThemeName((current) => themeNames[(themeNames.indexOf(current) + 1) % themeNames.length])
  }, [])

  const value = useMemo(
    () => ({ themeName, palette, setTheme: setThemeName, toggleTheme }),
    [themeName, palette, toggleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
