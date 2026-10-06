import { openClangdSession } from '@algoproclub/clangd-wasm';
import {
  AbstractMessageReader,
  AbstractMessageWriter,
  Emitter,
  type DataCallback,
  type Message,
} from 'vscode-jsonrpc';
import type { LspConnection } from './connection';

class ClangdMessageReader extends AbstractMessageReader {
  private readonly messages = new Emitter<Message>();

  constructor(port: MessagePort, closed: Promise<Error>) {
    super();
    port.addEventListener('message', event => this.messages.fire(event.data));
    void closed.then(error => {
      this.fireError(error);
      this.fireClose();
    });
  }

  listen(callback: DataCallback) {
    return this.messages.event(callback);
  }
}

class ClangdMessageWriter extends AbstractMessageWriter {
  constructor(private readonly port: MessagePort) {
    super();
  }

  write(message: Message) {
    this.port.postMessage(message);
    return Promise.resolve();
  }

  end() {}
}

export async function openClangdConnection({
  compilerOptions,
  documentUri,
  signal,
}: {
  compilerOptions: string | null;
  documentUri: string;
  signal: AbortSignal;
}): Promise<LspConnection> {
  const session = await openClangdSession({
    compilerArguments: compilerOptions ?? undefined,
    signal,
    uri: documentUri,
  });

  const reader = new ClangdMessageReader(session.port, session.closed);
  const writer = new ClangdMessageWriter(session.port);
  return {
    reader,
    writer,
    dispose() {
      reader.dispose();
      writer.dispose();
      session.dispose();
    },
  };
}
