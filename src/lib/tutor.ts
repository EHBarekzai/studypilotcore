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
