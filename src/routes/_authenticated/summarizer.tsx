import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { SummarizerQuota, useSummarizerStatus } from "@/components/summarizer-quota";
import { EmptyState, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { exportReportToPdf } from "@/lib/export-pdf";
import { summarizePdf, type SummaryResult } from "@/lib/summarizer.functions";
import { formatBytes } from "@/lib/uploads";

export const Route = createFileRoute("/_authenticated/summarizer")({
  head: () => ({
    meta: [
      { title: "PDF Summarizer — StudyPilot" },
      { name: "description", content: "Turn PDFs and notes into key points, chapter summaries, definitions and study notes." },
      { property: "og:title", content: "PDF Summarizer — StudyPilot" },
      { property: "og:description", content: "Turn PDFs and notes into structured study summaries." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SummarizerPage,
});

type Stage = "idle" | "uploading" | "summarizing";

function uploadPdf(file: File, onProgress: (p: number) => void) {
  return (async () => {
    const { data: u } = await supabase.auth.getUser();
    const { data: s } = await supabase.auth.getSession();
    if (!u.user || !s.session) throw new Error("Your session expired. Sign in again.");
    const path = `${u.user.id}/summaries/${crypto.randomUUID()}.pdf`;
    const base = import.meta.env["VITE_SUPABASE_URL"] as string;
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${base}/storage/v1/object/study-uploads/${path}`);
      xhr.setRequestHeader("Authorization", `Bearer ${s.session!.access_token}`);
      xhr.setRequestHeader("Content-Type", "application/pdf");
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
      xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status}).`)));
      xhr.onerror = () => reject(new Error("Upload failed. Check your connection."));
      xhr.send(file);
    });
    return path;
  })();
}

