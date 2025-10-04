import {
  MonacoLanguageClient,
  CloseAction,
  ErrorAction,
  MessageTransports,
} from 'monaco-languageclient';
import {
  toSocket,
  WebSocketMessageReader,
  WebSocketMessageWriter,
} from 'vscode-ws-jsonrpc';
import { useEffect } from 'react';
import { notifyLsp, notifyLspClosed } from '../lspNotifications';

function createLSPConnection(
  language: 'cpp' | 'python',
  compilerOptions: string | null
) {
  if (language !== 'cpp' && language !== 'python') {
    throw new Error('Unsupported LSP language: ' + language);
  }

  notifyLsp('Connecting to server...');
  const url = new URL(
    `wss://thecodingwizard--lsp-server-main.modal.run:443/${
      language === 'cpp' ? 'clangd' : 'pyright'
    }`
  );
  if (language === 'cpp' && compilerOptions) {
    url.searchParams.set('compiler_options', compilerOptions);
  }

  let webSocket: WebSocket | null = new WebSocket(url);
  let languageClient: MonacoLanguageClient | null;

  webSocket.addEventListener('open', () => {
    const socket = toSocket(webSocket!);
    const reader = new WebSocketMessageReader(socket);
    const writer = new WebSocketMessageWriter(socket);
    languageClient = createLanguageClient({
      reader,
      writer,
    });
    languageClient.start();
  });

  webSocket.addEventListener('message', event => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch (error) {
      console.error('Malformed message from LSP server:', event.data);
      return;
    }
    if (!webSocket) return;
    if (message.id === 0 && message.result?.capabilities) {
      // assume this is the first message from the server
      // and that connection is successfully established
      notifyLsp('Connected');
    }
  });

  webSocket.addEventListener('close', event => {
    if (event.wasClean) {
      console.log('Connection closed cleanly');
    } else {
      console.error('Connection died');
    }

    notifyLspClosed(event);

    if (languageClient) {
      languageClient.stop();
      languageClient = null;
    }
  });

  function createLanguageClient(
    transports: MessageTransports
  ): MonacoLanguageClient {
    return new MonacoLanguageClient({
      name: 'Sample Language Client',
      clientOptions: {
        // use a language id as a document selector
        documentSelector: [language],
        // disable the default error handler
        errorHandler: {
          error: (error, message, count) => {
            console.log(
              'Got error from monaco language client error handler',
              error,
              message,
              count
            );
            return {
              action: ErrorAction.Continue,
            };
          },
          closed: () => ({ action: CloseAction.DoNotRestart }),
        },
      },
      // create a language client connection from the JSON RPC connection on demand
      connectionProvider: {
        get: () => {
          return Promise.resolve(transports);
        },
      },
    });
  }

  function dispose() {
    if (!languageClient) {
      // possibly didn't connect to websocket before exiting
      if (webSocket && webSocket.readyState === webSocket.CONNECTING) {
        webSocket.close();
        webSocket = null;
      }
    } else {
      languageClient
        .stop()
        .catch(err => console.error('Error stopping language client:', err));
      languageClient = null;
    }
  }
  return dispose;
}

export default function useLSP(
  language: string | null,
  lspOptions: { compilerOptions: string | null } | null
) {
  useEffect(() => {
    if ((language === 'cpp' || language === 'python') && lspOptions) {
      return createLSPConnection(language, lspOptions.compilerOptions);
    }
  }, [language, lspOptions?.compilerOptions]);
}
