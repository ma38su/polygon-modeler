import { expect, test } from "@playwright/test";

test("shows the empty editor shell", async ({ page }) => {
  await page.goto("/?renderer=webgl2");
  await expect(page.getByLabel("3D ビューポート")).toBeVisible();
  await expect(
    page.getByTestId("viewport-canvas").locator("canvas"),
  ).toBeVisible();
  await expect(page.getByText("シーンは空です")).toBeVisible();
  await expect(page.getByTestId("renderer-capability")).toContainText(
    "WebGL 2",
  );
  await page.getByRole("button", { name: "Box追加" }).click();
  await expect(
    page.getByRole("button", { name: "Box 1", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("頂点: 8")).toBeVisible();
  await expect(page.getByText("面: 6")).toBeVisible();
  await page.getByRole("button", { name: "Vertex" }).click();
  await page.keyboard.press("ControlOrMeta+A");
  await expect(page.getByText("選択: 8")).toBeVisible();
  await page.keyboard.press("Alt+A");
  await expect(page.getByText("選択: 0")).toBeVisible();
  await page.getByRole("button", { name: "Edge" }).click();
  await page.keyboard.press("ControlOrMeta+A");
  await expect(page.getByText("選択: 12")).toBeVisible();
  await page.getByRole("button", { name: "Face" }).click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Delete");
  await expect(page.getByText("面: 0")).toBeVisible();
  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(page.getByText("面: 6")).toBeVisible();
  await expect(page.getByText("選択: 6")).toBeVisible();
  await page.getByRole("button", { name: "Box 1", exact: true }).click();
  await page.getByRole("button", { name: "移動" }).click();
  await expect(page.getByRole("button", { name: "移動" })).toHaveClass(
    /active/,
  );
  const positionX = page.getByRole("spinbutton").first();
  await positionX.fill("2");
  await positionX.blur();
  await expect(positionX).toHaveValue("2");
  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(page.getByRole("spinbutton").first()).toHaveValue("0");
  await page.getByRole("button", { name: "やり直す" }).click();
  await expect(page.getByRole("spinbutton").first()).toHaveValue("2");
  await page.getByRole("button", { name: "Box 1を非表示" }).click();
  await expect(page.getByRole("button", { name: "Box 1を表示" })).toBeVisible();
  await page.getByRole("button", { name: "削除" }).click();
  await expect(page.getByText("シーンは空です")).toBeVisible();
  await page.getByRole("button", { name: "Plane追加" }).click();
  await page.getByRole("button", { name: "Cylinder追加" }).click();
  await expect(
    page.getByRole("button", { name: "Plane 2", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Cylinder 3", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("頂点: 36")).toBeVisible();
  await expect(page.getByText("面: 19")).toBeVisible();
  await page.getByRole("button", { name: "正投影" }).click();
  await expect(page.getByRole("button", { name: "正投影" })).toHaveClass(
    /active/,
  );
});
