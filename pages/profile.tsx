import React, { useEffect, useState, useRef } from 'react';
import { ConfirmOverrideModal } from '../src/components/ConfirmOverrideModal';
import { useSetAtom } from 'jotai';
import { signInWithGoogleAtom } from '../src/atoms/firebaseUserAtoms';
import { useConnectionContext } from '../src/context/ConnectionContext';
import { useNullableUserContext } from '../src/context/UserContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import UserSettings from '../src/components/settings/UserSettings';
import ProfileStatus from '../src/components/settings/ProfileStatus';
import {
    getDatabase,
    ref,
    orderByChild,
    query,
    onValue,
    set,
    child,
    off,
    update,
    push,
    serverTimestamp,
    DataSnapshot,
    get,
} from 'firebase/database';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import {
    EditorMode,
    Language,
    useUserContext,
} from '../src/context/UserContext';


const firestore = getFirestore();
const db = getDatabase();



export default function ProfilePage(): JSX.Element {
    const [name, setName] = useState<string>('');
    const [cfUsername, setCfUsername] = useState<string>('');
    const [atcoderUsername, setAtcoderUsername] = useState<string>('');
    const [discordID, setDiscordID] = useState<string>('');
    const [defaultLanguage, setDefaultLanguage] = useState<Language>('cpp');
    const [editorMode, setEditorMode] = useState<EditorMode>('Normal');
    const [tabSize, setTabSize] = useState<number>(-1);
    const [lightMode, setLightMode] = useState<boolean>(false);
    const [manualSubmission, setManualSubmission] = useState<boolean>(false);
    const [templateCode, setTemplateCode] = useState<
    Partial<Record<Language, string>>
    >({});
    const [templateLanguage, setTemplateLanguage] = useState<Language>('cpp');
    const dirtyRef = useRef<boolean>(false);

    const [settings, setSettings] = useState<{}>({});

    /*const {
        userData,
        firebaseUser,
        updateUsername,
        templateCode: savedTemplateCode,
    } = useUserContext();*/

    useEffect(() => {
        setSettings({
            "Name":name,
            "Codeforces Username":cfUsername,
            "AtCoder Username":atcoderUsername,
            "Discord ID":discordID,
            "Default Language":defaultLanguage,
            "Editor Mode":editorMode,
            "Tab Size":tabSize,
            "Lightmode":lightMode,
            "Manual Submission":manualSubmission,
            "Template Code":templateCode,
            "Template Language":templateLanguage,
        });
    }, [
        name,
        cfUsername,
        atcoderUsername,
        discordID,
        defaultLanguage,
        editorMode,
        tabSize,
        lightMode,
        manualSubmission,
        templateCode,
        templateLanguage,
    ]);

    return (
        <div className="p-4 sm:p-6 md:p-8 lg:p-12 min-h-full flex flex-col max-w-6xl mx-auto">
            <h1 className="text-gray-100 text-2xl md:text-4xl font-black">
                Profile
            </h1>
            <ProfileStatus 
                settings={settings}
            />
            <UserSettings
                name={name}
                onNameChange={name => {
                    setName(name);
                }}
                cfUsername={cfUsername}
                onCfUsernameChange={cfUsername => {
                    setCfUsername(cfUsername);
                    dirtyRef.current = true;
                }}
                atcoderUsername={atcoderUsername}
                onAtcoderUsernameChange={atcoderUsername => {
                    setAtcoderUsername(atcoderUsername);
                    dirtyRef.current = true;
                }}
                discordID={discordID}
                onDiscordIDChange={discordID => {
                    setDiscordID(discordID);
                    dirtyRef.current = true;
                }}
                defaultLanguage={defaultLanguage}
                onDefaultLanguageChange={language => {
                    setDefaultLanguage(language);
                    dirtyRef.current = true;
                }}
                editorMode={editorMode}
                onEditorModeChange={mode => {
                    setEditorMode(mode);
                    dirtyRef.current = true;
                }}
                tabSize={tabSize}
                onTabSizeChange={size => {
                    setTabSize(size);
                    dirtyRef.current = true;
                }}
                lightMode={lightMode}
                onLightModeChange={lightMode => {
                    setLightMode(lightMode);
                    dirtyRef.current = true;
                }}
                manualSubmission={manualSubmission}
                onManualSubmissionChange={manualSubmission => {
                    setManualSubmission(manualSubmission);
                    dirtyRef.current = true;
                }}
                templateCode={templateCode}
                onTemplateCodeChange={code => {
                    setTemplateCode(code);
                    dirtyRef.current = true;
                }}
                language={templateLanguage}
                onLanguageChange={setTemplateLanguage}
            />
        </div>
    )
}