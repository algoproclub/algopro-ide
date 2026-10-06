import React, { useEffect, useState } from 'react';
import { EditModal, handleKeyDown } from './EditTextModal';
import { getPlatformName } from '../scripts/getPlatformName';
import { buildProblemUrl } from '../scripts/problemUtils';
import { useUserContext } from '../context/UserContext';
import type { Platform, ProblemData } from '../types/problem';

export default function ManualProblemDataModal({
  isOpen,
  platform,
  problemID,
  onSuccess,
  onClose,
}: {
  isOpen: boolean;
  platform: Platform;
  problemID: string;
  onSuccess: (problem: ProblemData) => void;
  onClose: () => void;
}) {
  const { firebaseUser } = useUserContext();
  const [html, setHtml] = useState('');
  const url = buildProblemUrl(platform, problemID);

  // This component can stay mounted across multiple problems (e.g. when
  // resolving several failed links in sequence), so clear any leftover
  // text from a previous problem whenever it's opened for a new one.
  useEffect(() => {
    if (isOpen) setHtml('');
  }, [isOpen, platform, problemID]);

  const submit = async (pastedHtml: string) => {
    const response = await fetch('/api/submitManualProblemData', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await firebaseUser.getIdToken()}`,
      },
      body: JSON.stringify({ platform, id: problemID, html: pastedHtml }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message ?? 'Could not save the pasted problem.');
    }
    setHtml('');
    onSuccess(data as ProblemData);
  };

  return (
    <EditModal<string>
      isOpen={isOpen}
      title={`Could not fetch ${getPlatformName(platform)} ${problemID}`}
      value={html}
      onSave={submit}
      onClose={onClose}
      renderEditor={(val, setVal) => (
        <div className="space-y-3">
          <p className="text-sm text-content-muted">
            Paste this problem&apos;s page HTML below, or cancel.
            {url && (
              <>
                {' '}
                Original page:{' '}
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-accent hover:text-accent-hover hover:underline"
                >
                  {url}
                </a>
                . To save the HTML, open the page, right-click, and choose
                &quot;View page source&quot;.
              </>
            )}
          </p>
          <textarea
            className="h-60 min-h-[10rem] w-full rounded-md border border-line bg-input p-3 font-mono text-sm text-content shadow-sm outline-none transition-colors hover:border-line-strong focus-visible:border-line-strong focus-visible:ring-2 focus-visible:ring-focus"
            value={val}
            onKeyDown={handleKeyDown}
            onChange={e => {
              setVal(e.target.value);
              setHtml(e.target.value);
            }}
          />
        </div>
      )}
    />
  );
}
