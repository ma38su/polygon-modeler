import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/design-system.css";
import "./index.css";
import { EditorProvider } from "./app/EditorProvider.tsx";
import { AppRoot } from "./app/AppRoot.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <EditorProvider>
      <AppRoot />
    </EditorProvider>
  </StrictMode>,
);
