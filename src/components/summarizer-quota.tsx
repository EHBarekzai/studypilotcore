import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { Progress } from "@/components/ui/progress";
import { getSummarizerStatus } from "@/lib/summarizer.functions";

export function useSummarizerStatus() {
  const fn = useServerFn(getSummarizerStatus);
  return useQuery({ queryKey: ["summarizer", "status"], queryFn: () => fn() });
}

/** Used/remaining PDF summaries for the current billing cycle (server values). */
export function SummarizerQuota() {
  const { data, isLoading, error } = useSummarizerStatus();
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading summary allowance…</p>;
  if (error || !data) return <p className="text-sm text-destructive">Could not load summary allowance.</p>;
  if (!data.active) return <p className="text-sm text-muted-foreground">No active plan — choose one in Billing to summarize PDFs.</p>;
  if (!data.enabled) return <p className="text-sm text-muted-foreground">PDF Summarizer isn't included in your plan.</p>;
  const used = data.used ?? 0;
  const limit = data.limit ?? null;
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span>PDF summaries</span>
        <span className="text-muted-foreground">
          {used} / {limit ?? "∞"}
          {limit !== null && ` · ${Math.max(0, limit - used)} left`} · max {data.max_mb ?? "∞"}MB/PDF
        </span>
      </div>
      <Progress value={limit ? Math.min(100, (used / limit) * 100) : 0} />
      {data.resets_on && (
        <p className="mt-1 text-xs text-muted-foreground">Resets {new Date(data.resets_on).toLocaleDateString()} (billing cycle)</p>
      )}
    </div>
  );
}
