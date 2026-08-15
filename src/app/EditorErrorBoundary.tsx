import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import type { Editor } from "../editor/Editor";
import { saveAutosave } from "../storage/projectStorage";

interface Props {
  readonly editor: Editor;
  readonly children: ReactNode;
}

interface State {
  readonly error?: string;
}

export class EditorErrorBoundary extends Component<Props, State> {
  state: State = {};

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error.message : String(error) };
  }

  componentDidCatch(): void {
    try {
      void saveAutosave(this.props.editor.serializeProject()).catch(
        () => undefined,
      );
    } catch {
      // The fallback must remain available even when storage is unavailable.
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="fatal-error" role="alert">
        <AlertTriangle aria-hidden="true" />
        <h1>エディターで問題が発生しました</h1>
        <p>{this.state.error}</p>
        <p>直前の編集内容を自動保存へ退避しています。</p>
        <button type="button" onClick={() => window.location.reload()}>
          <RefreshCw aria-hidden="true" />
          再読み込み
        </button>
      </main>
    );
  }
}
