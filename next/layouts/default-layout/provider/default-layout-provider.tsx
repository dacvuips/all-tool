import { createContext, useContext, useState } from "react";

export const DefaultLayoutContext = createContext<Partial<{}>>({});

export function DefaulLayoutProvider(props) {
  return <DefaultLayoutContext.Provider value={{}}>{props.children}</DefaultLayoutContext.Provider>;
}
export const useDefaultLayoutContext = () => useContext(DefaultLayoutContext);
