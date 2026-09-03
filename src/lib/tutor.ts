import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef } from "react";

import {
  gradeShortAnswers,
  generateFlashcards,
  generateQuiz,
  solveHomework,
  type Attachment,
  type QuizQuestionType,
} from "@/lib/tutor.functions";

export type { Attachment, QuizQuestionType };

export const ACCEPTED_TYPES = "image/*,application/pdf";
export const MAX_FILES = 4;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export async function fileToAttachment(file: File): Promise<Attachment> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`${file.name} is larger than 5MB.`);
  }
  const mimeType = file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "");
  if (!mimeType.startsWith("image/") && mimeType !== "application/pdf") {
    throw new Error(`${file.name} must be an image or a PDF.`);
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
  return { name: file.name, mimeType, dataUrl };
}

/** Wraps a mutation so overlapping AI requests can never be fired twice. */
function useGuardedMutation<TInput, TOutput>(fn: (input: TInput) => Promise<TOutput>) {
  const inFlight = useRef(false);
  const mutation = useMutation<TOutput, Error, TInput>({
    mutationFn: async (input) => {
      if (inFlight.current) throw new Error("A request is already running. Please wait.");
      inFlight.current = true;
      try {
        return await fn(input);
      } finally {
        inFlight.current = false;
      }
    },
  });
  return mutation;
}

export function useSolveHomework() {
  const call = useServerFn(solveHomework);
  return useGuardedMutation(async (data: { text?: string; attachments?: Attachment[] }) =>
    call({ data }),
  );
}

export function useGenerateFlashcards() {
  const call = useServerFn(generateFlashcards);
  return useGuardedMutation(
    async (data: { text?: string; attachments?: Attachment[]; count?: number }) => call({ data }),
  );
}

export function useGenerateQuiz() {
  const call = useServerFn(generateQuiz);
  return useGuardedMutation(
    async (data: {
      text?: string;
      attachments?: Attachment[];
      count?: number;
      difficulty?: string;
      types?: QuizQuestionType[];
    }) => call({ data }),
  );
}

export function useGradeShortAnswers() {
  const call = useServerFn(gradeShortAnswers);
  return useGuardedMutation(
    async (data: { items: { id: string; question: string; expected: string; response: string }[] }) =>
      call({ data }),
  );
}
