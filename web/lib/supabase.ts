import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env var",
    );
  }
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "public" },
  });
  return _client;
}

const GARBLE = new Set("$¶§|°«ñ©®ºªµø<>".split(""));

export function cleanText(text: string | null | undefined): string {
  if (!text) return "";
  const out: string[] = [];
  for (const tok of text.split(/\s+/)) {
    if (!tok) continue;
    let bad = false;
    for (const c of tok) {
      if (GARBLE.has(c)) {
        bad = true;
        break;
      }
    }
    if (bad) continue;
    const letters = [...tok].filter((c) => /\p{L}/u.test(c));
    if (letters.length) {
      const ascii = letters.filter((c) => c.charCodeAt(0) < 128).length;
      if (ascii / letters.length < 0.5) continue;
    }
    out.push(tok);
  }
  return out.join(" ").trim();
}

export function sanitizeFts(q: string | null | undefined): string {
  if (!q) return "";
  const cleaned = q.replace(/[^A-Za-z0-9\s]+/g, " ");
  const tokens = cleaned
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
  if (!tokens.length) return "";
  return tokens.join(" | ");
}
