import React, { createContext, type ReactNode, useContext } from 'react';
import type { ClassContext } from '../scripts/getTaskRef';

const WorkspaceLaunchContext = createContext<ClassContext | null>(null);

export const WorkspaceLaunchProvider = ({
  children,
  classContext,
}: {
  children: ReactNode;
  classContext: ClassContext | null;
}) => (
  <WorkspaceLaunchContext.Provider value={classContext}>
    {children}
  </WorkspaceLaunchContext.Provider>
);

export const useWorkspaceLaunchContext = () =>
  useContext(WorkspaceLaunchContext);
