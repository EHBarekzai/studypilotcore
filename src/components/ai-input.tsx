import { FileText, ImageIcon, Paperclip, X } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ACCEPTED_TYPES,
  MAX_FILES,
  fileToAttachment,
  type Attachment,
} from "@/lib/tutor";

export function AttachmentPicker({
  attachments,
  onChange,
  disabled,
}: {
  attachments: Attachment[];
  onChange: (next: Attachment[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = MAX_FILES - attachments.length;
    if (room <= 0) {
      toast.error(`You can attach up to ${MAX_FILES} files.`);
      return;
    }
    const next: Attachment[] = [];
    for (const file of Array.from(files).slice(0, room)) {
      try {
        next.push(await fileToAttachment(file));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "That file could not be added.");
      }
    }
    if (next.length) onChange([...attachments, ...next]);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_TYPES}
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="gap-2"
      >
        <Paperclip className="size-4" />
        Attach image or PDF
      </Button>

      {attachments.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {attachments.map((a, index) => (
            <li key={`${a.name}-${index}`} className="relative overflow-hidden rounded-xl border">
              {a.mimeType.startsWith("image/") ? (
                <img
                  src={a.dataUrl}
                  alt={`Attachment preview: ${a.name}`}
                  className="h-24 w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-24 flex-col items-center justify-center gap-1 bg-muted/50 text-muted-foreground">
                  <FileText className="size-6" />
                  <span className="text-[10px] uppercase tracking-wide">PDF</span>
                </div>
              )}
              <p className="truncate px-2 py-1.5 text-[11px] text-muted-foreground">{a.name}</p>
              <button
                type="button"
                aria-label={`Remove ${a.name}`}
                className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-muted-foreground shadow-sm transition-colors hover:text-destructive"
                onClick={() => onChange(attachments.filter((_, i) => i !== index))}
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <ImageIcon className="size-3.5" />
          Up to {MAX_FILES} files, 5MB each. Images and PDFs are read with AI vision.
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
  attachments,
  onAttachmentsChange,
  disabled,
  rows = 5,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (next: string) => void;
  attachments: Attachment[];
  onAttachmentsChange: (next: Attachment[]) => void;
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
      <AttachmentPicker
        attachments={attachments}
        onChange={onAttachmentsChange}
        disabled={disabled}
      />
    </div>
  );
}
