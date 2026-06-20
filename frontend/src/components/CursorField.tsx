import { useEffect, useRef } from 'react'

export function CursorField() {
  const cursorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const cursor = cursorRef.current
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (!cursor || coarsePointer || reducedMotion) return undefined

    const move = (event: PointerEvent) => {
      cursor.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`
      cursor.dataset.visible = 'true'
    }
    const leave = () => {
      cursor.dataset.visible = 'false'
    }
    const over = (event: PointerEvent) => {
      const target = event.target as HTMLElement
      cursor.dataset.active = String(Boolean(target.closest('a, button, input, [data-cursor]')))
    }

    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerover', over, { passive: true })
    document.documentElement.addEventListener('mouseleave', leave)

    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerover', over)
      document.documentElement.removeEventListener('mouseleave', leave)
    }
  }, [])

  return <div ref={cursorRef} className="cursor-field" aria-hidden="true" />
}
