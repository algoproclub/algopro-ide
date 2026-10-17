import toast from 'react-hot-toast';

const LSP_TOAST_STYLE = {
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
