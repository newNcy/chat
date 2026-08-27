const DOT_INTERVAL_S = 0.6;

export function LoadingDots() {
  return (
    <div className="flex h-5 items-center gap-1.5" aria-label="正在生成">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2 w-2 rounded-full bg-muted-foreground/25 animate-loading-dot"
          style={{ animationDelay: `${i * DOT_INTERVAL_S}s` }}
        />
      ))}
    </div>
  );
}
