import type { Question, QuizDataset } from './quiz';

export type QuizSnapshot =
  | { phase: 'idle' | 'loading' | 'dismissed' }
  | { phase: 'question'; question: Question; dataset: QuizDataset }
  | { phase: 'revealed'; question: Question; dataset: QuizDataset; selectedId: string };

type LoadedQuestion = { question: Question; dataset: QuizDataset };

/** A document keeps its current question across component remounts. Only open starts a game. */
export function createQuizLifecycle() {
  let snapshot: QuizSnapshot = { phase: 'idle' };
  let request = 0;
  const listeners = new Set<() => void>();

  function publish(next: QuizSnapshot) {
    snapshot = next;
    listeners.forEach((listener) => listener());
  }

  return {
    getSnapshot: (): QuizSnapshot => snapshot,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async open(loader: () => Promise<LoadedQuestion>): Promise<void> {
      if (
        snapshot.phase === 'loading' ||
        snapshot.phase === 'question' ||
        snapshot.phase === 'revealed'
      )
        return;
      const currentRequest = ++request;
      publish({ phase: 'loading' });
      try {
        const loaded = await loader();
        if (request === currentRequest) publish({ phase: 'question', ...loaded });
      } catch {
        if (request === currentRequest) publish({ phase: 'dismissed' });
      }
    },
    answer(questionId: string, selectedId: string): void {
      if (snapshot.phase !== 'question' || snapshot.question.id !== questionId) return;
      const { question } = snapshot;
      if (selectedId !== question.leftId && selectedId !== question.rightId) return;
      publish({ ...snapshot, phase: 'revealed', selectedId });
    },
    dismiss(): void {
      request++;
      if (snapshot.phase !== 'dismissed') publish({ phase: 'dismissed' });
    },
  };
}

export type QuizLifecycle = ReturnType<typeof createQuizLifecycle>;
const documents = new WeakMap<Document, QuizLifecycle>();

/** Call only in the browser. No timers or visibility listeners can open the game. */
export function getQuizLifecycle(document: Document): QuizLifecycle {
  const existing = documents.get(document);
  if (existing) return existing;
  const lifecycle = createQuizLifecycle();
  documents.set(document, lifecycle);
  return lifecycle;
}
