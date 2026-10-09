import React, { createContext, type ReactNode, useContext } from 'react';
import type { ClassContext } from '../scripts/getTaskRef';
import { useGroupClasses } from '../hooks/useClassroomMetadata';

const WorkspaceLaunchContext = createContext<{
  classContext: ClassContext | null;
  classesResource: ReturnType<typeof useGroupClasses>;
} | null>(null);

export const WorkspaceLaunchProvider = ({
  children,
  classContext,
}: {
  children: ReactNode;
  classContext: ClassContext | null;
}) => {
  const classesResource = useGroupClasses(classContext?.group ?? null);
  return (
    <WorkspaceLaunchContext.Provider value={{ classContext, classesResource }}>
      {children}
    </WorkspaceLaunchContext.Provider>
  );
};

export const useWorkspaceLaunchContext = () =>
  useContext(WorkspaceLaunchContext)?.classContext ?? null;

export const useWorkspaceClassesResource = () =>
  useContext(WorkspaceLaunchContext)?.classesResource;
