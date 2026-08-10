import React, { createContext, useContext, useState, useEffect } from "react";

const Ctx = createContext({ hideDemo: false, setHideDemo: () => {} });

export function DemoFilterProvider({ children }) {
  const [hideDemo, setHideDemo] = useState(() => localStorage.getItem("kie_hideDemo") === "true");
  useEffect(() => { localStorage.setItem("kie_hideDemo", String(hideDemo)); }, [hideDemo]);
  return <Ctx.Provider value={{ hideDemo, setHideDemo }}>{children}</Ctx.Provider>;
}

export function useDemoFilter() {
  return useContext(Ctx);
}