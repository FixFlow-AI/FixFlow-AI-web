import { useMemo } from 'react'
import useThemeStore from '@/stores/themeStore'

const PALETTES = {
  light: {
    primary: '#7c3aed',
    secondary: '#2563eb',
    accent: '#14b8a6',
    muted: '#64748b',
    line: '#6d5dfc',
    wire: '#6d5dfc',
    particle: '#8b5cf6',
    coreOpacity: 0.28,
    focusOpacity: 0.20,
    secondaryOpacity: 0.18,
    lineOpacity: 0.22,
    particleOpacity: 0.34,
    canvasOpacity: 0.72,
    overlayFrom: 'from-background/70',
    overlayVia: 'via-background/35',
    overlayTo: 'to-background/86',
  },
  'modern-dark': {
    primary: '#3fd7ff',
    secondary: '#26d07c',
    accent: '#eef7fb',
    muted: '#8ea5b5',
    line: '#6fc4dc',
    wire: '#d7f6ff',
    particle: '#d7f6ff',
    coreOpacity: 0.52,
    focusOpacity: 0.30,
    secondaryOpacity: 0.36,
    lineOpacity: 0.38,
    particleOpacity: 0.54,
    canvasOpacity: 0.92,
    overlayFrom: 'from-background/58',
    overlayVia: 'via-background/22',
    overlayTo: 'to-background/76',
  },
  'vscode-dark': {
    primary: '#4fc3ff',
    secondary: '#89d185',
    accent: '#cccccc',
    muted: '#9cdcfe',
    line: '#73c9ff',
    wire: '#dcdcaa',
    particle: '#dcdcaa',
    coreOpacity: 0.56,
    focusOpacity: 0.34,
    secondaryOpacity: 0.34,
    lineOpacity: 0.40,
    particleOpacity: 0.52,
    canvasOpacity: 0.9,
    overlayFrom: 'from-background/56',
    overlayVia: 'via-background/20',
    overlayTo: 'to-background/78',
  },
}

export function getTheme3DPalette(theme = 'modern-dark') {
  return PALETTES[theme] || PALETTES['modern-dark']
}

export default function useTheme3DPalette() {
  const theme = useThemeStore((state) => state.theme)
  return useMemo(() => getTheme3DPalette(theme), [theme])
}
