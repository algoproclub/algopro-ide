import {
  LSPClient,
  Transport,
  languageServerExtensions,
} from '@codemirror/lsp-client';
import { useEffect, useState } from 'react';
import { EditorProps } from '../MonacoEditor/monaco-editor-types';
import { notifyLsp, notifyLspClosed } from '../lspNotifications';

const LSP_CONNECT_TIMEOUT_MS = 10000;

function createLspUrl(
  language: 'cpp' | 'python',
  compilerOptions: string | null
) {
  const url = new URL(
    `wss://thecodingwizard--lsp-server-main.modal.run:443/${
      language === 'cpp' ? 'clangd' : 'pyright'
    }`
  );

  if (language === 'cpp' && compilerOptions) {
    url.searchParams.set('compiler_options', compilerOptions);
  }

  return url.toString();
}

function simpleWebSocketTransport(
  uri: string,
  onSocketCreated: (socket: WebSocket) => void,
  timeoutMs = LSP_CONNECT_TIMEOUT_MS
): Promise<Transport> {
  let handlers: ((value: string) => void)[] = [];
  let settled = false;
  const socket = new WebSocket(uri);

  onSocketCreated(socket);

  socket.onmessage = event => {
    const value =
      typeof event.data === 'string' ? event.data : event.data.toString();

    for (const handler of handlers) {
      handler(value);
    }
  };

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timeoutId);
      socket.onopen = null;
      socket.onerror = null;
      socket.onclose = null;
    };

    const settle = (callback: () => void) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      callback();
    };

    const timeoutId = window.setTimeout(() => {
      settle(() => {
        if (
          socket.readyState === WebSocket.OPEN ||
          socket.readyState === WebSocket.CONNECTING
        ) {
          socket.close();
        }

        reject(new Error('LSP connection timed out'));
      });
    }, timeoutMs);

    socket.onopen = () => {
      settle(() => {
        resolve({
          send(message: string) {
            if (socket.readyState !== WebSocket.OPEN) {
              throw new Error('LSP transport is not connected');
            }

            socket.send(message);
          },
          subscribe(handler: (value: string) => void) {
            handlers.push(handler);
          },
          unsubscribe(handler: (value: string) => void) {
            handlers = handlers.filter(current => current !== handler);
          },
        });
      });
    };

    socket.onerror = () => {
      settle(() => {
        reject(new Error('Failed to connect to LSP server'));
      });
    };

    socket.onclose = event => {
      settle(() => {
        reject(
          new Error(
            `LSP connection closed before opening${
              event.reason ? `: ${event.reason}` : ''
            }`
          )
        );
      });
    };
  });
}

export default function useLspClient(
  language: EditorProps['language'],
  lspOptions: EditorProps['lspOptions']
) {
  const [lspClient, setLspClient] = useState<LSPClient | null>(null);

  useEffect(() => {
    if ((language !== 'cpp' && language !== 'python') || !lspOptions) {
      setLspClient(null);
      return;
    }

    const languageId: 'cpp' | 'python' = language;
    const compilerOptions = lspOptions.compilerOptions;

    setLspClient(null);

    let cancelled = false;
    let socket: WebSocket | null = null;
    let client: LSPClient | null = null;
    let sawSocketClose = false;

    const cleanup = () => {
      if (socket) {
        socket.removeEventListener('close', handleClose);
      }

      client?.disconnect();
      client = null;

      if (
        socket &&
        (socket.readyState === WebSocket.OPEN ||
          socket.readyState === WebSocket.CONNECTING)
      ) {
        socket.close();
      }

      socket = null;
    };

    function handleClose(event: CloseEvent) {
      sawSocketClose = true;
      cleanup();

      if (cancelled) {
        return;
      }

      notifyLspClosed(event);
      setLspClient(null);
    }

    async function connect() {
      notifyLsp('Connecting to server...');

      try {
        const transport = await simpleWebSocketTransport(
          createLspUrl(languageId, compilerOptions),
          createdSocket => {
            socket = createdSocket;
            socket.addEventListener('close', handleClose);
          }
        );

        if (cancelled || sawSocketClose) {
          cleanup();
          return;
        }

        const activeClient = new LSPClient({
          extensions: languageServerExtensions(),
        }).connect(transport);
        client = activeClient;

        await activeClient.initializing;

        if (cancelled || sawSocketClose) {
          cleanup();
          return;
        }

        setLspClient(activeClient);
        notifyLsp('Connected');
      } catch (error) {
        cleanup();

        if (cancelled || sawSocketClose) {
          return;
        }

        console.error('Failed to initialize CodeMirror LSP connection:', error);
        notifyLsp(
          'Connection failed: ' +
            (error instanceof Error ? error.message : 'Unknown error')
        );
        setLspClient(null);
      }
    }

    void connect();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [language, lspOptions?.compilerOptions]);

  return lspClient;
}
