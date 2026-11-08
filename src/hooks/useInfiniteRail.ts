import { useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import {
  RAIL_RESUME_DELAY_MS,
  RAIL_STEP_DURATION_MS,
  RAIL_STEP_INTERVAL_MS,
  RAIL_STEP_QUERY,
} from '../constants/site'

interface RailOptions {
  /** Drift speed in px/second (drift mode). */
  speed: number
  /** 1 = content moves left, -1 = content moves right. */
  direction: 1 | -1
  /** Step mode: delay the first step (ms) so rows don't move in sync. */
  phase?: number
}

interface Tween {
  from: number
  to: number
  start: number
  duration: number
  ease: (t: number) => number
}

/** Movement (px) after which a press counts as a drag instead of a click. */
const DRAG_THRESHOLD = 6
/** Drift mode: how quickly it eases to a stop / back to speed (higher = snappier). */
const DRIFT_EASING = 3
/** Step mode: fraction of a card a swipe must travel to change card. */
const SWIPE_FRACTION = 0.12
const SNAP_DURATION_MS = 420

/** Apple-like ease-out (fast start, soft landing) — for swipe snaps. */
const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t))
/** Gentle start and finish — for the slow automatic steps. */
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

/**
 * Endless horizontal rail with two modes:
 * - Drift (desktop): moves continuously, glides to a stop while hovered,
 *   draggable and trackpad-scrollable.
 * - Step (phones, RAIL_STEP_QUERY): the cards that fit are centered; every few
 *   seconds it slides along by one card. Swipes snap to
 *   the next/previous card.
 *
 * The item set is rendered `copies` times and the position wraps at one
 * set's width, so the loop is seamless at any screen size.
 */
