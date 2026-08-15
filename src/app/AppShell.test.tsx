import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../App";

describe("App shell", () => {
  it("renders editor regions and renderer diagnostics", () => {
    render(<App />);
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
});
