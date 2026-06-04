import { NextResponse } from "next/server";
import { cleanText, supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const qid = Number(id);
  if (!Number.isFinite(qid)) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }
  const sb = supabase();
  const { data, error } = await sb
    .from("questions")
    .select(
      "id, unit_number, question_number, marks, question_text, papers!inner(subject_code, subject_name, year, session, branch, semester, source_pdf_url, source_pdf_path)",
    )
    .eq("id", qid)
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const r = data as unknown as {
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
