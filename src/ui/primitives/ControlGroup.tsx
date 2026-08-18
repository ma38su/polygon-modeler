import type { HTMLAttributes, ReactNode } from "react";

interface ControlGroupProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  columns?: 2 | 3;
  children: ReactNode;
}

export function ControlGroup({
  label,
  columns = 2,
  children,
  className = "",
  ...props
}: ControlGroupProps) {
  return (
    <div className={className} {...props}>
      <p className="mb-1.5 text-[11px] font-medium text-text-muted">{label}</p>
      <div
        className={`grid gap-1.5 ${columns === 3 ? "grid-cols-3" : "grid-cols-2"}`}
      >
        {children}
      </div>
    </div>
  );
}
