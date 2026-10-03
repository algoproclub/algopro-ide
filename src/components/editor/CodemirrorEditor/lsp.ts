import {
  LSPClient,
  type Transport,
  languageServerExtensions,
} from '@codemirror/lsp-client';
import type { Disposable } from 'vscode-jsonrpc';
import { useEffect, useState } from 'react';
import type { EditorProps } from '../editor-types';
import { openLspConnection, type LspConnection } from '../lsp/connection';
import { isLspLanguage } from '../lsp/preferences';
import { notifyLsp } from '../lspNotifications';

function clientTransport(
  connection: LspConnection,
  failed: (error: unknown) => void
): Transport {
  const handlers = new Set<(value: string) => void>();
  let listener: Disposable | undefined;
  return {
    send(message) {
      void connection.writer.write(JSON.parse(message)).catch(failed);
    },
    subscribe(handler) {
      handlers.add(handler);
      listener ??= connection.reader.listen(message => {
        const value = JSON.stringify(message);
        for (const receive of handlers) receive(value);
      });
    },
    unsubscribe(handler) {
      handlers.delete(handler);
      if (!handlers.size) {
        listener?.dispose();
        listener = undefined;
      }
    },
  };
}

export default function useLspClient(
  language: EditorProps['language'],
  lspOptions: EditorProps['lspOptions'],
  documentUri: string
) {
  const [client, setClient] = useState<LSPClient | null>(null);
  const enabled = !!lspOptions;
  const serviceLanguage = isLspLanguage(language) ? language : null;
  const compilerOptions =
    language === 'cpp' ? (lspOptions?.compilerOptions ?? null) : null;

  useEffect(() => {
    setClient(null);
    if (!enabled || !serviceLanguage) return;

    const controller = new AbortController();
    const { signal } = controller;
    let activeClient: LSPClient | undefined;
    let connection: LspConnection | undefined;
    const cleanup = () => {
      controller.abort();
      activeClient?.disconnect();
      activeClient = undefined;
      connection?.dispose();
    };
    const failed = (error: unknown) => {
      if (signal.aborted) return;
      console.error('CodeMirror language service failed:', error);
      notifyLsp(
        `Connection failed: ${error instanceof Error ? error.message : String(error)}`
      );
      setClient(null);
      cleanup();
    };

    void (async () => {
      notifyLsp('Connecting to language service…');

      connection = await openLspConnection({
        language: serviceLanguage,
        compilerOptions,
        documentUri,
        signal,
      });

      if (signal.aborted) {
        connection.dispose();
        return;
      }

      connection.reader.onClose(() =>
        failed(new Error('Language service disconnected'))
      );
      connection.reader.onError(failed);

      activeClient = new LSPClient({
        extensions: languageServerExtensions(),
        initializationOptions: connection.initializationOptions,
        rootUri: connection.rootUri,
        timeout: 15_000,
      }).connect(clientTransport(connection, failed));
      await activeClient.initializing;

      if (signal.aborted) return;

      setClient(activeClient);
      notifyLsp('Connected');
    })().catch(failed);
    return cleanup;
  }, [compilerOptions, documentUri, enabled, serviceLanguage]);
  return client;
}
