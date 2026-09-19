import { useSetAtom } from 'jotai';
import { getDatabase, onValue, ref } from 'firebase/database';
import { type ReactNode, useEffect } from 'react';
import {
  hasSolutionsAtom,
  languageAtom,
  problemAtom,
  solutionsAtomFamily,
  statusDataAtom,
  statusDataHistoryAtom,
  translationsAtom,
} from '../../atoms/workspaceUI';
import { useEditorContext } from '../../context/EditorContext';
import {
  fetchProblemFromDb,
  fetchSolutionsCountFromDb,
  fetchTranslationsFromDb,
} from '../../scripts/fetchProblemFromDb';

export default function ProblemDataLoader({
  children,
}: {
  children: ReactNode;
}) {
  const { fileData } = useEditorContext();
  const setLanguage = useSetAtom(languageAtom);
  const setProblem = useSetAtom(problemAtom);
  const setStatusData = useSetAtom(statusDataAtom);
  const setStatusDataHistory = useSetAtom(statusDataHistoryAtom);
  const setTranslations = useSetAtom(translationsAtom);
  const setHasSolutions = useSetAtom(hasSolutionsAtom);

  useEffect(() => {
    let cancelled = false;
    const db = getDatabase();
    setHasSolutions(false);

    if (!fileData.problem) {
      setProblem(null);
      return;
    }

    const problemDataPromise = fetchProblemFromDb(fileData.problem);
    const translationsPromise = fetchTranslationsFromDb(fileData.problem);

    void problemDataPromise.then(
      problemData => {
        if (!cancelled) setProblem(problemData ?? null);
      },
      () => undefined
    );

    void Promise.all([problemDataPromise, translationsPromise])
      .then(([problemData, translations]) => {
        if (cancelled) return;

        if (!problemData) return;

        translations['en'] ??= {
          hints: problemData.hints ?? [],
          ...(problemData.statementURL
            ? { statementURL: problemData.statementURL }
            : { statement: problemData.statement! }),
        };
        setTranslations(translations);
        setLanguage('hu' in translations ? 'hu' : 'en');
      })
      .catch(error => {
        if (!cancelled) console.error('Failed to load problem data.', error);
      });

    void fetchSolutionsCountFromDb(fileData.problem)
      .then(count => {
        if (!cancelled) setHasSolutions(count > 0);
      })
      .catch(error => {
        if (!cancelled)
          console.error('Failed to check for model solutions.', error);
      });

    const unsubscribeStatusData = onValue(
      ref(db, `submissions/${fileData.id}/statusData`),
      snapshot => {
        if (!cancelled) setStatusData(snapshot.val());
      },
      error => {
        console.error('Failed to load submission status data.', error);
      }
    );

    const unsubscribeStatusDataHistory = onValue(
      ref(db, `submissions/${fileData.id}/statusDataHistory`),
      snapshot => {
        if (!cancelled) setStatusDataHistory(snapshot.val());
      },
      error => {
        console.error('Failed to load submission status history.', error);
      }
    );

    return () => {
      cancelled = true;
      unsubscribeStatusData();
      unsubscribeStatusDataHistory();
      setProblem(undefined);
      setTranslations({});
      setHasSolutions(false);
      if (fileData.problem) solutionsAtomFamily.remove(fileData.problem);
      setStatusData(null);
      setStatusDataHistory([]);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileData.id, fileData.problem?.platform, fileData.problem?.id]);

  return <>{children}</>;
}
