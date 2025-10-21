import React, { createContext, useState, useCallback, ReactNode } from "react";
import { HelpCommand } from "../types";

interface HelpContextType {
  isOpen: boolean;
  pageCommands: HelpCommand[];
  pageName: string;
  openHelp: () => void;
  closeHelp: () => void;
  setPageContext: (commands: HelpCommand[], pageName: string) => void;
}

const HelpContext = createContext<HelpContextType | undefined>(undefined);

interface HelpProviderProps {
  children: ReactNode;
}

export const HelpProvider: React.FC<HelpProviderProps> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [pageCommands, setPageCommands] = useState<HelpCommand[]>([]);
  const [pageName, setPageName] = useState("GENERAL");

  const openHelp = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeHelp = useCallback(() => {
    setIsOpen(false);
  }, []);

  const setPageContext = useCallback((commands: HelpCommand[], name: string) => {
    setPageCommands(commands);
    setPageName(name.toUpperCase());
  }, []);

  const value: HelpContextType = {
    isOpen,
    pageCommands,
    pageName,
    openHelp,
    closeHelp,
    setPageContext,
  };

  return <HelpContext.Provider value={value}>{children}</HelpContext.Provider>;
};

export const useHelpContext = (): HelpContextType => {
  const context = React.useContext(HelpContext);
  if (context === undefined) {
    throw new Error("useHelpContext must be used within a HelpProvider");
  }
  return context;
};
