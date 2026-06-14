"use client"

import { useEffect, useRef, useState } from "react"

/**
 * Scroll-reveal (E260). Returns a ref + `shown` flag; pair with the `.reveal`
 * class (`data-shown={shown}`). SSR-safe: starts hidden, reveals on intersect,
 * and falls back to shown immediately if IntersectionObserver is unavailable or
 * the user prefers reduced motion.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(options?: {
  threshold?: number
  once?: boolean
}) {
  const ref = useRef<T>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    if (reduce || typeof IntersectionObserver === "undefined") {
      // Client-only fallback — defer out of the effect body to avoid a
      // synchronous cascading render.
      queueMicrotask(() => setShown(true))
      return
    }

    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true)
            if (options?.once !== false) obs.disconnect()
          } else if (options?.once === false) {
            setShown(false)
          }
        }
      },
      { threshold: options?.threshold ?? 0.15 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [options?.threshold, options?.once])

  return { ref, shown }
}

/**
 * Count-up animation (E260). Animates 0 → `end` once the element is in view.
 * Returns a ref + the current display value. SSR-safe; renders `end` instantly
 * under reduced motion or without rAF.
 */
export function useCountUp<T extends HTMLElement = HTMLSpanElement>(
  end: number,
  opts?: { duration?: number; decimals?: number },
) {
  const ref = useRef<T>(null)
  const [value, setValue] = useState(0)
  const duration = opts?.duration ?? 1400

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    if (reduce || typeof IntersectionObserver === "undefined" || typeof requestAnimationFrame === "undefined") {
      queueMicrotask(() => setValue(end))
      return
    }

    let raf = 0
    let start = 0
    const ease = (t: number) => 1 - Math.pow(1 - t, 3)
    const step = (ts: number) => {
      if (!start) start = ts
      const p = Math.min(1, (ts - start) / duration)
      setValue(end * ease(p))
      if (p < 1) raf = requestAnimationFrame(step)
    }

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          raf = requestAnimationFrame(step)
          obs.disconnect()
        }
      },
      { threshold: 0.4 },
    )
    obs.observe(el)
    return () => {
      obs.disconnect()
      if (raf) cancelAnimationFrame(raf)
    }
  }, [end, duration])

  const display =
    opts?.decimals != null ? value.toFixed(opts.decimals) : Math.round(value).toString()
  return { ref, value, display }
}
