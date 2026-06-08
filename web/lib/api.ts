// Same-origin Next.js API routes. No CORS, no external URL needed.
const API = "/api";

export type Stats = {
  papers: number;
  questions: number;
  subjects: number;
  year_from: number | null;
  year_to: number | null;
};

export type Branch = {
  branch: string;
  subjects: number;
  papers: number;
  questions: number;
};

export type Subject = {
  subject_code: string;
  subject_name: string;
  branch: string;
  semester: number;
  papers: number;
  questions: number;
};

export type QuestionRow = {
  id: number;
  unit_number: number | null;
  question_number: string | null;
  marks: number | null;
  question_text: string;
  subject_code: string;
  subject_name: string;
  year: number;
  session: string;
  branch: string;
  semester: number;
  source_pdf_url: string | null;
  source_pdf_path: string | null;
};

export type FrequencyRow = { term: string; score: number };

export type SearchParams = {
  q?: string;
  subject?: string;
  unit?: number;
  year_from?: number;
  year_to?: number;
  marks?: number;
  branch?: string;
  limit?: number;
};

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${API}${path}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`API ${path} → ${r.status}`);
  return (await r.json()) as T;
}

function qs(params: Record<string, string | number | undefined | null>): string {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    out.set(k, String(v));
  }
  const s = out.toString();
  return s ? `?${s}` : "";
}

export const api = {
  stats: () => get<Stats>("/stats"),
  branches: () => get<Branch[]>("/branches"),
  subjects: (branch?: string) => get<Subject[]>(`/subjects${qs({ branch })}`),
  search: (params: SearchParams) => get<QuestionRow[]>(`/search${qs(params)}`),
  frequency: (subject: string, top_n = 20) =>
    get<FrequencyRow[]>(`/frequency${qs({ subject, top_n })}`),
  question: (id: number) => get<QuestionRow>(`/question/${id}`),
  random: (subject?: string, branch?: string) =>
    get<QuestionRow>(`/random${qs({ subject, branch })}`),
};
