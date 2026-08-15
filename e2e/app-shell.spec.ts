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
  await page.getByRole("button", { name: "正投影" }).click();
  await expect(page.getByRole("button", { name: "正投影" })).toHaveClass(
    /active/,
  );
});
