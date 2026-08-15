import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Editor } from "../editor/Editor";
import { EditorErrorBoundary } from "./EditorErrorBoundary";

function BrokenView(): never {
  throw new Error("test crash");
}

describe("EditorErrorBoundary", () => {
  it("isolates a render crash and offers recovery", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <EditorErrorBoundary editor={new Editor()}>
        <BrokenView />
      </EditorErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("test crash");
    expect(
      screen.getByRole("button", { name: "再読み込み" }),
    ).toBeInTheDocument();
  });
});
