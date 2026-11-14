import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fill, pick, t, type Lang } from '@/lib/i18n';
import type { Question, QuizItem } from '@/lib/quiz';
import { QuizConfetti } from './QuizConfetti';
import { EarliestUseEvidence } from './EarliestUseEvidence';
import './quiz-dialog.css';

type Props = {
  lang: Lang;
  question: Question;
  items: readonly QuizItem[];
  selectedId: string | null;
  onAnswer: (id: string) => void;
  onDismiss: () => void;
  onViewItem: (id: string) => void;
};

// These source images were reviewed for visible dates before entering the quiz.
const reviewedImages = new Set([
  '/images/microwave-oven.jpg',
  '/images/mobile-phone.jpg',
  '/images/computer-mouse.jpg',
]);

function QuizImage({ item, lang }: { item: QuizItem; lang: Lang }) {
  const [failed, setFailed] = useState(false);
  const name = pick(lang, item.name_zh, item.name_en, { ja: item.name_ja });
  if (item.image && reviewedImages.has(item.image.src) && !failed) {
    return (
      <img className="quiz-image" src={item.image.src} alt={name} onError={() => setFailed(true)} />
    );
  }
  return (
    <span className="quiz-image-placeholder" role="img" aria-label={name}>
      <span aria-hidden="true">?</span>
    </span>
  );
}

export default function QuizDialog({
  lang,
  question,
  items,
  selectedId,
  onAnswer,
  onDismiss,
  onViewItem,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const result = useRef<HTMLParagraphElement>(null);
  const accepted = useRef(selectedId !== null);
  const exitAction = useRef<(() => void) | null>(null);
  const [closing, setClosing] = useState(false);
  const revealed = selectedId !== null;
  const choices = [question.leftId, question.rightId].map((id) =>
    items.find((item) => item.id === id),
  );
  const earlier = items.find((item) => item.id === question.earlierId);

  useEffect(() => {
    const modal = dialog.current;
    const previous = document.activeElement;
    modal?.showModal();
    heading.current?.focus({ preventScroll: true });
    return () => {
      modal?.close();
      const fallback = document.querySelector<HTMLElement>('.topbar button, .topbar a');
      if (previous instanceof HTMLElement && previous.isConnected && previous !== document.body) {
        previous.focus({ preventScroll: true });
      } else fallback?.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    if (revealed) result.current?.focus({ preventScroll: true });
  }, [revealed]);

  const finishClose = useCallback(() => {
    const action = exitAction.current;
    if (!action) return;
    exitAction.current = null;
    dialog.current?.close();
    action();
  }, []);

  function close(itemId?: string) {
    if (exitAction.current) return;
    exitAction.current = itemId ? () => onViewItem(itemId) : onDismiss;
    setClosing(true);
  }

  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(finishClose, 200);
    return () => window.clearTimeout(timer);
  }, [closing, finishClose]);

  function answer(id: string) {
    if (accepted.current || closing) return;
    accepted.current = true;
    onAnswer(id);
  }

  return createPortal(
    <dialog
      ref={dialog}
      className={`quiz-dialog${closing ? ' is-closing' : ''}`}
      aria-labelledby="quiz-title"
      aria-describedby="quiz-rule"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          close();
      }}
      onAnimationEnd={(event) => {
        if (closing && event.target === event.currentTarget) finishClose();
      }}
    >
      {selectedId === question.earlierId && !closing && <QuizConfetti />}
      <header className="quiz-heading">
        <h2 id="quiz-title" ref={heading} tabIndex={-1}>
          {t(lang, 'quizTitle')}
        </h2>
        <button
          className="close-btn"
          type="button"
          aria-label={t(lang, 'close')}
          onClick={() => close()}
        >
          ×
        </button>
      </header>
      <div className="quiz-result-slot" aria-live="polite" aria-atomic="true">
        {revealed && earlier && (
          <p ref={result} tabIndex={-1} className="quiz-result">
            {selectedId === question.earlierId
              ? t(lang, 'quizCorrect')
              : fill(t(lang, 'quizEarlier'), {
                  name: pick(lang, earlier.name_zh, earlier.name_en, { ja: earlier.name_ja }),
                })}
          </p>
        )}
      </div>
      <div className="quiz-choices">
        {choices.map(
          (item) =>
            item && (
              <section
                key={item.id}
                className={`quiz-choice${revealed && item.id === question.earlierId ? ' is-earlier' : ''}`}
              >
                <button
                  type="button"
                  className="quiz-option"
                  disabled={revealed || closing}
                  onClick={() => answer(item.id)}
                >
                  <QuizImage item={item} lang={lang} />
                  <strong>{pick(lang, item.name_zh, item.name_en, { ja: item.name_ja })}</strong>
                </button>
                {revealed && (
                  <div className="quiz-evidence">
                    <p className="quiz-choice-label">
                      {item.id === question.earlierId ? t(lang, 'quizEarlierMark') : '\u00a0'}
                    </p>
                    <EarliestUseEvidence
                      earliestUse={item.earliest_use}
                      sources={item.sources}
                      lang={lang}
                    />
                    <button
                      type="button"
                      className="quiz-view"
                      onClick={() => close(item.id)}
                      disabled={closing}
                    >
                      {t(lang, 'quizView')} ↗
                    </button>
                  </div>
                )}
              </section>
            ),
        )}
      </div>
      <footer className="quiz-footer">
        <p id="quiz-rule">{t(lang, 'quizRule')}</p>
        <button type="button" className="quiz-dismiss" disabled={closing} onClick={() => close()}>
          {revealed ? t(lang, 'quizContinue') : t(lang, 'quizSkip')}
        </button>
      </footer>
    </dialog>,
    document.body,
  );
}
