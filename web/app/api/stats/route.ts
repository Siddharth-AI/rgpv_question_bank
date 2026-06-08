import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const sb = supabase();
  const [pCount, qCount, sCount, yMin, yMax] = await Promise.all([
    sb.from("papers").select("id", { count: "exact", head: true }),
    sb.from("questions").select("id", { count: "exact", head: true }),
    sb.from("subject_stats").select("subject_code", { count: "exact", head: true }),
    sb.from("papers").select("year").order("year", { ascending: true }).limit(1).maybeSingle(),
    sb.from("papers").select("year").order("year", { ascending: false }).limit(1).maybeSingle(),
  ]);

  return NextResponse.json({
    papers: pCount.count ?? 0,
    questions: qCount.count ?? 0,
    subjects: sCount.count ?? 0,
    year_from: yMin.data?.year ?? null,
    year_to: yMax.data?.year ?? null,
  });
}
