"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, type FrequencyRow, type QuestionRow, type Subject } from "@/lib/api";
import { GlassCard } from "@/components/ui/GlassCard";
import { GradientButton } from "@/components/ui/GradientButton";
import { Tag } from "@/components/ui/Tag";
import { AnimatedCount } from "@/components/AnimatedCount";

type Props = { params: Promise<{ subject: string }> };

export default function SubjectInsights({ params }: Props) {
  const { subject } = use(params);
  const router = useRouter();
  const [meta, setMeta] = useState<Subject | null>(null);
  const [terms, setTerms] = useState<FrequencyRow[] | null>(null);
  const [questions, setQuestions] = useState<QuestionRow[] | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      api.subjects().then((all) => {
        if (!active) return;
        const m = all.find((s) => s.subject_code === subject);
        setMeta(m ?? null);
      }),
      api.frequency(subject, 20).then((v) => { if (active) setTerms(v); }),
      api.search({ subject, limit: 10 }).then((v) => { if (active) setQuestions(v); }),
    ]).then((rs) => {
      if (active && rs.every((r) => r.status === "rejected")) setErr(true);
    });
    return () => { active = false; };
  }, [subject]);

  const chartData = useMemo(
    () => (terms ?? []).map((t) => ({ name: t.term, score: Number(t.score.toFixed(3)) })),
    [terms],
  );

  const palette = ["#7C5CFF", "#00D4FF", "#FF6B9D"];
  const quartileColor = (i: number, n: number) => {
    if (n === 0) return "#9CA3AF";
    if (i < n / 4) return "#FF6B9D";
    if (i < n / 2) return "#00D4FF";
    if (i < (3 * n) / 4) return "#7C5CFF";
    return "#9CA3AF";
  };

  const goSearch = (term: string) =>
    router.push(`/search?q=${encodeURIComponent(term)}&subject=${encodeURIComponent(subject)}`);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-muted">Insights</p>
          <h1 className="mt-2 font-display text-5xl">{meta?.subject_name ?? subject}</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <Tag variant="violet">{meta?.branch ?? "—"}</Tag>
            <Tag variant="mono">Sem {meta?.semester ?? "—"}</Tag>
            <Tag variant="cyan">{subject}</Tag>
          </div>
        </div>
        <div className="text-right">
          <p className="font-mono text-xs uppercase tracking-wide text-muted">Questions</p>
          <p className="mt-1 font-display text-5xl text-cyan">
            <AnimatedCount value={meta?.questions ?? 0} />
          </p>
        </div>
      </header>

      {err && (
        <GlassCard className="mt-12 border-rose/40 p-6 text-rose">
          Backend unreachable.
        </GlassCard>
      )}

      <GlassCard className="mt-12 p-6">
        <h2 className="font-display text-2xl">Top 20 terms (TF-IDF)</h2>
        <p className="mt-1 text-sm text-muted">Click a bar or chip to jump to filtered search.</p>
        <div className="mt-6 h-[460px] w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 12, right: 24, top: 8, bottom: 8 }}>
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#7C5CFF" />
                    <stop offset="100%" stopColor="#00D4FF" />
                  </linearGradient>
                </defs>
                <XAxis type="number" stroke="#9CA3AF" />
                <YAxis dataKey="name" type="category" stroke="#9CA3AF" width={160} tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ background: "#12121A", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, color: "#F5F5FA" }}
                  formatter={(value: unknown) => (typeof value === "number" ? value.toFixed(3) : String(value ?? ""))}
                />
                <Bar dataKey="score" fill="url(#barGrad)" radius={[0, 8, 8, 0]}>
                  {chartData.map((d, i) => (
                    <Cell
                      key={d.name}
                      fill={palette[i % palette.length]}
                      style={{ cursor: "pointer" }}
                      onClick={() => goSearch(d.name)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted">No terms yet — loader still ingesting this subject.</p>
          )}
        </div>
      </GlassCard>

      {terms && terms.length > 0 && (
        <GlassCard className="mt-8 p-6">
          <h2 className="font-display text-2xl">Word cloud</h2>
          <div className="mt-6 flex flex-wrap items-baseline gap-3">
            {terms.map((t, i) => {
              const max = terms[0].score || 1;
              const size = 12 + (t.score / max) * 26;
              return (
                <button
                  key={t.term}
                  onClick={() => goSearch(t.term)}
                  className="rounded-full px-2 py-1 transition-all hover:bg-surface/60"
                  style={{ fontSize: `${size}px`, color: quartileColor(i, terms.length) }}
                >
                  {t.term}
                </button>
              );
            })}
          </div>
        </GlassCard>
      )}

      <GlassCard className="mt-8 p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl">Recent questions</h2>
          <Link href={`/search?subject=${subject}`} className="text-sm text-cyan hover:underline">
            View all →
          </Link>
        </div>
        <div className="mt-6 space-y-4">
          {(questions ?? []).slice(0, 5).map((q) => (
            <div key={q.id} className="rounded-xl border border-border bg-surface/50 p-4">
              <div className="flex flex-wrap gap-2 text-xs">
                {q.marks != null && <Tag variant="rose">{q.marks} marks</Tag>}
                <Tag variant="mono">{q.session} {q.year}</Tag>
                {q.unit_number != null && <Tag>Unit {q.unit_number}</Tag>}
              </div>
              <p className="mt-2 text-text/90">{q.question_text}</p>
            </div>
          ))}
          {questions && questions.length === 0 && (
            <p className="text-muted">No questions yet for {subject}.</p>
          )}
        </div>
        <div className="mt-6 flex justify-end">
          <GradientButton href={`/search?subject=${subject}`} variant="ghost">
            Search this subject
          </GradientButton>
        </div>
      </GlassCard>
    </div>
  );
}
