import React from 'react';

export default function NoRegistrationMessage() {
  return (
    <div className="mt-2">
      <p>
        This application is available for students attending programming classes
        in educational institutions. Your account is not linked to any school.
        Join one using an invitation link, or apply to the Algo Pro Club on our{' '}
        <a
          className="text-indigo-300 font-medium"
          href="https://algopro.hu"
          target="_blank"
          rel="noreferrer"
        >
          website
        </a>
        . Need help? Message us on Discord or email us at{' '}
        <a
          className="text-indigo-300 font-medium"
          href="mailto:info@algopro.hu"
        >
          info@algopro.hu
        </a>
        .
      </p>
      <p className="mt-3 sm:mt-6">
        Ez az alkalmazás oktatási intézmények programozás óráira járó diákok
        számára elérhető. A fiókod nincs iskolához kapcsolva. Csatlakozz meghívó
        linkkel, vagy jelentkezz az Algo Pro Clubba a{' '}
        <a
          className="text-indigo-300 font-medium"
          href="https://algopro.hu"
          target="_blank"
          rel="noreferrer"
        >
          weboldalunkon
        </a>
        . Segítség kell? Írj nekünk bátran Discordon vagy emailben:{' '}
        <a
          className="text-indigo-300 font-medium"
          href="mailto:info@algopro.hu"
        >
          info@algopro.hu
        </a>
        .
      </p>
      <div className="mt-3 sm:mt-6 mx-auto w-60">
        <a href="https://algopro.hu" target="_blank" rel="noreferrer">
          <button className="block items-center w-full px-6 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#1E1E1E] focus:ring-indigo-500">
            Jump to website
          </button>
        </a>
      </div>
    </div>
  );
}
