import "@krelborn/stylesui/styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./components/App/App";
import "./global.css";

const rootElement = document.getElementById("root");
if (rootElement === null) {
  throw new Error("The page has no #root element");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
