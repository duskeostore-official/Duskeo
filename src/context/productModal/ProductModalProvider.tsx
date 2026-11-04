import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { MODAL_CLOSE_MS } from '../../constants/site'
import type { Product } from '../../types'
import { useCatalog } from '../catalog/useCatalog'
import { ProductModalContext, type ModalTransition } from './productModalContext'

/** History-state key holding how many popup items are open at that entry. */
const DEPTH_KEY = 'duskeoModalDepth'

const depthOf = (state: unknown) => (state as Record<string, number> | null)?.[DEPTH_KEY] ?? 0

/**
 * Product popup stack, kept in sync with browser history: each opened item
 * adds a history entry, so the browser / phone back gesture steps back
 * through the stack exactly like the popup's own BACK button.
 */
export function ProductModalProvider({ children }: { children: ReactNode }) {
  const catalog = useCatalog()
  const [stack, setStack] = useState<string[]>([])
  const [transition, setTransition] = useState<ModalTransition>('open')
  const [closing, setClosing] = useState(false)
  const stackRef = useRef<string[]>([])
  const closeTimer = useRef<number | undefined>(undefined)

  const commit = useCallback((next: string[]) => {
    stackRef.current = next
    setStack(next)
  }, [])

  // Browser back/forward (and our own back/close, which go through history).
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const current = stackRef.current
      const depth = depthOf(e.state)
      if (!current.length || depth >= current.length) return
      if (depth === 0) {
        stackRef.current = []
        setClosing(true)
        closeTimer.current = window.setTimeout(() => {
          setStack([])
          setClosing(false)
        }, MODAL_CLOSE_MS)
      } else {
        setTransition('pop')
        commit(current.slice(0, depth))
      }
    }
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      window.clearTimeout(closeTimer.current)
    }
  }, [commit])

  const open = useCallback(
    (slug: string) => {
      window.clearTimeout(closeTimer.current)
      setClosing(false)
      history.pushState({ [DEPTH_KEY]: 1 }, '')
      setTransition('open')
      commit([slug])
    },
    [commit],
  )

  const push = useCallback(
    (slug: string) => {
      const next = [...stackRef.current, slug]
      history.pushState({ [DEPTH_KEY]: next.length }, '')
      setTransition('push')
      commit(next)
    },
    [commit],
  )

  const back = useCallback(() => {
    if (stackRef.current.length) history.back()
  }, [])

  const close = useCallback(() => {
    const depth = stackRef.current.length
    if (depth) history.go(-depth)
  }, [])

  const value = useMemo(
    () => ({
      stack: stack.map(catalog.findProduct).filter((p): p is Product => !!p),
      transition,
      closing,
      open,
      push,
      back,
      close,
    }),
    [stack, transition, closing, open, push, back, close, catalog.findProduct],
  )

  return <ProductModalContext.Provider value={value}>{children}</ProductModalContext.Provider>
}
