import { createContext } from 'react'
import type { ThemeName, ThemePalette } from '../constants/theme'

export interface ThemeContextValue {
  themeName: ThemeName
  palette: ThemePalette
  setTheme: (name: ThemeName) => void
  /** Cycles to the next theme in THEMES — wire this to any button. */
  toggleTheme: () => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)
