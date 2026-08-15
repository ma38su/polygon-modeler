import App from "../App";
import { useEditor } from "./useEditor";
import { EditorErrorBoundary } from "./EditorErrorBoundary";

export function AppRoot() {
  const editor = useEditor();
  return (
    <EditorErrorBoundary editor={editor}>
      <App />
    </EditorErrorBoundary>
  );
}
