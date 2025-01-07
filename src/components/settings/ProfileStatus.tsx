import { RadioGroup } from '@headlessui/react';
import classNames from 'classnames';
import React, { useState } from 'react';
import { EditorMode, Language, LANGUAGES } from '../../context/UserContext';
import { RadioGroupContents } from './RadioGroupContents';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import TemplateCodeSettings from './TemplateCodeSettings';
import { CircularProgressbar } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';


const EDITOR_MODES = ['Normal', 'Vim' /*'Emacs'*/];

export const SUBMENUS = [
  'main',
  'userdata',
  'codesettings',
  'visualsettings',
  'filetemplates',
];

export type Submenu = (typeof SUBMENUS)[number];

const UserDataSettings = ({
  name,
  onNameChange,
  cfUsername,
  onCfUsernameChange,
  atcoderUsername,
  onAtcoderUsernameChange,
  discordID,
  onDiscordIDChange,
}: {
  name: string;
  onNameChange: (name: string) => void;
  cfUsername: string;
  onCfUsernameChange: (cfUsername: string) => void;
  atcoderUsername: string;
  onAtcoderUsernameChange: (atcoderUsername: string) => void;
  discordID: string;
  onDiscordIDChange: (discordID: string) => void;
}) => {
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor={`name`} className="block text-[0.92rem] text-gray-300">
          Username
        </label>
        <div>
          <input
            type="text"
            name={`name`}
            id={`name`}
            className="text-input"
            value={name}
            onChange={e => {
              onNameChange(e.target.value);
            }}
          />
        </div>
      </div>
      <div>
        <label
          htmlFor={`cf-username`}
          className="block text-[0.92rem] text-gray-300"
        >
          Codeforces username
        </label>
        <div>
          <input
            type="text"
            name={`cf-username`}
            id={`cf-username`}
            className="text-input"
            value={cfUsername}
            onChange={e => {
              onCfUsernameChange(e.target.value);
            }}
          />
        </div>
      </div>
      <div>
        <label
          htmlFor={`atcoder-username`}
          className="block text-[0.92rem] text-gray-300"
        >
          AtCoder username
        </label>
        <div>
          <input
            type="text"
            name={`atcoder-username`}
            id={`atcoder-username`}
            className="text-input"
            value={atcoderUsername}
            onChange={e => {
              onAtcoderUsernameChange(e.target.value);
            }}
          />
        </div>
      </div>
      <div>
        <label
          htmlFor={`discord-username`}
          className="block text-[0.92rem] text-gray-300"
        >
          Discord user ID
        </label>
        <div>
          <input
            type="text"
            name={`discord-username`}
            id={`discord-username`}
            className="text-input"
            value={discordID}
            onChange={e => {
              onDiscordIDChange(e.target.value);
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default function ProfileStatus({
    settings
}: {
  settings: {}
}): JSX.Element {
    const totalSettings = Object.keys(settings).length;
    const filledSettings = Object.values(settings).filter(value => {
        // Define what constitutes an "unclicked" setting
        if (value === '' || value === null || value === undefined || value===-1) {
            return false;
        }
        // Add any other conditions for default values if necessary
        return true;
    }).length;

    const unfilledSettings = Object.keys(settings).filter(key => {
        if (settings[key] === '' || settings[key] === null || settings[key] === undefined || settings[key] === -1) {
            return true;
        }
        return false;
    })


    const percentage = Math.round((filledSettings / totalSettings) * 100);
    console.log(settings);

    /*if (percentage === 100) {
        return (
            <div>
            </div>
        );
    }*/

    return (
        <div>
            <div style={{ width: 75, height: 75 }}>
                <CircularProgressbar value={percentage} text={`${percentage}%`} />
            </div>
            <p>{unfilledSettings.join(', ')}</p>
        </div>
    );
}
