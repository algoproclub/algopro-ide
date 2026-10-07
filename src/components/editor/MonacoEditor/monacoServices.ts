import { LogLevel } from '@codingame/monaco-vscode-api';
import '@codingame/monaco-vscode-theme-defaults-default-extension';
import {
  getEnhancedMonacoEnvironment,
  MonacoVscodeApiWrapper,
  type MonacoVscodeApiConfig,
} from 'monaco-languageclient/vscodeApiWrapper';
import { Uri } from 'vscode';

export const MONACO_VSCODE_DARK_THEME = 'Dark+';
export const MONACO_VSCODE_LIGHT_THEME = 'Light+';
export const MONACO_WORKSPACE_ROOT = '/workspace';
export const MONACO_WORKSPACE_URI = Uri.file(MONACO_WORKSPACE_ROOT);

let apiWrapper: MonacoVscodeApiWrapper | null = null;
let apiWrapperStartPromise: Promise<MonacoVscodeApiWrapper> | null = null;

function configureMonacoWorkerFactory() {
  const env = getEnhancedMonacoEnvironment();

  env.getWorker = (_workerId, label) => {
    if (label === 'TextMateWorker') {
      return new Worker(
        new URL('./workers/textmate.worker.js', import.meta.url),
        {
          type: 'module',
        }
      );
    }

    return new Worker(new URL('./workers/editor.worker.js', import.meta.url), {
      type: 'module',
    });
  };

  env.getWorkerUrl = undefined;
  env.getWorkerOptions = undefined;
}

function createMonacoVscodeApiConfig(): MonacoVscodeApiConfig {
  return {
    $type: 'extended',
    viewsConfig: {
      $type: 'EditorService',
    },
    logLevel: LogLevel.Off,
    advanced: {
      enforceSemanticHighlighting: true,
      loadExtensionServices: false,
      loadThemes: false,
    },
    userConfiguration: {
      json: JSON.stringify({
        'workbench.colorTheme': MONACO_VSCODE_DARK_THEME,
        'editor.experimental.asyncTokenization': true,
        'editor.wordBasedSuggestions': 'off',
        '[html]': {
          'editor.wordWrap': 'on',
        },
      }),
    },
    monacoWorkerFactory: configureMonacoWorkerFactory,
  };
}

export async function ensureMonacoServices(): Promise<MonacoVscodeApiWrapper> {
  if (apiWrapper) {
    return apiWrapper;
  }

  if (!apiWrapperStartPromise) {
    const wrapper = new MonacoVscodeApiWrapper(createMonacoVscodeApiConfig());

    apiWrapperStartPromise = wrapper
      .start({ caller: 'AlgoPro MonacoEditor' })
      .then(() => {
        apiWrapper = wrapper;
        return wrapper;
      })
      .catch(error => {
        apiWrapperStartPromise = null;
        apiWrapper = null;
        throw error;
      });
  }

  return apiWrapperStartPromise;
}
