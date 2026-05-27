import { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

export default function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return;
    function onEsc(e) { if (e.key === 'Escape') onClose?.(); }
    window.addEventListener('keydown', onEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onEsc);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className={cn(
        'relative w-full overflow-hidden rounded-2xl bg-white shadow-xl',
        sizes[size] || sizes.md
      )}>
        <header className="flex items-center justify-between border-b border-ink-200 px-5 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-ink-500 hover:bg-ink-100">
            <X size={18} />
          </button>
        </header>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-5">{children}</div>
        {footer && (
          <footer className="flex justify-end gap-2 border-t border-ink-200 bg-ink-50 px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
