import { useEffect, useRef, useState } from 'react'

export function useInViewReveal(threshold = 0.12, once = false) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)
  const [exitDirection, setExitDirection] = useState<'up' | 'down'>('down')

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true)
            if (once) observer.disconnect()
          } else if (!once) {
            setVisible(false)
            setExitDirection(entry.boundingClientRect.top < 0 ? 'up' : 'down')
          }
        }
      },
      { threshold, rootMargin: '-20px 0px -20px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold, once])

  return { ref, visible, exitDirection }
}

export function useCountUp(target: number, durationMs = 850, decimals = 0) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    let rafId = 0
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - progress, 3)
      const next = target * eased
      setValue(decimals > 0 ? Number(next.toFixed(decimals)) : Math.round(next))
      if (progress < 1) {
        rafId = requestAnimationFrame(tick)
      }
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [target, durationMs, decimals])

  return value
}
