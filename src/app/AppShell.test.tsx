import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import App from "../App";
import { EditorProvider } from "./EditorProvider";

afterEach(cleanup);

describe("App shell", () => {
  it("renders editor regions and renderer diagnostics", () => {
    render(
      <EditorProvider>
        <App />
      </EditorProvider>,
    );
    expect(screen.getByLabelText("3D ビューポート")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "オブジェクト" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "インスペクター" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("renderer-capability")).toHaveTextContent(
      /WebGPU|WebGL 2|3D 描画非対応/,
    );
  });

  it("changes import unit and Up axis without crashing", () => {
    const view = render(
      <EditorProvider>
        <App />
      </EditorProvider>,
    );

    fireEvent.click(view.getByRole("button", { name: "3D読込" }));

    fireEvent.change(view.getByLabelText("読み込み単位"), {
      target: { value: "millimeter" },
    });
    fireEvent.change(view.getByLabelText("読み込みUp軸"), {
      target: { value: "z" },
    });

    expect(view.getByLabelText("読み込み単位")).toHaveValue("millimeter");
    expect(view.getByLabelText("読み込みUp軸")).toHaveValue("z");
    expect(
      screen.queryByRole("heading", { name: "エディターで問題が発生しました" }),
    ).not.toBeInTheDocument();
  });
});
