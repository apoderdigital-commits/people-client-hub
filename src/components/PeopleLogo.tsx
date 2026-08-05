import { Users } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  tone?: "light" | "dark";
  size?: "sm" | "lg";
};

/** Logo textual "people" com ícone de figuras humanas em rosa. */
export function PeopleLogo({ className, tone = "dark", size = "sm" }: Props) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Users
        className={cn("shrink-0 text-brand", size === "lg" ? "size-8" : "size-6")}
        strokeWidth={2.5}
      />
      <span
        className={cn(
          "font-semibold lowercase tracking-tight",
          size === "lg" ? "text-3xl" : "text-xl",
          tone === "dark" ? "text-shell-foreground" : "text-ink",
        )}
      >
        people
      </span>
    </span>
  );
}
