import React from 'react'
import { useInViewReveal } from '../hooks/useMotion'

interface ScrollRevealProps {
  children: React.ReactNode
  className?: string
  delayMs?: number
  threshold?: number
}

export default function ScrollReveal({
  children,
  className = '',
  delayMs = 0,
  threshold = 0.1,
}: ScrollRevealProps) {
  const { ref, visible, exitDirection } = useInViewReveal(threshold, false)

  const hiddenClass =
    exitDirection === 'up'
      ? 'opacity-0 -translate-y-5'
      : 'opacity-0 translate-y-6'

  return (
    <div
      ref={ref}
      style={{ transitionDelay: visible ? `${delayMs}ms` : '0ms' }}
      className={`veripact-scroll-reveal transition-all duration-700 ease-out will-change-transform ${
        visible ? 'opacity-100 translate-y-0' : hiddenClass
      } ${className}`}
    >
      {children}
    </div>
  )
}

