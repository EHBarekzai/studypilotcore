import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export const BUCKET = "study-uploads";
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
export const ACCEPTED_UPLOAD_TYPES = "image/*,application/pdf";
export const MAX_UPLOAD_FILES = 4;
/** Files below this size are sent inline to the AI to skip a storage round trip. */
export const INLINE_LIMIT_BYTES = 3 * 1024 * 1024;

export type UploadedFile = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  /** Storage path for large files (AI reads it server-side). */
  storagePath?: string;
  /** Inline base64 for small files, or a signed URL preview for large ones. */
  dataUrl?: string;
  previewUrl?: string;
};

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes > 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

export function validateUpload(file: File) {
  const mimeType =
    file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "");
  if (!mimeType.startsWith("image/") && mimeType !== "application/pdf") {
    throw new Error(`${file.name} must be an image or a PDF.`);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`${file.name} is ${formatBytes(file.size)} — the limit is 50MB.`);
  }
  if (!file.size) throw new Error(`${file.name} is empty.`);
  return mimeType;
}

function readDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

function safeName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").slice(-80);
}

/** Uploads to private storage with real progress via XHR, then records the file. */
async function uploadToStorage(
  file: File,
  mimeType: string,
  onProgress: (percent: number) => void,
): Promise<{ id: string; storagePath: string; previewUrl?: string }> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error("You need to be signed in to upload files.");
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Your session expired. Sign in again to upload.");

  const path = `${userData.user.id}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const baseUrl = import.meta.env["VITE_SUPABASE_URL"] as string;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${baseUrl}/storage/v1/object/${BUCKET}/${path}`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("x-upsert", "true");
    if (mimeType) xhr.setRequestHeader("Content-Type", mimeType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
      }
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload of ${file.name} failed (${xhr.status}).`));
    xhr.onerror = () => reject(new Error(`Upload of ${file.name} failed.`));
    xhr.send(file);
  });

  const { data: row, error } = await supabase
    .from("study_files")
    .insert({
      user_id: userData.user.id,
      name: file.name.slice(0, 160),
      mime_type: mimeType,
      size_bytes: file.size,
      storage_path: path,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  let previewUrl: string | undefined;
  if (mimeType.startsWith("image/")) {
    const signed = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
    previewUrl = signed.data?.signedUrl ?? undefined;
  }

  onProgress(100);
  return { id: row.id as string, storagePath: path, ...(previewUrl ? { previewUrl } : {}) };
}

export type UploadProgress = { name: string; percent: number };

/**
 * File picker state: validates, uploads with progress and keeps previews.
 * Small files stay inline (cheapest AI path); large ones go to secure storage.
 */
export function useStudyUploads() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [progress, setProgress] = useState<UploadProgress[]>([]);
  const [busy, setBusy] = useState(false);

  const add = useCallback(
    async (incoming: File[], onError: (message: string) => void) => {
      if (!incoming.length) return;
      setBusy(true);
      try {
        for (const file of incoming) {
          try {
            const mimeType = validateUpload(file);
            if (file.size <= INLINE_LIMIT_BYTES) {
              setProgress((p) => [...p, { name: file.name, percent: 40 }]);
              const dataUrl = await readDataUrl(file);
              setFiles((prev) => [
                ...prev,
                {
                  id: crypto.randomUUID(),
                  name: file.name,
                  mimeType,
                  sizeBytes: file.size,
                  dataUrl,
                  ...(mimeType.startsWith("image/") ? { previewUrl: dataUrl } : {}),
                },
              ]);
            } else {
              setProgress((p) => [...p, { name: file.name, percent: 0 }]);
              const uploaded = await uploadToStorage(file, mimeType, (percent) =>
                setProgress((p) =>
                  p.map((item) => (item.name === file.name ? { ...item, percent } : item)),
                ),
              );
              setFiles((prev) => [
                ...prev,
                {
                  id: uploaded.id,
                  name: file.name,
                  mimeType,
                  sizeBytes: file.size,
                  storagePath: uploaded.storagePath,
                  ...(uploaded.previewUrl ? { previewUrl: uploaded.previewUrl } : {}),
                },
              ]);
            }
          } catch (error) {
            onError(error instanceof Error ? error.message : `Could not add ${file.name}.`);
          } finally {
            setProgress((p) => p.filter((item) => item.name !== file.name));
          }
        }
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const remove = useCallback((id: string) => {
    setFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target?.storagePath) {
        void supabase.storage.from(BUCKET).remove([target.storagePath]);
        void supabase.from("study_files").delete().eq("id", id);
      }
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  const clear = useCallback(() => setFiles([]), []);

  return { files, progress, busy, add, remove, clear };
}

/** Maps picker state onto the attachment shape the AI server functions accept. */
export function toAttachments(files: UploadedFile[]) {
  return files.map((f) => ({
    name: f.name,
    mimeType: f.mimeType,
    ...(f.dataUrl ? { dataUrl: f.dataUrl } : {}),
    ...(f.storagePath ? { storagePath: f.storagePath } : {}),
  }));
}

/** Deletes a stored study file (storage object + record). */
export function useDeleteStudyFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, storagePath }: { id: string; storagePath: string }) => {
      await supabase.storage.from(BUCKET).remove([storagePath]);
      const { error } = await supabase.from("study_files").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["study_files"] }),
  });
}
