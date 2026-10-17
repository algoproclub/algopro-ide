import {
  AbstractMessageReader,
  AbstractMessageWriter,
  Emitter,
  Message,
  type DataCallback,
} from 'vscode-jsonrpc';
import type { LspConnection } from './connection';

const PYRIGHT_CONFIG = JSON.stringify({
  typeshedPath: '/typeshed',
  typeCheckingMode: 'standard',
});

// BasedPyright sends worker-control and JSON-RPC messages through the same
// Worker. Keep its background-worker request out of the language client.
class PythonMessageReader extends AbstractMessageReader {
  private readonly messages = new Emitter<Message>();

  constructor(worker: Worker) {
    super();
    worker.addEventListener('message', event => {
      if (event.data?.type !== 'browser/newWorker') {
        this.messages.fire(event.data);
      }
    });
  }

  listen(callback: DataCallback) {
    return this.messages.event(callback);
  }

  fail(error: Error) {
    this.fireError(error);
    this.fireClose();
  }
}

// CodeMirror sends rootUri but not workspaceFolders. BasedPyright ignores
// rootUri and only creates a workspace from workspaceFolders or rootPath.
class PythonMessageWriter extends AbstractMessageWriter {
  constructor(
    private readonly worker: Worker,
    private readonly rootUri: string
  ) {
    super();
  }

  write(message: Message) {
    this.worker.postMessage(
      Message.isRequest(message) && message.method === 'initialize'
        ? {
            ...message,
            params: {
              ...message.params,
              workspaceFolders: [{ uri: this.rootUri, name: this.rootUri }],
            },
          }
        : message
    );
    return Promise.resolve();
  }

  end() {}
}

export function openPythonConnection(documentUri: string): LspConnection {
  const rootUri = new URL('.', documentUri).href;
  const configPath = decodeURIComponent(
    new URL('pyrightconfig.json', rootUri).pathname
  );
  const workers = new Set<Worker>();
  const workerUrl = new URL('./python.worker.ts', import.meta.url);

  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const worker of workers) worker.terminate();
    workers.clear();
    reader.dispose();
    writer.dispose();
  };
  const fail = (error: Error) => {
    if (disposed) return;
    reader.fail(error);
    dispose();
  };
  const createWorker = (name: string) => {
    const worker = new Worker(workerUrl, { type: 'module', name });
    workers.add(worker);
    worker.addEventListener('error', event => {
      fail(new Error(event.message || 'Python worker failed'));
    });
    worker.addEventListener('messageerror', () => {
      fail(new Error('Could not read a Python worker message'));
    });
    return worker;
  };

  const foreground = createWorker('BasedPyright foreground');
  const reader = new PythonMessageReader(foreground);
  const writer = new PythonMessageWriter(foreground, rootUri);

  let backgroundWorkerCount = 0;
  foreground.addEventListener('message', event => {
    if (disposed || event.data?.type !== 'browser/newWorker') return;
    const { initialData, port } = event.data;
    try {
      const background = createWorker(
        `BasedPyright background ${++backgroundWorkerCount}`
      );
      background.postMessage(
        { type: 'browser/boot', mode: 'background', initialData, port },
        [port]
      );
    } catch (error) {
      fail(error instanceof Error ? error : new Error(String(error)));
    }
  });
  foreground.postMessage({ type: 'browser/boot', mode: 'foreground' });

  return {
    reader,
    writer,
    rootUri,
    initializationOptions: {
      files: { [configPath]: PYRIGHT_CONFIG },
      disablePullDiagnostics: true,
    },
    dispose,
  };
}
