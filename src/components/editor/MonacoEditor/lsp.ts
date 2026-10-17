import { useEffect } from 'react';
import { MonacoLanguageClient } from 'monaco-languageclient';
import { CloseAction, ErrorAction } from 'vscode-languageclient';
import { Uri } from 'vscode';
import type { EditorLspOptions } from '../editor-types';
import { openLspConnection, type LspConnection } from '../lsp/connection';
import { isLspLanguage, type LspLanguage } from '../lsp/preferences';
import { notifyLsp } from '../lspNotifications';
import { ensureMonacoServices, MONACO_WORKSPACE_URI } from './monacoServices';

function createLanguageClient(
  language: LspLanguage,
  connection: LspConnection
) {
  const rootUri =
    connection.rootUri === undefined
      ? MONACO_WORKSPACE_URI
      : Uri.parse(connection.rootUri);

  const client: MonacoLanguageClient = new MonacoLanguageClient({
    id: language,
    name: `${language} language client`,
    messageTransports: connection,
    clientOptions: {
      documentSelector: [language],
      workspaceFolder: { index: 0, name: 'workspace', uri: rootUri },
      initializationOptions: connection.initializationOptions,
      // The default handler restarts the client, which would reuse the
      // connection's closed transports. Startup failures reject start().
      errorHandler: {
        error: () => ({ action: ErrorAction.Continue }),
        closed: () => {
          // Stopping a client on cleanup leaves the running state first.
          if (client.isRunning()) {
            notifyLsp('Connection failed: Language service disconnected');
          }
          return { action: CloseAction.DoNotRestart, handled: true };
        },
      },
    },
  });
  return client;
}

async function disposeLanguageClient(
  client: MonacoLanguageClient | undefined,
  connection: LspConnection | undefined
) {
  try {
    await client?.dispose();
  } catch (error) {
    console.error('Error disposing language client:', error);
  } finally {
    connection?.dispose();
  }
}

let pendingLanguageClientTeardown = Promise.resolve();

export default function useLSP(
  language: string | null,
  lspOptions: EditorLspOptions | null,
  editorReady: boolean,
  modelPath: string
) {
  const compilerOptions =
    language === 'cpp' ? (lspOptions?.compilerOptions ?? null) : null;
  const enabled = editorReady && lspOptions !== null;
  // EditorApp creates the model with the same parse of its path.
  const documentUri = Uri.parse(modelPath).toString();

  useEffect(() => {
    if (!enabled || !isLspLanguage(language)) {
      return;
    }

    const controller = new AbortController();
    const { signal } = controller;
    let connection: LspConnection | undefined;
    let client: MonacoLanguageClient | undefined;

    const lifecycle = (async () => {
      try {
        await pendingLanguageClientTeardown;
        await ensureMonacoServices();
        signal.throwIfAborted();

        notifyLsp('Connecting to language service…');

        connection = await openLspConnection({
          language,
          compilerOptions,
          documentUri,
          signal,
        });
        signal.throwIfAborted();

        client = createLanguageClient(language, connection);
        await client.start();

        if (!client.isRunning()) {
          throw new Error('Language service closed during initialization');
        }
        signal.throwIfAborted();

        notifyLsp('Connected');

        // A running client must stop synchronously: later effects in the same
        // commit may still edit its model, and a stopping client then fails.
        await new Promise<void>(resolve =>
          signal.addEventListener('abort', () =>
            resolve(disposeLanguageClient(client, connection))
          )
        );
      } catch (error) {
        if (!signal.aborted) {
          console.error('Failed to start language client:', error);
          notifyLsp(
            `Connection failed: ${error instanceof Error ? error.message : String(error)}`
          );
        }

        await disposeLanguageClient(client, connection);
      }
    })();

    return () => {
      controller.abort();
      pendingLanguageClientTeardown = lifecycle;
    };
  }, [compilerOptions, documentUri, enabled, language]);
}
