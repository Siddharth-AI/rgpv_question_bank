import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const subject = url.searchParams.get("subject");
  const topN = Math.min(Math.max(Number(url.searchParams.get("top_n") ?? 20), 1), 100);
  if (!subject) {
    return NextResponse.json({ error: "subject required" }, { status: 400 });
  }
  const sb = supabase();
  const { data, error } = await sb
    .from("subject_frequencies")
    .select("term, score, rank")
    .eq("subject_code", subject)
    .order("rank", { ascending: true })
    .limit(topN);
  if (error) return NextResponse.json([], { status: 200 });
  return NextResponse.json(
    (data ?? []).map((r) => ({ term: r.term, score: r.score })),
  );
}
