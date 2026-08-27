import { cn } from "@/lib/utils";
import { ModelIcon } from "@/components/models/model-icon";

interface ModelLabelProps {
  model: string;
  className?: string;
  /** 文字是否截断 */
  truncate?: boolean;
}

export function ModelLabel({ model, className, truncate }: ModelLabelProps) {
  return (
    <span
      className={cn("inline-flex min-w-0 items-center gap-1.5", className)}
    >
      <ModelIcon model={model} />
      <span className={cn(truncate && "truncate")}>{model}</span>
    </span>
  );
}
