import { useEffect, useRef, useState } from 'react'

/**
 * Reads a numeric CSS custom property (e.g. `--cols`) from an element and
 * keeps it updated as the element resizes, so JS layout logic can follow
 * the breakpoints defined in CSS.
 */
export function useCssNumber<T extends HTMLElement>(property: string, fallback: number) {
  const ref = useRef<T>(null)
  const [value, setValue] = useState(fallback)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const n = parseFloat(getComputedStyle(el).getPropertyValue(property))
      if (Number.isFinite(n)) setValue(n)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [property])

  return { ref, value }
}
