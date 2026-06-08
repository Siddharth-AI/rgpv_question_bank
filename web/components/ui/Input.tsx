import { forwardRef, type InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { className = "", ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={`w-full rounded-2xl border border-border bg-surface/70 px-4 py-3 text-text placeholder:text-muted/70 outline-none transition-all focus:border-violet/60 focus:shadow-glow ${className}`}
      {...rest}
    />
  );
});
