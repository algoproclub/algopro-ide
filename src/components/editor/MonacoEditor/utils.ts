import { DependencyList, EffectCallback, useEffect, useRef } from 'react';

export function useUpdate(effect: EffectCallback, deps: DependencyList) {
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    return effect();
    // The caller owns the dependency list for this helper.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function usePrevious<T>(value: T) {
  const ref = useRef<T>();

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref.current;
}
