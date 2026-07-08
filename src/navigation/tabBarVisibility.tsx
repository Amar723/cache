import React, {createContext, useContext} from 'react';

interface TabBarVisibilityValue {
  visible: boolean;
  setVisible: (visible: boolean) => void;
}

const DEFAULT_VALUE: TabBarVisibilityValue = {
  visible: true,
  setVisible: () => undefined,
};

const TabBarVisibilityContext =
  createContext<TabBarVisibilityValue>(DEFAULT_VALUE);

export function TabBarVisibilityProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: TabBarVisibilityValue;
}): React.JSX.Element {
  return (
    <TabBarVisibilityContext.Provider value={value}>
      {children}
    </TabBarVisibilityContext.Provider>
  );
}

export function useTabBarVisibility(): TabBarVisibilityValue {
  return useContext(TabBarVisibilityContext);
}
