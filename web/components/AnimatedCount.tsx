"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

type Props = { value: number; durationSec?: number; className?: string };

export function AnimatedCount({ value, durationSec = 1.6, className = "" }: Props) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const obj = { n: 0 };
    const tween = gsap.to(obj, {
      n: value,
      duration: durationSec,
      ease: "power2.out",
      onUpdate: () => {
        if (ref.current) ref.current.textContent = Math.round(obj.n).toLocaleString();
      },
    });
    return () => {
      tween.kill();
    };
  }, [value, durationSec]);

  return <span ref={ref} className={className}>0</span>;
}
