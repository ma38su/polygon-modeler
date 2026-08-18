import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "default" | "ghost" | "accent" | "danger";
type ButtonSize = "sm" | "md" | "icon";

const base =
  "inline-flex min-w-0 items-center justify-center gap-1.5 rounded-ui-sm border text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40";

const variants: Record<ButtonVariant, string> = {
  default:
    "border-border bg-surface-2 text-text-secondary hover:border-border-strong hover:bg-surface-hover disabled:hover:border-border disabled:hover:bg-surface-2",
  ghost:
    "border-transparent bg-transparent text-text-muted hover:bg-surface-hover hover:text-text-primary",
  accent: "border-accent/45 bg-accent/15 text-accent-bright hover:bg-accent/25",
  danger: "border-danger/35 bg-danger/10 text-danger hover:bg-danger/20",
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-[var(--control-sm)] px-2",
  md: "min-h-[var(--control-md)] px-2.5",
  icon: "size-[var(--control-sm)] p-0",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  fullWidth?: boolean;
}

export function Button({
  variant = "default",
  size = "md",
  icon,
  fullWidth = false,
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={`${base} ${variants[variant]} ${sizes[size]} ${fullWidth ? "w-full" : ""} ${className}`}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
