import React, {createContext, useContext, useState} from 'react';

type SetVisible = (visible: boolean) => void;

/**
 * Split into two contexts on purpose: screens that only *flip* the tab bar (the
 * map/saved screens, when a bottom sheet opens) read the stable setter and never
 * re-render when visibility changes. Only the tab bar itself subscribes to the
 * boolean. Before this split, toggling a sheet re-rendered the whole map — and
 * every pin — because the map consumed a combined value that changed identity on
 * every toggle.
 */
const VisibleContext = createContext<boolean>(true);
const SetVisibleContext = createContext<SetVisible>(() => undefined);

/** Owns the visibility state so toggling it never re-renders the navigator. */
export function TabBarVisibilityProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  // `setVisible` from useState is referentially stable for the provider's life.
  const [visible, setVisible] = useState(true);
  return (
    <SetVisibleContext.Provider value={setVisible}>
      <VisibleContext.Provider value={visible}>
        {children}
      </VisibleContext.Provider>
    </SetVisibleContext.Provider>
  );
}

/** Subscribe to the current visibility (re-renders on change). */
export function useTabBarVisible(): boolean {
  return useContext(VisibleContext);
}

/** The stable setter, without subscribing to visibility changes. */
export function useSetTabBarVisible(): SetVisible {
  return useContext(SetVisibleContext);
}
