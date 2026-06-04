import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { Tag } from "@/components/ui/Tag";
import type { QuestionRow } from "@/lib/api";

export function QuestionCard({ q }: { q: QuestionRow }) {
  return (
    <GlassCard interactive className="p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Tag variant="violet">{q.subject_code}</Tag>
        {q.marks != null && <Tag variant="rose">{q.marks} marks</Tag>}
        <Tag variant="mono">{q.session} {q.year}</Tag>
        {q.unit_number != null && <Tag>Unit {q.unit_number}</Tag>}
      </div>
      <p className="mt-4 font-display text-xl text-text">
        {q.question_number ?? "Question"} · <span className="text-muted">{q.subject_name}</span>
      </p>
      <p className="mt-3 text-text/90">{q.question_text}</p>
      <div className="mt-5 flex flex-wrap items-center gap-4 text-sm">
        <Link href={`/insights/${q.subject_code}`} className="text-cyan hover:underline">
          Subject insights →
        </Link>
        {q.source_pdf_url && (
          <a
            href={q.source_pdf_url}
            target="_blank"
            rel="noreferrer"
            className="text-muted hover:text-text"
          >
            Source PDF ↗
          </a>
        )}
      </div>
    </GlassCard>
  );
}

export function CardSkeleton() {
  return <GlassCard className="h-48 animate-pulse p-6" />;
}
