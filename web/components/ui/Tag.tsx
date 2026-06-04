import type { HTMLAttributes, ReactNode } from "react";

type Variant = "default" | "violet" | "cyan" | "rose" | "mono";

const VARIANT: Record<Variant, string> = {
  default: "bg-surface/70 border-border text-muted",
  violet: "bg-violet/15 border-violet/40 text-violet",
  cyan: "bg-cyan/15 border-cyan/40 text-cyan",
  rose: "bg-rose/15 border-rose/40 text-rose",
  mono: "bg-surface/70 border-border text-text font-mono",
};

type Props = HTMLAttributes<HTMLSpanElement> & {
  variant?: Variant;
  children: ReactNode;
};

export function Tag({ variant = "default", className = "", children, ...rest }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs ${VARIANT[variant]} ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}