function SummarizerPage() {
  const qc = useQueryClient();
  const status = useSummarizerStatus().data;
  const summarize = useServerFn(summarizePdf);
  const [mode, setMode] = useState("pdf");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [scope, setScope] = useState("");
  const [detail, setDetail] = useState<"concise" | "detailed">("concise");
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SummaryResult | null>(null);
  const inFlight = useRef(false);

  const maxMb = status?.max_mb ?? 50;

  const pick = (f: File | undefined) => {
    setError(null);
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) return setError("Please choose a PDF file.");
    if (f.size > maxMb * 1024 * 1024) return setError(`This PDF is ${formatBytes(f.size)} — your plan allows up to ${maxMb}MB.`);
    if (!f.size) return setError("That file is empty.");
    setFile(f);
  };

  const run = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    setResult(null);
    try {
      let storagePath: string | undefined;
      if (mode === "pdf") {
        if (!file) throw new Error("Choose a PDF first.");
        setStage("uploading");
        setProgress(0);
        storagePath = await uploadPdf(file, setProgress);
      } else if (!text.trim()) {
        throw new Error("Paste some text first.");
      }
      setStage("summarizing");
      const r = await summarize({
        data: { ...(storagePath ? { storagePath, fileName: file!.name } : { text }), scope, detail },
      });
      setResult(r);
      toast.success("Summary ready");
      qc.invalidateQueries({ queryKey: ["summarizer"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setStage("idle");
      inFlight.current = false;
    }
  };

  const busy = stage !== "idle";
  const blocked = status && (!status.active || !status.enabled || (status.limit != null && (status.used ?? 0) >= status.limit));

  return (
    <AppShell>
      <PageHeader title="PDF Summarizer" description="Key points, chapter summaries, definitions and study notes from your documents." />
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        <Card>
          <CardContent className="space-y-4 p-4">
            <SummarizerQuota />
            <Tabs value={mode} onValueChange={setMode}>
              <TabsList className="w-full">
                <TabsTrigger value="pdf" className="flex-1">Upload PDF</TabsTrigger>
                <TabsTrigger value="text" className="flex-1">Paste text</TabsTrigger>
              </TabsList>
              <TabsContent value="pdf">
                <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed p-6 text-center text-sm hover:bg-muted/50">
                  <Upload className="size-6 text-primary" />
                  {file ? <span className="font-medium">{file.name} · {formatBytes(file.size)}</span> : <span>Choose a PDF (max {maxMb}MB)</span>}
                  <input type="file" accept="application/pdf,.pdf" className="sr-only" disabled={busy} onChange={(e) => pick(e.target.files?.[0])} />
                </label>
              </TabsContent>
              <TabsContent value="text">
                <Textarea rows={8} placeholder="Paste your notes or chapter text…" value={text} maxLength={200000} disabled={busy} onChange={(e) => setText(e.target.value)} />
                <p className="mt-1 text-xs text-muted-foreground">{text.length.toLocaleString()} / 200,000 characters</p>
              </TabsContent>
            </Tabs>
            <div>
              <Label htmlFor="scope">Pages or chapters (optional)</Label>
              <Input id="scope" placeholder="e.g. pages 10–25, or Chapter 3" value={scope} maxLength={200} disabled={busy} onChange={(e) => setScope(e.target.value)} />
            </div>
            <div className="flex gap-2">
              {(["concise", "detailed"] as const).map((d) => (
                <Button key={d} type="button" size="sm" variant={detail === d ? "default" : "outline"} className="capitalize" onClick={() => setDetail(d)} disabled={busy}>{d}</Button>
              ))}
            </div>
            {busy && (
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2"><Loader2 className="size-4 animate-spin" />{stage === "uploading" ? `Uploading… ${progress}%` : "Reading and summarizing — large documents can take a minute…"}</div>
                <Progress value={stage === "uploading" ? progress : 100} className={stage === "summarizing" ? "animate-pulse" : ""} />
              </div>
            )}
            {error && <p className="rounded-lg bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
            <Button className="w-full gap-2" onClick={run} disabled={busy || !!blocked}>
              <FileText className="size-4" />{busy ? "Working…" : error ? "Try again" : "Summarize"}
            </Button>
          </CardContent>
        </Card>
        <div>{result ? <SummaryView r={result} /> : !busy && <EmptyState icon={FileText} title="No summary yet" description="Upload a PDF or paste text, then tap Summarize." />}</div>
      </div>
      <History onOpen={setResult} />
    </AppShell>
  );
}

function exportSummary(r: SummaryResult) {
  exportReportToPdf({
    title: r.title,
    subtitle: r.overview,
    sections: [
      { heading: "Key points", lines: r.key_points },
      ...r.chapters.map((c) => ({ heading: c.title || "Section", lines: [c.summary] })),
      { heading: "Definitions", lines: r.definitions.map((d) => `${d.term}: ${d.definition}`) },
      { heading: "Main concepts", lines: r.concepts },
      { heading: "Study notes", lines: r.study_notes },
    ].filter((s) => s.lines.length),
  });
}

function List({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <section>
      <h3 className="mb-1 font-semibold">{title}</h3>
      <ul className="list-disc space-y-1 pl-5 text-sm">{items.map((i, n) => <li key={n}>{i}</li>)}</ul>
    </section>
  );
}

function SummaryView({ r }: { r: SummaryResult }) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2">
        <CardTitle className="text-lg">{r.title}</CardTitle>
        <Button size="sm" variant="outline" className="gap-1" onClick={() => exportSummary(r)}><Download className="size-4" />PDF</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {r.overview && <p className="text-sm text-muted-foreground">{r.overview}</p>}
        <List title="Key points" items={r.key_points} />
        {r.chapters.length > 0 && (
          <section>
            <h3 className="mb-1 font-semibold">Chapter summaries</h3>
            <div className="space-y-2">{r.chapters.map((c, i) => <div key={i} className="rounded-lg border p-2 text-sm"><div className="font-medium">{c.title}</div><p className="text-muted-foreground">{c.summary}</p></div>)}</div>
          </section>
        )}
        {r.definitions.length > 0 && (
          <section>
            <h3 className="mb-1 font-semibold">Important definitions</h3>
            <dl className="space-y-1 text-sm">{r.definitions.map((d, i) => <div key={i}><dt className="inline font-medium">{d.term}: </dt><dd className="inline text-muted-foreground">{d.definition}</dd></div>)}</dl>
          </section>
        )}
        <List title="Main concepts" items={r.concepts} />
        <List title="Study notes" items={r.study_notes} />
      </CardContent>
    </Card>
  );
}

function History({ onOpen }: { onOpen: (r: SummaryResult) => void }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["summarizer", "history"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pdf_summaries").select("id, title, source_name, scope, result, created_at").order("created_at", { ascending: false }).limit(30);
      if (error) throw error;
      return data;
    },
  });
  if (q.error) return <div className="mt-6"><ErrorState description="Could not load past summaries." onRetry={() => q.refetch()} /></div>;
  if (!q.data?.length) return null;
  return (
    <div className="mt-6 space-y-2">
      <h2 className="font-semibold">Past summaries</h2>
      {q.data.map((s) => (
        <div key={s.id} className="surface-card flex items-center gap-3 p-3 text-sm">
          <button type="button" className="flex-1 text-left" onClick={() => { onOpen(s.result as unknown as SummaryResult); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
            <div className="font-medium">{s.title}</div>
            <div className="text-xs text-muted-foreground">{s.source_name}{s.scope ? ` · ${s.scope}` : ""} · {new Date(s.created_at).toLocaleString()}</div>
          </button>
          <Button size="icon" variant="ghost" aria-label="Delete summary" onClick={async () => { await supabase.from("pdf_summaries").delete().eq("id", s.id); qc.invalidateQueries({ queryKey: ["summarizer", "history"] }); }}><Trash2 className="size-4" /></Button>
        </div>
      ))}
    </div>
  );
}
