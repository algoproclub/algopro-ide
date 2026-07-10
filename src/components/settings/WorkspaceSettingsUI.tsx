import React from 'react';
import { FileSettings } from '../../context/EditorContext';
import { LANGUAGES } from '../../context/UserContext';
import { SharingPermissions } from '../SharingPermissions';
import { RadioGroupContents } from './RadioGroupContents';

export default function WorkspaceSettingsUI({
  workspaceSettings,
  onWorkspaceSettingsChange,
  userPermission,
}: {
  workspaceSettings: FileSettings;
  onWorkspaceSettingsChange: (settings: Partial<FileSettings>) => void;
  userPermission: string;
}): JSX.Element {
  return (
    <div className="space-y-6 mb-4">
      {
        <div>
          <label
            htmlFor={`workspace_name`}
            className="block text-[0.92rem] text-[color:var(--text-secondary)]"
          >
            Workspace name
          </label>
          <div>
            <input
              type="text"
              name={`workspace_name`}
              id={`workspace_name`}
              className="text-input"
              value={workspaceSettings.workspaceName || ''}
              onChange={e =>
                (userPermission === 'OWNER' ||
                  userPermission === 'READ_WRITE') &&
                onWorkspaceSettingsChange({
                  workspaceName: e.target.value,
                })
              }
              disabled={
                !(userPermission === 'OWNER' || userPermission === 'READ_WRITE')
              }
            />
          </div>
        </div>
      }

      <RadioGroupContents
        title="Language"
        value={workspaceSettings.language}
        onChange={val =>
          onWorkspaceSettingsChange({
            language: val,
          })
        }
        disabled={
          !(userPermission === 'OWNER' || userPermission === 'READ_WRITE')
        }
        options={LANGUAGES}
        lightMode={false}
        className="text-[color:var(--text-primary)] text-[0.92rem] font-medium"
      />

      <div>
        <label
          htmlFor={`compiler_options`}
          className="block text-[0.92rem] text-[color:var(--text-secondary)]"
        >
          {LANGUAGES.find(x => x.value === workspaceSettings.language)!.label}{' '}
          compiler options
        </label>
        <div>
          <input
            type="text"
            name={`compiler_options`}
            id={`compiler_options`}
            className="text-input !font-mono !text-[0.85rem]"
            value={
              workspaceSettings.compilerOptions[workspaceSettings.language]
            }
            placeholder="None"
            onChange={e =>
              (userPermission === 'OWNER' || userPermission === 'READ_WRITE') &&
              onWorkspaceSettingsChange({
                compilerOptions: {
                  ...workspaceSettings.compilerOptions,
                  [workspaceSettings.language]: e.target.value,
                },
              })
            }
            disabled={
              !(userPermission === 'OWNER' || userPermission === 'READ_WRITE')
            }
          />
        </div>
      </div>

      <SharingPermissions
        value={workspaceSettings.defaultPermission}
        onChange={val =>
          userPermission === 'OWNER' &&
          onWorkspaceSettingsChange({ defaultPermission: val })
        }
        lightMode={false}
        isOwner={userPermission === 'OWNER'}
        className="text-[color:var(--text-primary)] text-[0.92rem] font-medium"
      />
    </div>
  );
}
