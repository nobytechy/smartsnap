import Modal from './Modal';

export default function ConfirmDialog({ open, onClose, onConfirm, title, body, confirmLabel = 'Confirm', danger = true, busy = false }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button onClick={onClose} className="btn-ghost" disabled={busy}>Cancel</button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={
              danger
                ? 'inline-flex items-center justify-center gap-2 rounded-lg bg-burgundy-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-burgundy-700 disabled:opacity-60'
                : 'btn-primary'
            }
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-ink-700">{body}</p>
    </Modal>
  );
}
