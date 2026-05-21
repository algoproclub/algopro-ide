import toast from 'react-hot-toast';

const LSP_TOAST_STYLE = {
  // szda retheme phase one_02: LSP toasts use the active app theme tokens.
  borderRadius: '10px',
  background: 'var(--panel-bg-alt)',
  border: '1px solid var(--border-color)',
  color: 'var(--text-primary)',
};

export function notifyLsp(message: string) {
  toast(message, {
    style: LSP_TOAST_STYLE,
  });
}

export function notifyLspClosed(event: CloseEvent) {
  if (event.reason) {
    notifyLsp('Connection closed: ' + event.reason);
  } else if (event.wasClean) {
    notifyLsp('Connection closed');
  } else {
    notifyLsp('Connection closed unexpectedly');
  }
}
