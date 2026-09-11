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

  const percentage = Math.round((filledSettings / totalSettings) * 100);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="theme-surface rounded-md shadow-md p-4 border theme-border">
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
                  stroke="var(--border-muted)"
                  strokeWidth="8"
                />
                {/* Progress circle */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="var(--accent)"
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
                <span className="text-sm font-medium theme-text">
                  {percentage}%
                </span>
              </div>
            </div>
          </div>

          {/* Settings List */}
          <div className="flex-grow">
            <h3 className="text-md font-medium mb-3 theme-text">
              Profile Recommendations
            </h3>
            <ul className="">
              {Object.values(settings).map((setting, index) => (
                <li
                  key={index}
                  className={`flex items-center gap-2 rounded-md border border-line bg-surface-muted transition-colors hover:bg-surface-hover ${
                    setting.filled
                      ? 'opacity-0 max-h-0 overflow-hidden pt-0 pb-0 '
                      : 'opacity-100 max-h-10 mb-2'
                  } p-2`}
                >
                  <div className="h-2 w-2 flex-shrink-0 rounded-full bg-accent" />
                  <span className="theme-text-muted text-sm">
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
