import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sb = supabase();
    const { error } = await sb.from("papers").select("id", { count: "exact", head: true }).limit(1);
    if (error) throw error;
    return NextResponse.json({ status: "ok" });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ status: "error", error: msg }, { status: 500 });
  }
}
