"use client";

import { useEffect, useState } from "react";
import { api, type Stats } from "@/lib/api";

export function StatusPill() {
  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let active = true;
    api.stats()
      .then((v) => { if (active) setS(v); })
      .catch(() => { if (active) setErr(true); });
    return () => { active = false; };
  }, []);

  const label = err
    ? "Backend offline · run `uvicorn src.app:app`"
    : s
      ? `${s.subjects} subjects · ${s.papers} papers · ${s.questions.toLocaleString()} questions`
      : "Loading live counts…";

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-4 py-1.5 text-xs text-muted backdrop-blur-md">
      <span className="relative flex h-2 w-2">
        <span
          className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
            err ? "bg-rose" : "bg-cyan"
          }`}
        />
        <span className={`relative inline-flex h-2 w-2 rounded-full ${err ? "bg-rose" : "bg-cyan"}`} />
      </span>
      {label}
    </span>
  );
}
