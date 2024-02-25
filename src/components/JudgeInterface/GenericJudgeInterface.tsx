import React from 'react';
import { ProblemData } from '../../types/problem';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/20/solid';
import HTMLStatement from './HTMLStatement';

export default function GenericJudgeInterface({
  problem,
}: {
  problem: ProblemData;
}): JSX.Element {
  return (
    <div className="relative h-full flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <section className="p-4 pb-0">
          <h3>
            <a
              href={problem.url}
              target="_blank"
              rel="noreferrer"
              className="font-bold text-xl hover:underline flex flex-row items-center"
            >
              {problem.title}
              <ArrowTopRightOnSquareIcon
                aria-hidden="true"
                className="ml-1 h-5 w-5"
              />
            </a>
          </h3>
          <HTMLStatement htmlContent={problem.statement ?? ''} />
          {(problem.timeLimit || problem.memoryLimit) && (
            <div>
              <h4 style={{ fontSize: '1.125rem', fontWeight: '600' }}>
                Limits
              </h4>
              {problem.timeLimit && (
                <div>
                  <b>Time limit:</b> {problem.timeLimit}
                </div>
              )}
              {problem.memoryLimit && (
                <div>
                  <b>Memory limit:</b> {problem.memoryLimit}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
