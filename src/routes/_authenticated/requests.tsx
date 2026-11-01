import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { MessageSquarePlus, Paperclip } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/requests")({
  head: () => ({
    meta: [
      { title: "Submit a Request — StudyPilot" },
      { name: "description", content: "Send suggestions, feature requests, bug reports and feedback to the StudyPilot team." },
      { property: "og:title", content: "Submit a Request — StudyPilot" },
      { property: "og:description", content: "Share feedback and track replies from the StudyPilot team." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RequestsPage,
});

const CATEGORIES = [["suggestion", "Suggestion"], ["feature", "Feature request"], ["complaint", "Complaint"], ["bug", "Bug report"], ["feedback", "General feedback"]] as const;
const STATUS: Record<string, string> = { new: "New", in_review: "In Review", planned: "Planned", resolved: "Resolved", rejected: "Rejected" };
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf", "text/plain"];
const MAX_BYTES = 10 * 1024 * 1024;

function RequestsPage() {
  const qc = useQueryClient();
  const [category, setCategory] = useState<string>("feedback");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const list = useQuery({
    queryKey: ["requests"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_requests").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Viewing this page marks request notifications as read.
  useEffect(() => {
    void supabase.from("user_notifications").update({ read_at: new Date().toISOString() }).is("read_at", null)
      .then(() => qc.invalidateQueries({ queryKey: ["shell-info"] }));
  }, [qc]);

  const submit = useMutation({
    mutationFn: async () => {
      if (!subject.trim() || !message.trim()) throw new Error("Add a subject and a message.");
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sign in again to submit.");
      let attachment_path: string | null = null;
      if (file) {
        if (!ALLOWED.includes(file.type)) throw new Error("Attachments must be an image, PDF or .txt file.");
        if (file.size > MAX_BYTES) throw new Error("Attachments can be up to 10MB.");
        attachment_path = `${u.user.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]+/g, "_").slice(-80)}`;
        const { error } = await supabase.storage.from("request-attachments").upload(attachment_path, file, { contentType: file.type });
        if (error) throw new Error("The attachment could not be uploaded.");
      }
      const { error } = await supabase.from("user_requests").insert({
        user_id: u.user.id,
        category,
        subject: subject.trim().slice(0, 200),
        message: message.trim().slice(0, 5000),
        attachment_path,
        attachment_name: file ? file.name.slice(0, 160) : null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Request sent — thank you!");
      setSubject(""); setMessage(""); setFile(null);
      qc.invalidateQueries({ queryKey: ["requests"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not send."),
  });

  return (
    <AppShell>
      <PageHeader title="Submit a Request" description="Suggestions, feature ideas, complaints, bugs or feedback — send as many as you like." />
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">New request</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label htmlFor="rq-subject">Subject</Label><Input id="rq-subject" value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} /></div>
            <div><Label htmlFor="rq-msg">Message</Label><Textarea id="rq-msg" rows={6} value={message} maxLength={5000} onChange={(e) => setMessage(e.target.value)} /></div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <Paperclip className="size-4" />{file ? file.name : "Attach a file (optional — image, PDF or .txt, 10MB)"}
              <input type="file" className="sr-only" accept={ALLOWED.join(",")} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
            <Button className="w-full" disabled={submit.isPending} onClick={() => submit.mutate()}>{submit.isPending ? "Sending…" : "Send request"}</Button>
          </CardContent>
        </Card>
        <div className="space-y-3">
          <h2 className="font-semibold">Your requests</h2>
          {list.isLoading ? <LoadingState /> : list.error ? <ErrorState onRetry={() => list.refetch()} /> : !list.data?.length ? (
            <EmptyState icon={MessageSquarePlus} title="No requests yet" description="Your submissions and our replies will show up here." />
          ) : list.data.map((r) => (
            <Card key={r.id}>
              <CardContent className="space-y-2 p-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{CATEGORIES.find(([v]) => v === r.category)?.[1]}</Badge>
                  <Badge>{STATUS[r.status] ?? r.status}</Badge>
                  <span className="ml-auto text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
                </div>
                <div className="font-medium">{r.subject}</div>
                <p className="whitespace-pre-wrap text-muted-foreground">{r.message}</p>
                {r.attachment_name && <div className="flex items-center gap-1 text-xs text-muted-foreground"><Paperclip className="size-3" />{r.attachment_name}</div>}
                {r.admin_reply && (
                  <div className="rounded-lg bg-primary-soft p-2">
                    <div className="text-xs font-medium text-primary">Reply from StudyPilot{r.replied_at ? ` · ${new Date(r.replied_at).toLocaleDateString()}` : ""}</div>
                    <p className="whitespace-pre-wrap">{r.admin_reply}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
