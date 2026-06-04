import Link from "next/link";
import { HeroScene } from "@/components/three/HeroScene";
import { GradientButton } from "@/components/ui/GradientButton";
import { StatusPill } from "@/components/StatusPill";
import { HomeStats } from "@/components/HomeStats";

const POPULAR_TOPICS = [
  "BCNF", "transaction", "deadlock", "regular expression", "TCP", "OSI",
  "compiler", "operating system", "BFS", "DFS", "hashing", "encryption",
  "machine learning", "neural network", "cloud", "IoT", "agile", "SDLC",
  "fluid mechanics", "thermodynamics", "VLSI", "antenna", "control system",
  "blockchain", "data mining",
];

export default function Home() {
  return (
    <>
      <section className="relative min-h-[88vh] overflow-hidden">
        <HeroScene />
        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-6 py-24 md:grid-cols-[1.2fr_1fr]">
          <div>
            <StatusPill />
            <h1 className="mt-6 font-display leading-[0.95]" style={{ fontSize: "clamp(3rem, 7vw, 6.5rem)" }}>
              Every question
              <br />
              <span className="text-muted/70">RGPV ever asked.</span>
              <br />
              <span className="bg-accent-gradient bg-clip-text text-transparent">Searchable.</span>
            </h1>
            <p className="mt-8 max-w-xl text-lg text-muted">
              Eight years of B.Tech papers, parsed into individual questions.
              Filter by unit, marks, year. Spot what repeats.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <GradientButton href="/search">Search questions</GradientButton>
              <GradientButton href="/insights" variant="ghost">Browse insights</GradientButton>
            </div>
            <div className="mt-8 flex flex-wrap gap-2">
              {["BCNF", "transaction", "TCP", "compiler", "neural network"].map((t) => (
                <Link
                  key={t}
                  href={`/search?q=${encodeURIComponent(t)}`}
                  className="rounded-full border border-border bg-surface/50 px-3 py-1 text-xs text-muted hover:border-cyan/40 hover:text-cyan"
                >
                  Try “{t}”
                </Link>
              ))}
            </div>
          </div>
          <div className="hidden md:block" aria-hidden />
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 pb-24">
        <HomeStats />

        <section className="mt-20">
          <h2 className="font-display text-4xl">Popular topics</h2>
          <div className="mt-6 flex flex-wrap gap-2">
            {POPULAR_TOPICS.map((t) => (
              <Link
                key={t}
                href={`/search?q=${encodeURIComponent(t)}`}
                className="rounded-full border border-border bg-surface/50 px-4 py-1.5 text-sm text-muted transition-all hover:border-violet/40 hover:text-violet"
              >
                {t}
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-24 overflow-hidden rounded-2xl border border-border bg-surface/40 p-12 text-center">
          <h2 className="font-display text-5xl">
            Stop guessing.{" "}
            <span className="bg-accent-gradient bg-clip-text text-transparent">Start searching.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted">
            Built at Patel College of Science & Technology, Indore — for the next batch of students.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <GradientButton href="/search">Open search</GradientButton>
          </div>
        </section>
      </div>
    </>
  );
}
