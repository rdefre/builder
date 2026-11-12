import { useEffect, useId, useRef, type ReactNode } from 'react';

export default function LocalDashboardDialog({ title, onClose, children }: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  return (
    <dialog ref={dialog} aria-labelledby={titleId} onClose={onClose}
      className="m-auto w-[min(92vw,430px)] rounded-lg border border-[var(--border-light)] bg-[var(--bg-surface)] p-5 text-[var(--text-primary)] shadow-xl backdrop:bg-black/50">
      <header className="mb-4 flex items-center justify-between gap-4">
        <h2 id={titleId} className="text-sm font-semibold">{title}</h2>
        <button type="button" aria-label="Close dialog" onClick={() => dialog.current?.close()}
          className="rounded px-2 text-lg leading-6 hover:bg-[var(--bg-hover)]">×</button>
      </header>
      {children}
    </dialog>
  );
}
