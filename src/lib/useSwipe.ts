import { useRef } from 'react'

/**
 * Horizontal swipe detection for touch screens. Ignores gestures that start inside
 * `[data-no-swipe]` (bottom sheets), on inputs (sliders), or that are mostly vertical (scrolling).
 */
export function useSwipe(onSwipeLeft: () => void, onSwipeRight: () => void, threshold = 60) {
  const start = useRef<{ x: number; y: number } | null>(null)

  return {
    onTouchStart(e: React.TouchEvent) {
      const t = e.target as HTMLElement
      if (e.touches.length !== 1 || t.closest('[data-no-swipe], input, select, textarea, .recharts-wrapper')) {
        start.current = null
        return
      }
      start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    },
    onTouchEnd(e: React.TouchEvent) {
      if (!start.current) return
      const dx = e.changedTouches[0].clientX - start.current.x
      const dy = e.changedTouches[0].clientY - start.current.y
      start.current = null
      if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.5) return
      if (dx < 0) onSwipeLeft()
      else onSwipeRight()
    },
  }
}
