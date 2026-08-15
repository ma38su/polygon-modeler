import { useRef, type ReactNode } from "react";
import { Editor } from "../editor/Editor";
import { EditorContext } from "./EditorContext";
export function EditorProvider({ children }: { children: ReactNode }) {
  const editorRef = useRef<Editor>(undefined);
  if (!editorRef.current) editorRef.current = new Editor();
  return <EditorContext value={editorRef.current}>{children}</EditorContext>;
}
