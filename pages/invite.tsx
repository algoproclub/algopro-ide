import WithTeacherLogin from '../src/components/WithTeacherLogin';
import Dropdown from '../src/components/Dropdown';
import React, { useEffect, useState } from 'react';
import { fetchTeacherSchools } from './teacher';
import { useUserContext } from '../src/context/UserContext';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { CopyButton } from '../src/components/CopyButton';
import PageTitle from '../src/components/PageTitle';

const generateToken = httpsCallable<
  { schoolID: string; expTime: number },
  string | null
>(getFunctions(undefined, 'europe-west1'), 'generateToken');

const expTimes = [
  { label: '3 days', time: 3 * 24 * 60 * 60 * 1000 },
  { label: '7 days', time: 7 * 24 * 60 * 60 * 1000 },
  { label: '14 days', time: 14 * 24 * 60 * 60 * 1000 },
];

const PageContent = () => {
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [schoolInd, setSchoolInd] = useState(0);
  const [expInd, setExpInd] = useState(0);
  const [link, setLink] = useState('');
  const { userRole } = useUserContext();

  useEffect(() => {
    const initSchools = async () => {
      const schools = await fetchTeacherSchools(userRole);
      setSchools(schools);
    };
    initSchools();
  }, [userRole]);

  const generateLink = () => {
    generateToken({
      schoolID: schools[schoolInd].id,
      expTime: expTimes[expInd].time,
    }).then(res => {
      if (res.data) {
        setLink(
          `${process.env.NEXT_PUBLIC_BASE_URL}/register/school/${res.data}`
        );
      }
    });
  };

  const copyLink = () => {
    return navigator.clipboard.writeText(link);
  };

  return (
    <div className="max-w-7xl mx-auto px-2">
      <div className="mt-6 bg-gray-800 border border-gray-700 p-4 flex flex-col space-y-4">
        <div className="flex flex-col sm:flex-row justfiy-center sm:justify-start sm:items-center sm:space-x-3 space-y-3 sm:space-y-0">
          <Dropdown
            items={schools.map(sc => sc.name)}
            selected={schoolInd}
            setSelected={i => setSchoolInd(i)}
            label="School"
          />
          <Dropdown
            items={expTimes.map(e => e.label)}
            selected={expInd}
            setSelected={i => setExpInd(i)}
            label="Expiration time"
          />
          <div className="sm:pt-5 w-full sm:w-48 flex-shrink-0">
            <button
              className="py-2 w-full sm:w-48 rounded-md text-sm bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800"
              onClick={generateLink}
            >
              Generate
            </button>
          </div>
        </div>
        <div className="flex items-center space-x-3 w-full">
          <input
            value={link}
            className="block h-8 bg-gray-800 border-0 border-b focus:outline-0 focus:ring-0 py-1 px-2 border-gray-600 w-full text-sm cursor-text"
          />
          <div className="flex-shrink-0 w-48">
            <CopyButton
              disabled={link === ''}
              handleCopy={copyLink}
              copiedLabel="Link copied"
              btnLabel="Copy link"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default function InvitePage() {
  return (
    <>
      <PageTitle>Invite students</PageTitle>
      <WithTeacherLogin>
        <PageContent />
      </WithTeacherLogin>
    </>
  );
}
