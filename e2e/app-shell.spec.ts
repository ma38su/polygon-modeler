import { expect, test } from "@playwright/test";

test("shows the empty editor shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByLabel("3D ビューポート")).toBeVisible();
  await expect(page.getByText("シーンは空です")).toBeVisible();
  await expect(page.getByTestId("renderer-capability")).toBeVisible();
});
