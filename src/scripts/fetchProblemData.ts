import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
} from 'firebase/functions';
import { PlatformProblem, ProblemData } from '../types/problem';

// TODO why isn't it enough to do this in _app.tsx?
// connectFunctionsEmulator(
//  getFunctions(undefined, 'europe-west1'),
//  '127.0.0.1',
//  5001
//);

// TODO re-add USACO fetch (we probably want to do it through cloud function)
export const fetchProblemData = httpsCallable<PlatformProblem, ProblemData>(
  getFunctions(undefined, 'europe-west1'),
  'fetchproblemdata'
);
