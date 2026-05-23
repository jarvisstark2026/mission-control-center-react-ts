import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

export function usePersistentWorkspaceState<T>(
  loadState: () => T,
  saveState: (state: T) => boolean,
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => loadState());

  useEffect(() => {
    saveState(state);
  }, [saveState, state]);

  return [state, setState];
}
