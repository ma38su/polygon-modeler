import { createContext } from "react";
import type { Editor } from "../editor/Editor";
export const EditorContext = createContext<Editor | undefined>(undefined);
