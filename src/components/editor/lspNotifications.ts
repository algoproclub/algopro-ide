import toast from 'react-hot-toast';

const LSP_TOAST_STYLE = {
  borderRadius: '10px',
  background: '#333',
  color: '#fff',
};
// átírni a retheme alapján

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
