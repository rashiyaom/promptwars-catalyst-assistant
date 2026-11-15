import { useLanguage } from '../../i18n/LanguageContext.js';
import React, { useEffect, useId, useRef } from 'react';

export interface ModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly children: React.ReactNode;
  readonly dismissible?: boolean;
  readonly drawer?: boolean;
}

/** Native modal dialog supplies focus containment, inert background, and focus restoration. */
export function Modal({
  isOpen,
  onClose,
  title,
  children,
  dismissible = true,
  drawer = false,
}: ModalProps): React.JSX.Element {
  const { t } = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    if (!isOpen || !element) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [isOpen]);
  return (
    <dialog
      ref={dialog}
      className={`modal-content${drawer ? ' emergency-drawer' : ''}`}
      aria-labelledby={titleId}
      aria-modal="true"
      onCancel={(event) => {
        event.preventDefault();
        if (dismissible) onClose();
      }}
      onClick={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          dismissible &&
          event.target === event.currentTarget &&
          (event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom)
        )
          onClose();
      }}
    >
      <div className="section-heading modal-heading">
        <h2 id={titleId}>{title}</h2>
        <button
          type="button"
          className="chip"
          disabled={!dismissible}
          onClick={onClose}
          aria-label={t('Close dialog')}
        >
          ✕
        </button>
      </div>
      {isOpen && children}
    </dialog>
  );
}
