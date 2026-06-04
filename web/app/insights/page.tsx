"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, type Subject } from "@/lib/api";
import { GlassCard } from "@/components/ui/GlassCard";
import { Tag } from "@/components/ui/Tag";

function InsightsInner() {
  const params = useSearchParams();
  const branch = params.get("branch") ?? undefined;
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let active = true;
    setSubjects(null);
    setErr(false);
    api.subjects(branch)
      .then((v) => { if (active) setSubjects(v); })
      .catch(() => { if (active) setErr(true); });
    return () => { active = false; };
  }, [branch]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-muted">Insights</p>
          <h1 className="mt-2 font-display text-5xl">
            {branch ? `${branch} subjects` : "All subjects"}
          </h1>
        </div>
        <div className="flex gap-2">
          {["CSE", "IT", "EC", "ME"].map((b) => (
            <Link
              key={b}
              href={`/insights?branch=${b}`}
              className={`rounded-full border px-3 py-1 text-xs transition-all ${
                branch === b
                  ? "border-violet/60 bg-violet/20 text-text"
                  : "border-border bg-surface/40 text-muted hover:border-violet/40"
              }`}
            >
              {b}
            </Link>
          ))}
          <Link
            href="/insights"
            className={`rounded-full border px-3 py-1 text-xs transition-all ${
              !branch ? "border-cyan/60 bg-cyan/20 text-text" : "border-border bg-surface/40 text-muted hover:border-cyan/40"
            }`}
          >
            All
          </Link>
        </div>
      </header>

      {err && (
        <GlassCard className="mt-12 border-rose/40 p-6 text-rose">
          Backend unreachable. Start the API: <code className="font-mono">uvicorn src.app:app --port 8000</code>
        </GlassCard>
      )}

      {!subjects && !err && (
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <GlassCard key={i} className="h-36 animate-pulse p-6" />
          ))}
        </div>
      )}

      {subjects && (
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {subjects.map((s) => (
            <Link key={`${s.subject_code}-${s.branch}`} href={`/insights/${s.subject_code}`}>
              <GlassCard interactive className="p-6">
                <div className="flex items-center justify-between">
                  <Tag variant="violet">{s.branch}</Tag>
                  <Tag variant="mono">Sem {s.semester}</Tag>
                </div>
                <p className="mt-4 font-display text-xl text-text">{s.subject_name}</p>
                <p className="mt-1 font-mono text-xs text-cyan">{s.subject_code}</p>
                <p className="mt-4 text-sm text-muted">
                  {s.questions} questions · {s.papers} papers
                </p>
              </GlassCard>
            </Link>
          ))}
          {subjects.length === 0 && (
            <p className="col-span-3 text-muted">No subjects yet — loader still ingesting.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function InsightsPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-6 py-16 text-muted">Loading…</div>}>
      <InsightsInner />
    </Suspense>
  );
}
