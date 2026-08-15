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
  await page.getByRole("button", { name: "正投影" }).click();
  await expect(page.getByRole("button", { name: "正投影" })).toHaveClass(
    /active/,
  );
});
