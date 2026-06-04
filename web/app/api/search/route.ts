import { NextResponse } from "next/server";
import { cleanText, sanitizeFts, supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Row = {
  id: number;
  unit_number: number | null;
  question_number: string | null;
  marks: number | null;
  question_text: string;
  papers: {
    subject_code: string;
    subject_name: string;
    year: number;
    session: string;
    branch: string;
    semester: number;
    source_pdf_url: string | null;
    source_pdf_path: string | null;
  } | null;
};

function num(v: string | null): number | undefined {
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

const SELECT =
  "id, unit_number, question_number, marks, question_text, papers!inner(subject_code, subject_name, year, session, branch, semester, source_pdf_url, source_pdf_path)";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q");
  const subject = url.searchParams.get("subject");
  const unit = num(url.searchParams.get("unit"));
  const yearFrom = num(url.searchParams.get("year_from"));
  const yearTo = num(url.searchParams.get("year_to"));
  const marks = num(url.searchParams.get("marks"));
  const branch = url.searchParams.get("branch");
  const limit = Math.min(Math.max(num(url.searchParams.get("limit")) ?? 50, 1), 200);

  const sb = supabase();
  let qb = sb.from("questions").select(SELECT).limit(limit);

  const tsq = q ? sanitizeFts(q) : "";
  if (tsq) {
    qb = qb.textSearch("tsv", tsq, { type: "websearch", config: "english" });
  } else {
    qb = qb.order("id", { ascending: false });
  }
  if (subject) qb = qb.eq("papers.subject_code", subject);
  if (branch) qb = qb.eq("papers.branch", branch.toUpperCase());
  if (unit != null) qb = qb.eq("unit_number", unit);
  if (marks != null) qb = qb.eq("marks", marks);
  if (yearFrom != null) qb = qb.gte("papers.year", yearFrom);
  if (yearTo != null) qb = qb.lte("papers.year", yearTo);

  const { data, error } = await qb;
  if (error) return NextResponse.json([], { status: 200 });

  const flat = (data as unknown as Row[]).map((r) => ({
    id: r.id,
    unit_number: r.unit_number,
    question_number: r.question_number,
    marks: r.marks,
    question_text: cleanText(r.question_text),
    subject_code: r.papers?.subject_code ?? "",
    subject_name: r.papers?.subject_name ?? "",
    year: r.papers?.year ?? 0,
    session: r.papers?.session ?? "",
    branch: r.papers?.branch ?? "",
    semester: r.papers?.semester ?? 0,
    source_pdf_url: r.papers?.source_pdf_url ?? null,
    source_pdf_path: r.papers?.source_pdf_path ?? null,
  }));
  return NextResponse.json(flat);
}
