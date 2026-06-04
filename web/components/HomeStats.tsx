"use client";

import { useEffect, useState } from "react";
import { api, type Branch, type Stats, type Subject } from "@/lib/api";
import { GlassCard } from "@/components/ui/GlassCard";
import { AnimatedCount } from "@/components/AnimatedCount";
import Link from "next/link";

const TILE_KEYS: { key: keyof Pick<Stats, "subjects" | "papers" | "questions">; label: string; tint: string }[] = [
  { key: "subjects", label: "Subjects", tint: "text-violet" },
  { key: "papers", label: "Papers ingested", tint: "text-cyan" },
  { key: "questions", label: "Questions indexed", tint: "text-rose" },
];

export function HomeStats() {
  const [s, setS] = useState<Stats | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      api.stats().then((v) => { if (active) setS(v); }),
      api.branches().then((v) => { if (active) setBranches(v); }),
      api.subjects().then((v) => { if (active) setSubjects(v); }),
    ]).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const yearRange = s?.year_from && s?.year_to ? `${s.year_from}–${s.year_to}` : "—";
  const topSubjects = [...subjects].sort((a, b) => b.questions - a.questions).slice(0, 9);

  return (
    <>
      <section className="mt-24 grid gap-6 sm:grid-cols-2 md:grid-cols-4">
        {TILE_KEYS.map((t) => (
          <GlassCard key={t.key} className="p-6">
            <p className="font-mono text-xs uppercase tracking-wide text-muted">{t.label}</p>
            <p className={`mt-2 font-display text-5xl ${t.tint}`}>
              <AnimatedCount value={s?.[t.key] ?? 0} />
            </p>
          </GlassCard>
        ))}
        <GlassCard className="p-6">
          <p className="font-mono text-xs uppercase tracking-wide text-muted">Years covered</p>
          <p className="mt-2 font-display text-4xl text-text">{yearRange}</p>
        </GlassCard>
      </section>

      <section className="mt-20">
        <h2 className="font-display text-4xl">By branch</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 md:grid-cols-4">
          {(branches.length ? branches : [{ branch: "CSE", subjects: 0, papers: 0, questions: 0 }, { branch: "IT", subjects: 0, papers: 0, questions: 0 }, { branch: "EC", subjects: 0, papers: 0, questions: 0 }, { branch: "ME", subjects: 0, papers: 0, questions: 0 }]).map((b) => (
            <Link key={b.branch} href={`/insights?branch=${b.branch}`}>
              <GlassCard interactive className="p-6">
                <p className="font-mono text-xs uppercase tracking-wide text-muted">Branch</p>
                <p className="mt-2 font-display text-4xl">{b.branch}</p>
                <p className="mt-3 text-sm text-muted">
                  {b.subjects} subjects · {b.papers} papers
                </p>
                <p className="mt-1 text-sm text-cyan">
                  <AnimatedCount value={b.questions} /> questions →
                </p>
              </GlassCard>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-20">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-4xl">Top subjects</h2>
          <Link href="/insights" className="text-sm text-cyan hover:underline">
            View all →
          </Link>
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {topSubjects.map((sj) => (
            <Link key={sj.subject_code} href={`/insights/${sj.subject_code}`}>
              <GlassCard interactive className="p-6">
                <p className="font-mono text-xs text-muted">{sj.branch} · Sem {sj.semester}</p>
                <p className="mt-2 font-display text-2xl text-text">{sj.subject_name}</p>
                <p className="mt-2 font-mono text-xs text-cyan">{sj.subject_code}</p>
                <p className="mt-4 text-sm text-muted">{sj.questions} questions · {sj.papers} papers</p>
              </GlassCard>
            </Link>
          ))}
          {!topSubjects.length && (
            <p className="col-span-3 text-muted">Loader still ingesting — counts refresh once data lands.</p>
          )}
        </div>
      </section>
    </>
  );
}
