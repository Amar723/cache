import {useSyncExternalStore} from 'react';

/**
 * Minimal external store built on React 18's `useSyncExternalStore`.
 *
 * We use this instead of Context providers for global auth/stash state so the
 * hook files stay pure (no JSX), background code (the proximity engine) can read
 * the same state without a React tree, and there is no provider-nesting to
 * maintain. State updates are shallow-merged.
 */
export interface Store<T> {
  getState: () => T;
  setState: (partial: Partial<T> | ((prev: T) => Partial<T>)) => void;
  subscribe: (listener: () => void) => () => void;
  /** React hook returning a selected slice of state. */
  useSelector: <S>(selector: (state: T) => S) => S;
}

export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();

  const getState = () => state;

  const setState: Store<T>['setState'] = partial => {
    const next = typeof partial === 'function' ? partial(state) : partial;
    state = {...state, ...next};
    listeners.forEach(l => l());
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const useSelector = <S>(selector: (s: T) => S): S =>
    useSyncExternalStore(
      subscribe,
      () => selector(state),
      () => selector(state),
    );

  return {getState, setState, subscribe, useSelector};
}
