import { useEffect } from 'react';
import {
  LanguageClientWrapper,
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
    `wss://thecodingwizard--lsp-server-main.modal.run:443/${
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
        $type: 'WebSocketUrl',
        url: url.toString(),
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

export default function useLSP(
  language: string | null,
  lspOptions: { compilerOptions: string | null } | null,
  enabled: boolean
) {
  const compilerOptions = lspOptions?.compilerOptions ?? null;
  const hasLspOptions = lspOptions !== null;

  useEffect(() => {
    if (!enabled || !isSupportedLanguage(language) || !hasLspOptions) {
      return;
    }

    let disposed = false;
    let languageClientWrapper: LanguageClientWrapper | null = null;
    let disposePromise: Promise<void> | null = null;

    const stopLanguageClient = (wrapper: LanguageClientWrapper) => {
      if (!disposePromise) {
        disposePromise = disposeLanguageClient(wrapper);
      }

      return disposePromise;
    };

    notifyLsp('Connecting to server…');

    void ensureMonacoServices()
      .then(async () => {
        if (disposed) {
          return;
        }

        const wrapper = new LanguageClientWrapper(
          createLanguageClientConfig(language, compilerOptions)
        );
        languageClientWrapper = wrapper;

        await wrapper.start();

        if (disposed) {
          await stopLanguageClient(wrapper);
          return;
        }

        notifyLsp('Connected');
      })
      .catch(error => {
        console.error('Failed to start language client:', error);

        if (!disposed) {
          notifyLsp('Failed to connect to server');
        }
      });

    return () => {
      disposed = true;

      if (languageClientWrapper) {
        const wrapper = languageClientWrapper;
        languageClientWrapper = null;
        void stopLanguageClient(wrapper);
      }
    };
  }, [compilerOptions, enabled, hasLspOptions, language]);
}
