import { useEffect, useRef, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Viewport, type ViewportStatus } from "./Viewport";

export interface ViewportCanvasProps {
  onStatusChange(status: ViewportStatus): void;
  projection: "perspective" | "orthographic";
}

export function ViewportCanvas({
  onStatusChange,
  projection,
}: ViewportCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<Viewport>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const viewport = new Viewport(host, (status) => {
      setError(status.error);
      onStatusChange(status);
    });
    viewportRef.current = viewport;
    void viewport.initialize();
    return () => {
      viewportRef.current = null;
      viewport.dispose();
    };
  }, [onStatusChange]);

  useEffect(() => viewportRef.current?.setProjection(projection), [projection]);

  return (
    <div
      className="viewport-canvas"
      ref={hostRef}
      data-testid="viewport-canvas"
    >
      {error && (
        <div className="viewport-error" role="alert">
          <AlertTriangle aria-hidden="true" />
          <span>{error}</span>
          <button type="button" onClick={() => window.location.reload()}>
            <RefreshCw aria-hidden="true" />
            再読み込み
          </button>
        </div>
      )}
    </div>
  );
}
