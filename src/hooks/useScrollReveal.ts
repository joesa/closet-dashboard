'use client'

import { useEffect, useRef, type RefObject } from 'react'

/**
 * Intersection Observer hook that adds `revealed` class when element scrolls
 * into view. Works with the `.reveal` / `.reveal.revealed` CSS in globals.css.
 *
 * Usage:
 *   const ref = useScrollReveal<HTMLElement>()
 *   <section ref={ref} className="reveal">...</section>
 *
 * For staggered children, set `--reveal-d` as a CSS variable on each child:
 *   <div className="reveal" style={{ '--reveal-d': 0 } as React.CSSProperties} />
 *   <div className="reveal" style={{ '--reveal-d': 1 } as React.CSSProperties} />
 */
export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(
  options?: IntersectionObserverInit,
): RefObject<T | null> {
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Respect user's motion preference
    const prefersReduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    if (prefersReduced) {
      el.classList.remove('reveal')
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed')
            observer.unobserve(entry.target)
          }
        })
      },
      {
        threshold: 0.15,
        rootMargin: '0px 0px -60px 0px',
        ...options,
      },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [options])

  return ref
}

/**
 * Observe multiple `.reveal` children within a container.
 * Applies staggered delays automatically.
 */
export function useScrollRevealChildren<T extends HTMLElement = HTMLDivElement>(
  selector = '.reveal',
  options?: IntersectionObserverInit,
): RefObject<T | null> {
  const ref = useRef<T>(null)

  useEffect(() => {
    const container = ref.current
    if (!container) return

    const prefersReduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches

    const children = container.querySelectorAll(selector)

    if (prefersReduced) {
      children.forEach((child) => child.classList.remove('reveal'))
      return
    }

    // Set stagger delay on each child
    children.forEach((child, i) => {
      ;(child as HTMLElement).style.setProperty('--reveal-d', String(i))
    })

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed')
            observer.unobserve(entry.target)
          }
        })
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -40px 0px',
        ...options,
      },
    )

    children.forEach((child) => observer.observe(child))
    return () => observer.disconnect()
  }, [selector, options])

  return ref
}
