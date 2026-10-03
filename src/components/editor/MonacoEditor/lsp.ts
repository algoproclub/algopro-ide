import { useEffect } from 'react';
import {
  LanguageClientWrapper,
  LcWebSocket,
  type LanguageClientConfig,
} from 'monaco-languageclient/lcwrapper';
import { notifyLsp } from '../lspNotifications';
import { ensureMonacoServices, MONACO_WORKSPACE_URI } from './monacoServices';

type SupportedLanguage = 'cpp' | 'python';

function createLanguageClientConfig(
  language: 'cpp' | 'python',
  compilerOptions: string | null
): LanguageClientConfig {
  const url = new URL(
    `${process.env.NEXT_PUBLIC_LSP_URL}/${
      language === 'cpp' ? 'clangd' : 'pyright'
    }`
  );
  if (language === 'cpp' && compilerOptions) {
    url.searchParams.set('compiler_options', compilerOptions);
  }

  return {
    languageId: language,
    clientOptions: {
      documentSelector: [language],
      workspaceFolder: {
        index: 0,
        name: 'workspace',
        uri: MONACO_WORKSPACE_URI,
      },
    },
    connection: {
      options: {
        $family: 'WebSocket',
        webSocketUrl: url.toString(),
        realization: () => new LcWebSocket(),
        // LcWebSocket keeps its socket open on dispose unless asked not to.
        disposeResources: true,
      },
    },
  };
}

function isSupportedLanguage(
  language: string | null
): language is SupportedLanguage {
  return language === 'cpp' || language === 'python';
}

function disposeLanguageClient(languageClientWrapper: LanguageClientWrapper) {
  return Promise.resolve(languageClientWrapper.dispose()).catch(error => {
    console.error('Error disposing language client:', error);
  });
}

let pendingLanguageClientTeardown = Promise.resolve();

export default function useLSP(
  language: string | null,
  lspOptions: { compilerOptions: string | null } | null,
  enabled: boolean
) {
  const compilerOptions =
    language === 'cpp' ? (lspOptions?.compilerOptions ?? null) : null;
  const hasLspOptions = lspOptions !== null;

  useEffect(() => {
    if (!enabled || !isSupportedLanguage(language) || !hasLspOptions) {
      return;
    }

    let disposed = false;
    let languageClientWrapper: LanguageClientWrapper | null = null;
    const previousLanguageClientTeardown = pendingLanguageClientTeardown;

    const lifecyclePromise = previousLanguageClientTeardown
      .then(ensureMonacoServices)
      .then(async () => {
        if (disposed) {
          return;
        }

        notifyLsp('Connecting to server…');

        const wrapper = new LanguageClientWrapper(
          createLanguageClientConfig(language, compilerOptions)
        );
        languageClientWrapper = wrapper;

        await wrapper.start();

        if (!disposed) {
          notifyLsp('Connected');
        }
      })
      .catch(error => {
        console.error('Failed to start language client:', error);

        if (!disposed) {
          notifyLsp('Failed to connect to server');
        }
      });

    return () => {
      disposed = true;
      // The next editor must not start until this client has finished both
      // starting and disposing; the wrapper cannot dispose while starting.
      pendingLanguageClientTeardown = lifecyclePromise.then(() =>
        languageClientWrapper
          ? disposeLanguageClient(languageClientWrapper)
          : undefined
      );
    };
  }, [compilerOptions, enabled, hasLspOptions, language]);
}
