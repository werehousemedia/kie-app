import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";

const Ctx = createContext({ hideDemo: false, setHideDemo: () => {} });

const OPERATOR_WORKSPACE = "ws_kie_main";
const STORAGE_KEY = "kie_hideDemo";

// Demo records are readable from every workspace on purpose — they're the
// shared worked example. But a real landlord signing up must NOT open the app
// to someone else's example flats mixed in with their own, so the default
// flips on workspace: shown for the operator, hidden for everyone else.
// An explicit choice by the user always wins.
export function DemoFilterProvider({ children }) {
  const { workspace } = useAuth();
  const [hideDemo, setHideDemoState] = useState(() => localStorage.getItem(STORAGE_KEY) === "true");
  const [touched, setTouched] = useState(() => localStorage.getItem(STORAGE_KEY) != null);

  useEffect(() => {
    if (touched || !workspace?.id) return;
    setHideDemoState(workspace.id !== OPERATOR_WORKSPACE);
  }, [workspace?.id, touched]);

  const setHideDemo = (v) => {
    setTouched(true);
    setHideDemoState(v);
    localStorage.setItem(STORAGE_KEY, String(v));
  };

  return <Ctx.Provider value={{ hideDemo, setHideDemo }}>{children}</Ctx.Provider>;
}

export function useDemoFilter() {
  return useContext(Ctx);
}
