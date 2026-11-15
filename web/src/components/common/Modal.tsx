import React, { useEffect } from 'react';

export interface ModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly children: React.ReactNode;
}

/** Accessible base modal dialog foundation with ESC dismissal and backdrop click. */
export function Modal({ isOpen, onClose, title, children }: ModalProps): React.JSX.Element | null {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 34, 30, 0.65)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 1000,
        padding: '20px',
        backdropFilter: 'blur(3px)',
      }}
    >
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-headline"
        style={{
          background: '#ffffff',
          borderRadius: '24px',
          width: 'min(100%, 560px)',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: 'clamp(24px, 4vw, 36px)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.25)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 id="modal-headline" style={{ margin: 0, fontSize: '22px', color: '#143e38' }}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            style={{
              background: '#f0f6f3',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              fontSize: '18px',
              cursor: 'pointer',
              color: '#34554e',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
