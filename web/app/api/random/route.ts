import { NextResponse } from "next/server";
import { cleanText, supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Row = {
  id: number;
  unit_number: number | null;
  question_number: string | null;
  marks: number | null;
  question_text: string;
  papers: {
    subject_code: string; subject_name: string; year: number; session: string;
    branch: string; semester: number; source_pdf_url: string | null; source_pdf_path: string | null;
  } | null;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const subject = url.searchParams.get("subject");
  const branch = url.searchParams.get("branch");
  const sb = supabase();

  let countQ = sb.from("questions").select("id, papers!inner(subject_code, branch)", { count: "exact", head: true });
  if (subject) countQ = countQ.eq("papers.subject_code", subject);
  if (branch) countQ = countQ.eq("papers.branch", branch.toUpperCase());
  const { count } = await countQ;
  if (!count) return NextResponse.json({ error: "no questions" }, { status: 404 });

  const offset = Math.floor(Math.random() * count);
  let q = sb
    .from("questions")
    .select(
      "id, unit_number, question_number, marks, question_text, papers!inner(subject_code, subject_name, year, session, branch, semester, source_pdf_url, source_pdf_path)",
    )
    .range(offset, offset);
  if (subject) q = q.eq("papers.subject_code", subject);
  if (branch) q = q.eq("papers.branch", branch.toUpperCase());

  const { data, error } = await q;
  if (error || !data?.length) return NextResponse.json({ error: "miss" }, { status: 404 });

  const r = data[0] as unknown as Row;
  return NextResponse.json({
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
  });
}
