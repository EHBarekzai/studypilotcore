import { FileText, ImageIcon, Paperclip, X } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  ACCEPTED_UPLOAD_TYPES,
  MAX_UPLOAD_FILES,
  formatBytes,
  type useStudyUploads,
} from "@/lib/uploads";

export type UploadsState = ReturnType<typeof useStudyUploads>;

export function AttachmentPicker({
  uploads,
  disabled,
}: {
  uploads: UploadsState;
  disabled?: boolean | undefined;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { files, progress, busy, add, remove } = uploads;

  const handleFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    const room = MAX_UPLOAD_FILES - files.length;
    if (room <= 0) {
      toast.error(`You can attach up to ${MAX_UPLOAD_FILES} files.`);
      return;
    }
    await add(Array.from(list).slice(0, room), (message) => toast.error(message));
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_UPLOAD_TYPES}
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
        className="gap-2"
      >
        <Paperclip className="size-4" />
        {busy ? "Uploading…" : "Attach image or PDF"}
      </Button>

      {progress.length ? (
        <ul className="space-y-2" aria-live="polite">
          {progress.map((item) => (
            <li key={item.name} className="space-y-1 rounded-xl border p-2.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate">{item.name}</span>
                <span className="text-muted-foreground">{item.percent}%</span>
              </div>
              <Progress value={item.percent} aria-label={`Uploading ${item.name}`} />
            </li>
          ))}
        </ul>
      ) : null}

      {files.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {files.map((file) => (
            <li key={file.id} className="relative overflow-hidden rounded-xl border">
              {file.previewUrl ? (
                <img
                  src={file.previewUrl}
                  alt={`Attachment preview: ${file.name}`}
                  className="h-24 w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-24 flex-col items-center justify-center gap-1 bg-muted/50 text-muted-foreground">
                  {file.mimeType === "application/pdf" ? (
                    <FileText className="size-6" />
                  ) : (
                    <ImageIcon className="size-6" />
                  )}
                  <span className="text-[10px] uppercase tracking-wide">
                    {file.mimeType === "application/pdf" ? "PDF" : "Image"}
                  </span>
                </div>
              )}
              <p className="truncate px-2 pt-1.5 text-[11px] text-muted-foreground">{file.name}</p>
              <p className="px-2 pb-1.5 text-[10px] text-muted-foreground">
                {formatBytes(file.sizeBytes)}
                {file.storagePath ? " · stored securely" : ""}
              </p>
              <button
                type="button"
                aria-label={`Remove ${file.name}`}
                className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-muted-foreground shadow-sm transition-colors hover:text-destructive"
                onClick={() => remove(file.id)}
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <ImageIcon className="size-3.5" />
          Up to {MAX_UPLOAD_FILES} files, 50MB each. Images and PDFs are read with AI vision.
        </p>
      )}
    </div>
  );
}

export function AiSourceInput({
  label,
  placeholder,
  value,
  onChange,
  uploads,
  disabled,
  rows = 5,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (next: string) => void;
  uploads: UploadsState;
  disabled?: boolean;
  rows?: number;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="ai-source">{label}</Label>
        <Textarea
          id="ai-source"
          rows={rows}
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      <AttachmentPicker uploads={uploads} disabled={disabled} />
    </div>
  );
}
