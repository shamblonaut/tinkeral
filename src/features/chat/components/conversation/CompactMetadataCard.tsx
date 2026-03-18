import type { ReactNode } from "react";

interface CompactMetadataCardProps {
  children: ReactNode;
}

interface CompactMetadataCardItemProps {
  label: string;
  value: ReactNode;
  className?: string;
  valueClassName?: string;
}

export function CompactMetadataCard({ children }: CompactMetadataCardProps) {
  return (
    <div className="bg-muted/50 text-accent-foreground/70 rounded-md border p-2 text-[10px] leading-tight">
      <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">{children}</div>
    </div>
  );
}

export function CompactMetadataCardItem({
  label,
  value,
  className,
  valueClassName,
}: CompactMetadataCardItemProps) {
  return (
    <div className={className ?? "flex flex-col gap-0.5"}>
      <span className="text-[9px] font-semibold tracking-wider uppercase opacity-40">
        {label}
      </span>
      <span className={valueClassName ?? "font-medium"}>{value}</span>
    </div>
  );
}
