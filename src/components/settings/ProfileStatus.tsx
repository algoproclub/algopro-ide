import React from 'react';

interface SettingItem {
  filled: boolean;
  suggestion: string;
}

interface ProfileStatusProps {
  settings: Record<string, SettingItem>;
}

export default function ProfileStatus({
  settings,
}: ProfileStatusProps): JSX.Element {
  const totalSettings = Object.keys(settings).length;
  const filledSettings = Object.values(settings).filter(
    val => val.filled
  ).length;
  const unfilledSettings = Object.values(settings).filter(val => !val.filled);

  const percentage = Math.round((filledSettings / totalSettings) * 100);

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Profile card with a more compact and subtle style */}
      <div className="bg-[#1e1e1e] rounded-md shadow-md p-4 text-gray-300 border border-gray-700">
        <div className="flex items-start gap-4">
          {/* Progress Circle */}
          <div className="relative flex-shrink-0">
            <div className="w-16 h-16">
              <svg className="w-full h-full" viewBox="0 0 100 100">
                {/* Background circle */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#2a2a2a"
                  strokeWidth="8"
                />
                {/* Progress circle */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${percentage * 2.51} ${
                    251 - percentage * 2.51
                  }`}
                  transform="rotate(-90 50 50)"
                />
              </svg>
              {/* Percentage Text */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-medium text-gray-200">
                  {percentage}%
                </span>
              </div>
            </div>
          </div>

          {/* Settings List */}
          <div className="flex-grow">
            <h3 className="text-md font-medium mb-3 text-gray-200">
              Profile Recommendations
            </h3>
            <ul className="">
              {Object.values(settings).map((setting, index) => (
                <li
                  key={index}
                  className={`flex items-center rounded-md bg-gray-900 hover:bg-gray-800 border gap-2 border-gray-700 transition-all duration-300 ${
                    setting.filled
                      ? 'opacity-0 max-h-0 overflow-hidden pt-0 pb-0 '
                      : 'opacity-100 max-h-10 mb-2'
                  } p-2`}
                >
                  <div className="h-2 w-2 rounded-full bg-indigo-500 flex-shrink-0" />
                  <span className="text-gray-400 text-sm">
                    {setting.suggestion}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
