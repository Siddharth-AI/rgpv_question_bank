"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { api, type QuestionRow, type Subject } from "@/lib/api";
import { useDebounced } from "@/lib/useDebounced";
import { GlassCard } from "@/components/ui/GlassCard";
import { GradientButton } from "@/components/ui/GradientButton";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Tag } from "@/components/ui/Tag";
import { CardSkeleton, QuestionCard } from "@/components/QuestionCard";

const UNITS = [1, 2, 3, 4, 5];
const MARKS = [7, 14];

function asInt(s: string | null): number | undefined {
  if (!s) return undefined;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : undefined;
}

function SearchInner() {
  const router = useRouter();
  const params = useSearchParams();

  const [q, setQ] = useState(params.get("q") ?? "");
  const [subject, setSubject] = useState(params.get("subject") ?? "");
  const [unit, setUnit] = useState<number | undefined>(asInt(params.get("unit")));
  const [marks, setMarks] = useState<number | undefined>(asInt(params.get("marks")));
  const [yearFrom, setYearFrom] = useState<number | undefined>(asInt(params.get("year_from")));
  const [yearTo, setYearTo] = useState<number | undefined>(asInt(params.get("year_to")));

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [results, setResults] = useState<QuestionRow[] | null>(null);
  const [err, setErr] = useState(false);
  const [loading, setLoading] = useState(false);

  const debouncedQ = useDebounced(q, 300);

  useEffect(() => {
    let active = true;
    api.subjects().then((v) => { if (active) setSubjects(v); }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setErr(false);
    api
      .search({
        q: debouncedQ || undefined,
        subject: subject || undefined,
        unit,
        marks,
        year_from: yearFrom,
        year_to: yearTo,
        limit: 50,
      })
      .then((r) => { if (active) setResults(r); })
      .catch(() => { if (active) setErr(true); })
      .finally(() => { if (active) setLoading(false); });

    const u = new URLSearchParams();
    if (debouncedQ) u.set("q", debouncedQ);
    if (subject) u.set("subject", subject);
    if (unit != null) u.set("unit", String(unit));
    if (marks != null) u.set("marks", String(marks));
    if (yearFrom != null) u.set("year_from", String(yearFrom));
    if (yearTo != null) u.set("year_to", String(yearTo));
    router.replace(`/search${u.toString() ? `?${u}` : ""}`);

    return () => { active = false; };
  }, [debouncedQ, subject, unit, marks, yearFrom, yearTo, router]);

  const filterChips = useMemo(
    () => [
      unit != null && `Unit ${unit}`,
      marks != null && `${marks} marks`,
      yearFrom != null && `≥ ${yearFrom}`,
      yearTo != null && `≤ ${yearTo}`,
      subject && subject,
    ].filter(Boolean),
    [unit, marks, yearFrom, yearTo, subject],
  );

  const reset = () => {
    setQ("");
    setSubject("");
    setUnit(undefined);
    setMarks(undefined);
    setYearFrom(undefined);
    setYearTo(undefined);
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="sticky top-[72px] z-30 -mx-6 mb-10 border-b border-border bg-bg/70 px-6 py-4 backdrop-blur-xl">
        <div className="grid gap-3 md:grid-cols-[2fr_1fr_auto_auto_auto_auto_auto]">
          <Input
            placeholder="Search questions… try BCNF, transaction, TCP"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
          <Select value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option value="">All subjects</option>
            {subjects.map((s) => (
              <option key={`${s.subject_code}-${s.branch}`} value={s.subject_code}>
                {s.subject_code} · {s.subject_name}
              </option>
            ))}
          </Select>
          <Select value={unit ?? ""} onChange={(e) => setUnit(asInt(e.target.value) ?? undefined)}>
            <option value="">Any unit</option>
            {UNITS.map((u) => (
              <option key={u} value={u}>Unit {u}</option>
            ))}
          </Select>
          <Select value={marks ?? ""} onChange={(e) => setMarks(asInt(e.target.value) ?? undefined)}>
            <option value="">Any marks</option>
            {MARKS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </Select>
          <Input
            type="number"
            placeholder="From"
            value={yearFrom ?? ""}
            onChange={(e) => setYearFrom(asInt(e.target.value))}
            className="md:w-24"
          />
          <Input
            type="number"
            placeholder="To"
            value={yearTo ?? ""}
            onChange={(e) => setYearTo(asInt(e.target.value))}
            className="md:w-24"
          />
          <button onClick={reset} className="rounded-2xl border border-border bg-surface/40 px-4 py-2 text-sm text-muted hover:text-text">
            Reset
          </button>
        </div>
        {filterChips.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {filterChips.map((c) => (
              <Tag key={String(c)} variant="cyan">{String(c)}</Tag>
            ))}
          </div>
        )}
      </div>

      {err && (
        <GlassCard className="border-rose/40 p-6 text-rose">
          Backend unreachable. Start the API: <code className="font-mono">uvicorn src.app:app --port 8000</code>
        </GlassCard>
      )}

      {loading && !results && (
        <div className="grid gap-6">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      )}

      {results && results.length === 0 && !loading && !err && (
        <GlassCard className="p-12 text-center">
          <p className="font-display text-3xl text-muted">No questions matched.</p>
          <p className="mt-2 text-sm text-muted">Loosen the filters, or try a single keyword.</p>
          <div className="mt-6 flex justify-center">
            <GradientButton onClick={reset} variant="ghost">Reset filters</GradientButton>
          </div>
        </GlassCard>
      )}

      {results && results.length > 0 && (
        <AnimatePresence mode="popLayout">
          <div className="grid gap-6">
            {results.map((r, i) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, delay: i * 0.02 }}
              >
                <QuestionCard q={r} />
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-6 py-16 text-muted">Loading…</div>}>
      <SearchInner />
    </Suspense>
  );
}
