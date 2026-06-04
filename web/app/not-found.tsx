import Link from "next/link";
import { GradientButton } from "@/components/ui/GradientButton";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-6 text-center">
      <p className="font-mono text-xs uppercase tracking-wide text-muted">404</p>
      <h1 className="mt-4 font-display text-6xl">
        <span className="bg-accent-gradient bg-clip-text text-transparent">Lost in the syllabus</span>
      </h1>
      <p className="mt-4 text-muted">That page does not exist. Try a search instead.</p>
      <div className="mt-8 flex gap-3">
        <GradientButton href="/">Home</GradientButton>
        <GradientButton href="/search" variant="ghost">Search</GradientButton>
      </div>
    </div>
  );
}
