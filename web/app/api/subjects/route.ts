import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const branch = url.searchParams.get("branch");
  const sb = supabase();
  let q = sb.from("subject_stats").select("*").order("branch").order("semester").order("subject_code");
  if (branch) q = q.eq("branch", branch.toUpperCase());
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
