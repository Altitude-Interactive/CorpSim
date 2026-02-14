interface DeferredSearchStatusProps {
  isUpdating: boolean;
  text?: string;
}

export function DeferredSearchStatus({
  isUpdating,
  text = "Updating results..."
}: DeferredSearchStatusProps) {
  return (
    <p className="h-4 text-xs text-muted-foreground" aria-live="polite">
      <span className={isUpdating ? "visible" : "invisible"}>{text}</span>
    </p>
  );
}

