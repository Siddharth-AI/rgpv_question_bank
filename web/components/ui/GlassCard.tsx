import { forwardRef, type HTMLAttributes } from "react";

type Props = HTMLAttributes<HTMLDivElement> & { interactive?: boolean };

export const GlassCard = forwardRef<HTMLDivElement, Props>(function GlassCard(
  { className = "", interactive = false, ...rest },
  ref,
) {
  const base =
    "rounded-2xl border border-border bg-surface/70 backdrop-blur-xl shadow-sm relative overflow-hidden";
  const hover = interactive
    ? "transition-all duration-300 hover:scale-[1.02] hover:shadow-glow hover:border-violet/40"
    : "";
  return <div ref={ref} className={`${base} ${hover} ${className}`} {...rest} />;
});
