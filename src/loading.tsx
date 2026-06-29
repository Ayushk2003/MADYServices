import { Loader2 } from "lucide-react";

type LoadingStateProps = {
  label?: string;
  detail?: string;
  variant?: "page" | "inline" | "overlay";
};

export function LoadingState({
  label = "Loading",
  detail = "Preparing the next view.",
  variant = "page",
}: LoadingStateProps) {
  return (
    <div className={`loading-state ${variant}`} role="status" aria-live="polite">
      <Loader2 size={variant === "inline" ? 18 : 28} aria-hidden="true" />
      <div>
        <strong>{label}</strong>
        {detail && <span>{detail}</span>}
      </div>
    </div>
  );
}

export function LoadingButtonLabel({ children }: { children: string }) {
  return (
    <>
      <Loader2 className="button-spinner" size={17} aria-hidden="true" />
      {children}
    </>
  );
}
