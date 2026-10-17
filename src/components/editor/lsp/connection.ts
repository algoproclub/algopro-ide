import { isClangdWasmSupported } from '@algoproclub/clangd-wasm/support';
import type { MessageReader, MessageWriter } from 'vscode-jsonrpc';
import { openRemoteConnection } from './remote';
import {
  DEFAULT_LSP_MODES,
  readPageLspPreferences,
  type LspLanguage,
} from './preferences';

export interface LspConnection {
  reader: MessageReader;
  writer: MessageWriter;
  initializationOptions?: unknown;
  /** Undefined preserves the client's default. */
  rootUri?: string;
  dispose(): void;
}

/** The signal only cancels opening; the caller disposes the returned connection. */
export async function openLspConnection(options: {
  language: LspLanguage;
  compilerOptions: string | null;
  documentUri: string;
  signal: AbortSignal;
}): Promise<LspConnection> {
  options.signal.throwIfAborted();
  const mode =
    readPageLspPreferences()[options.language] ??
    DEFAULT_LSP_MODES[options.language];

  if (mode === 'local' && options.language === 'python') {
    const { openPythonConnection } = await import('./python');
    options.signal.throwIfAborted();
    return openPythonConnection(options.documentUri);
  }

  if (mode === 'local' && options.language === 'cpp') {
    if (!isClangdWasmSupported()) {
      throw new Error('Local C++ language services are not supported here');
    }
    const { openClangdConnection } = await import('./clangd');
    options.signal.throwIfAborted();
    return openClangdConnection(options);
  }

  return openRemoteConnection(options);
}