export function useInfiniteRail({ speed, direction, phase = 0 }: RailOptions) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const [copies, setCopies] = useState(3)
  const s = useRef({
    /** Unbounded position in px; wrapped only when rendering. */
    offset: 0,
    velocity: 0,
    setWidth: 0,
    step: 0,
    cardWidth: 0,
    viewportWidth: 0,
    stepMode: false,
    tween: null as Tween | null,
    nextStepAt: 0,
    hovered: false,
    dragging: false,
    dragged: false,
    dragStartX: 0,
    dragStartOffset: 0,
    resumeAt: 0,
  })

  const apply = useCallback(() => {
    const st = s.current
    const track = trackRef.current
    if (!track || !st.setWidth) return
    const w = st.setWidth
    const wrapped = ((st.offset % w) + w) % w
    // Step mode centers the cards that fully fit; drift mode aligns to the left edge.
    let shift = 0
    if (st.stepMode && st.step) {
      const gap = st.step - st.cardWidth
      const visible = Math.max(1, Math.floor((st.viewportWidth + gap) / st.step))
      shift = (st.viewportWidth - (visible * st.step - gap)) / 2
    }
    // One extra set on the left so there is never a gap before the first card.
    track.style.transform = `translate3d(${shift - wrapped - w}px, 0, 0)`
  }, [])

  const tweenTo = useCallback((to: number, duration: number, ease = easeOutExpo) => {
    const st = s.current
    st.tween = { from: st.offset, to, start: performance.now(), duration, ease }
  }, [])

  // Measure one item set; render enough copies to always cover the viewport.
  useEffect(() => {
    const viewport = viewportRef.current
    const firstSet = trackRef.current?.firstElementChild as HTMLElement | null
    if (!viewport || !firstSet) return
    const ro = new ResizeObserver(() => {
      const width = firstSet.getBoundingClientRect().width
      const firstCard = firstSet.firstElementChild as HTMLElement | null
      if (!width || !firstCard) return
      const st = s.current
      st.setWidth = width
      st.step = width / firstSet.children.length
      st.cardWidth = firstCard.offsetWidth
      st.viewportWidth = viewport.clientWidth
      setCopies(Math.max(3, Math.ceil(viewport.clientWidth / width) + 2))
      apply()
    })
    ro.observe(viewport)
    ro.observe(firstSet)
    return () => ro.disconnect()
  }, [apply])

  // Animation loop.
  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const stepQuery = window.matchMedia(RAIL_STEP_QUERY)
    let raf = 0
    let last = performance.now()
    let inViewport = false
    let pageVisible = !document.hidden

    const schedule = () => {
      if (!raf && inViewport && pageVisible) {
        last = performance.now()
        raf = requestAnimationFrame(tick)
      }
    }

    const stop = () => {
      if (!raf) return
      cancelAnimationFrame(raf)
      raf = 0
    }

    const tick = (now: number) => {
      raf = 0
      if (!inViewport || !pageVisible) return

      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const st = s.current

      // Switch modes when the screen crosses the breakpoint.
      if (stepQuery.matches !== st.stepMode) {
        st.stepMode = stepQuery.matches
        st.tween = null
        st.velocity = 0
        if (st.stepMode && st.step) st.offset = Math.round(st.offset / st.step) * st.step
        st.nextStepAt = now + RAIL_STEP_INTERVAL_MS + phase
      }

      if (!st.dragging) {
        if (st.stepMode) {
          if (st.tween) {
            const t = Math.min(1, (now - st.tween.start) / st.tween.duration)
            st.offset = st.tween.from + (st.tween.to - st.tween.from) * st.tween.ease(t)
            if (t >= 1) st.tween = null
          } else if (!reducedMotion.matches && st.step && now >= st.nextStepAt) {
            const index = Math.round(st.offset / st.step)
            tweenTo((index + direction) * st.step, RAIL_STEP_DURATION_MS, easeInOutCubic)
            // Card stays fully still for the interval *after* the move finishes.
            st.nextStepAt = now + RAIL_STEP_DURATION_MS + RAIL_STEP_INTERVAL_MS
          }
        } else {
          const paused = st.hovered || now < st.resumeAt || reducedMotion.matches
          const target = paused ? 0 : speed * direction
          st.velocity += (target - st.velocity) * (1 - Math.exp(-dt * DRIFT_EASING))
          st.offset += st.velocity * dt
        }
        apply()
      }
      schedule()
    }

    const observer = typeof IntersectionObserver === 'undefined'
      ? null
      : new IntersectionObserver(([entry]) => {
          inViewport = entry.isIntersecting
          if (inViewport) schedule()
          else stop()
        })
    if (observer) {
      observer.observe(viewport)
    } else {
      inViewport = true
      schedule()
    }

    const onVisibilityChange = () => {
      pageVisible = !document.hidden
      if (pageVisible) schedule()
      else stop()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      observer?.disconnect()
      document.removeEventListener('visibilitychange', onVisibilityChange)
      stop()
    }
  }, [speed, direction, phase, apply, tweenTo])

  // Horizontal trackpad / shift+wheel scrolling in drift mode
  // (vertical wheel still scrolls the page).
  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const onWheel = (e: WheelEvent) => {
      const st = s.current
      if (st.stepMode || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return
      e.preventDefault()
      st.offset += e.deltaX
      st.velocity = 0
      st.resumeAt = performance.now() + RAIL_RESUME_DELAY_MS
      apply()
    }
    viewport.addEventListener('wheel', onWheel, { passive: false })
    return () => viewport.removeEventListener('wheel', onWheel)
  }, [apply])

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return
      const st = s.current
      st.dragging = true
      st.dragged = false
      st.tween = null
      st.velocity = 0
      st.dragStartX = e.clientX
      st.dragStartOffset = st.offset

      const move = (ev: globalThis.PointerEvent) => {
        const dx = ev.clientX - st.dragStartX
        if (Math.abs(dx) > DRAG_THRESHOLD) st.dragged = true
        st.offset = st.dragStartOffset - dx
        apply()
      }
      const end = () => {
        st.dragging = false
        const now = performance.now()
        if (st.stepMode && st.step) {
          // Snap: a short swipe still moves one card in the swipe direction.
          const delta = st.offset - st.dragStartOffset
          const startIndex = Math.round(st.dragStartOffset / st.step)
          let target = Math.round(st.offset / st.step)
          if (target === startIndex && Math.abs(delta) > st.step * SWIPE_FRACTION) target += Math.sign(delta)
          tweenTo(target * st.step, SNAP_DURATION_MS)
          st.nextStepAt = now + RAIL_STEP_INTERVAL_MS + RAIL_RESUME_DELAY_MS
        } else {
          st.resumeAt = now + RAIL_RESUME_DELAY_MS
        }
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', end)
        window.removeEventListener('pointercancel', end)
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', end)
      window.addEventListener('pointercancel', end)
    },
    [apply, tweenTo],
  )

  /** A drag must not also open the product under the pointer. */
  const onClickCapture = useCallback((e: MouseEvent) => {
    if (!s.current.dragged) return
    e.preventDefault()
    e.stopPropagation()
    s.current.dragged = false
  }, [])

  const onPointerEnter = useCallback((e: PointerEvent) => {
    if (e.pointerType === 'mouse') s.current.hovered = true
  }, [])

  const onPointerLeave = useCallback(() => {
    s.current.hovered = false
  }, [])

  return {
    viewportRef,
    trackRef,
    copies,
    viewportProps: { onPointerDown, onPointerEnter, onPointerLeave, onClickCapture },
  }
}
