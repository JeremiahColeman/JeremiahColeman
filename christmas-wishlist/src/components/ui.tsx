import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

const base =
  "inline-flex min-h-13 items-center justify-center gap-2 rounded-xl px-5 text-lg font-semibold transition-colors disabled:opacity-60";
const variants = {
  primary: "bg-pine text-white hover:bg-pine-dark",
  secondary: "border-2 border-pine bg-card text-pine hover:bg-pine-soft",
  quiet: "text-pine underline-offset-4 hover:underline",
  danger: "border-2 border-berry bg-card text-berry hover:bg-berry-soft",
};
export type ButtonVariant = keyof typeof variants;

export function buttonClass(variant: ButtonVariant = "primary", extra = "") {
  return `${base} ${variants[variant]} ${extra}`;
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}

export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return <div className={`rounded-2xl border border-line bg-card p-5 ${className}`} {...props} />;
}

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <header className="mb-6">
      <h1 className="font-display text-3xl font-bold leading-tight">{children}</h1>
      {sub ? <p className="mt-2 text-muted">{sub}</p> : null}
    </header>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block font-semibold">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-base text-muted">{hint}</span> : null}
      {error ? (
        <span role="alert" className="mt-1 block text-base font-semibold text-berry">
          {error}
        </span>
      ) : null}
    </label>
  );
}

export const inputClass =
  "block w-full min-h-13 rounded-xl border-2 border-line bg-white px-4 text-lg text-ink placeholder:text-muted/70 focus:border-pine focus:outline-none";

export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "success"; children: ReactNode }) {
  const tones = {
    info: "bg-gold-soft text-ink",
    error: "bg-berry-soft text-berry",
    success: "bg-pine-soft text-pine-dark",
  };
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-xl px-4 py-3 ${tones[tone]}`}>
      {children}
    </div>
  );
}
