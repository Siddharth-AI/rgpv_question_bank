"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "ghost";

type Common = {
  children: ReactNode;
  variant?: Variant;
  className?: string;
};

type AsLink = Common & { href: string } & Omit<ComponentProps<typeof Link>, "href" | "children" | "className">;
type AsButton = Common & { href?: undefined } & Omit<ComponentProps<"button">, "children" | "className">;

const baseCls =
  "inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3 font-medium transition-all duration-200";
const primaryCls =
  "bg-accent-gradient text-bg shadow-glow hover:shadow-glow-cyan hover:scale-[1.02]";
const ghostCls =
  "border border-border bg-surface/40 text-text hover:border-violet/50 hover:bg-surface/80";

export function GradientButton(props: AsLink | AsButton) {
  const { variant = "primary", className = "", children, ...rest } = props;
  const cls = `${baseCls} ${variant === "primary" ? primaryCls : ghostCls} ${className}`;
  if ("href" in rest && rest.href) {
    const { href, ...linkRest } = rest as AsLink;
    return (
      <Link href={href} className={cls} {...linkRest}>
        {children}
      </Link>
    );
  }
  return (
    <button className={cls} {...(rest as AsButton)}>
      {children}
    </button>
  );
}
