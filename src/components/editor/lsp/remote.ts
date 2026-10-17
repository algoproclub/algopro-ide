import {
  WebSocketMessageReader,
  WebSocketMessageWriter,
} from 'vscode-ws-jsonrpc';
import type { LspConnection } from './connection';
import type { LspLanguage } from './preferences';

export async function openRemoteConnection({
  language,
  compilerOptions,
  signal,
}: {
  language: LspLanguage;
  compilerOptions: string | null;
  signal: AbortSignal;
}): Promise<LspConnection> {
  const url = new URL(
    `${process.env.NEXT_PUBLIC_LSP_URL}/${language === 'cpp' ? 'clangd' : 'pyright'}`
  );
  if (language === 'cpp' && compilerOptions) {
    url.searchParams.set('compiler_options', compilerOptions);
  }
  const socket = new WebSocket(url);
  await new Promise<void>((resolve, reject) => {
    const finish = (error?: Error) => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      socket.removeEventListener('open', opened);
      socket.removeEventListener('error', failed);
      socket.removeEventListener('close', failed);
      if (error) {
        socket.close();
        reject(error);
      } else {
        resolve();
      }
    };
    const opened = () => finish();
    const failed = () => finish(new Error('LSP connection failed'));
    const abort = () => finish(signal.reason);
    const timer = setTimeout(
      () => finish(new Error('LSP connection timed out')),
      10_000
    );
    signal.addEventListener('abort', abort, { once: true });
    socket.addEventListener('open', opened);
    socket.addEventListener('error', failed);
    socket.addEventListener('close', failed);
  });

  const reader = new WebSocketMessageReader(socket);
  const writer = new WebSocketMessageWriter(socket);
  return {
    reader,
    writer,
    dispose() {
      reader.dispose();
      writer.dispose();
      socket.close();
    },
  };
}
