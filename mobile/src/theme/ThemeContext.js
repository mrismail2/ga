/* Theme provider — LIGHT ONLY. Dark mode has been removed: the whole app
   always renders the white/light palette. The context keeps the same shape
   (c / isDark / toggle) so existing consumers don't break. */
import React, { createContext, useContext } from 'react';
import { light } from './colors';

const ThemeContext = createContext({ c: light, isDark: false, toggle: () => {} });

export function ThemeProvider({ children }) {
  const value = { c: light, isDark: false, toggle: () => {} };
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
