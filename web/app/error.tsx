"use client";

import { GradientButton } from "@/components/ui/GradientButton";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-6 text-center">
      <p className="font-mono text-xs uppercase tracking-wide text-rose">Something broke</p>
      <h1 className="mt-4 font-display text-5xl">
        <span className="bg-accent-gradient bg-clip-text text-transparent">An unexpected error</span>
      </h1>
      <p className="mt-4 text-muted">Refresh the page, or try again.</p>
      <div className="mt-8 flex gap-3">
        <GradientButton onClick={() => reset()}>Try again</GradientButton>
        <GradientButton href="/" variant="ghost">Go home</GradientButton>
      </div>
    </div>
  );
}
