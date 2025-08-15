import { createContext, useContext, useEffect, useState } from 'react';

const UIContext = createContext(null);
export const useUI = () => useContext(UIContext);

export default function UIProvider({ children }) {
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');
  const [isAdminView, setIsAdminView] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (dark) { root.classList.add('dark'); localStorage.setItem('theme', 'dark'); }
    else { root.classList.remove('dark'); localStorage.setItem('theme', 'light'); }
  }, [dark]);

  return (
    <UIContext.Provider value={{ dark, setDark, isAdminView, setIsAdminView }}>
      {children}
    </UIContext.Provider>
  );
}
