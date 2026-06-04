import { forwardRef, type SelectHTMLAttributes } from "react";

type Props = SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, Props>(function Select(
  { className = "", children, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      className={`w-full appearance-none rounded-2xl border border-border bg-surface/70 px-4 py-3 text-text outline-none transition-all focus:border-violet/60 focus:shadow-glow ${className}`}
      {...rest}
    >
      {children}
    </select>
  );
});
