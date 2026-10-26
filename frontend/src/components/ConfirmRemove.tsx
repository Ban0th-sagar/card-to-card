import { useEffect, useRef } from "react";
import { Trash2 } from "lucide-react";
export default function ConfirmRemove({
  name,
  busy,
  error,
  cancel,
  confirm,
}: {
  name: string;
  busy: boolean;
  error: string;
  cancel: () => void;
  confirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="confirm-dialog"
      aria-labelledby="remove-title"
      aria-describedby="remove-description"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) cancel();
      }}
    >
      <div className="remove-icon">
        <Trash2 size={25} />
      </div>
      <h2 id="remove-title">Remove this card?</h2>
      <p id="remove-description">
        {name} will be removed from your workspace and dashboard. This cannot be
        undone.
      </p>
      {error && (
        <div className="message error" role="alert">
          {error}
        </div>
      )}
      <div className="form-actions">
        <button
          className="secondary-button"
          autoFocus
          disabled={busy}
          onClick={cancel}
        >
          Cancel
        </button>
        <button className="danger-button" disabled={busy} onClick={confirm}>
          {busy ? "Removing…" : "Remove Card"}
        </button>
      </div>
    </dialog>
  );
}
