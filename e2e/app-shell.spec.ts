import { expect, test } from "@playwright/test";

test("renders the same editor contract on WebGPU when available", async ({
  page,
}) => {
  await page.goto("/?renderer=webgpu");
  const supported = await page.evaluate(() => "gpu" in navigator);
  test.skip(!supported, "WebGPU is unavailable in this browser environment");
  await expect(page.getByText("WebGPU 対応")).toBeVisible();
  await page.getByRole("button", { name: "Plane追加" }).click();
  await expect(page.getByText("頂点: 4")).toBeVisible();
  await expect(page.getByText("面: 1")).toBeVisible();
  await expect(page.getByTestId("viewport-canvas")).toBeVisible();
});

test("keeps header actions on one line at narrow window widths", async ({
  page,
}) => {
  await page.setViewportSize({ width: 800, height: 700 });
  await page.goto("/?renderer=webgl2");
  const header = page.locator(".app-header");
  await expect(header).toHaveCSS("height", "44px");
  await expect(header.getByRole("button", { name: "保存" })).toHaveCSS(
    "font-size",
    "12px",
  );
  for (const button of await header.getByRole("button").all()) {
    await expect(button).toHaveCSS("white-space", "nowrap");
    expect((await button.boundingBox())?.height).toBeLessThanOrEqual(36);
  }
  await expect(
    page.getByRole("button", { name: "選択", exact: true }),
  ).toHaveCSS("font-size", "11px");
  const selectionBox = await page.getByLabel("選択モード").boundingBox();
  const displayBox = await page.getByLabel("表示レイヤー").boundingBox();
  expect(selectionBox).not.toBeNull();
  expect(displayBox).not.toBeNull();
  expect(displayBox!.y).toBeGreaterThanOrEqual(
    selectionBox!.y + selectionBox!.height,
  );
});

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
  const transformTools = page.getByLabel("変形ツール");
  await expect(
    transformTools.getByRole("button", { name: "移動" }),
  ).toHaveAttribute("aria-pressed", "false");
  await transformTools.getByRole("button", { name: "移動" }).click();
  await expect(
    transformTools.getByRole("button", { name: "移動" }),
  ).toHaveAttribute("aria-pressed", "true");
  await transformTools.getByRole("button", { name: "移動" }).click();
  await expect(
    transformTools.getByRole("button", { name: "移動" }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByLabel("メッシュ診断")).toContainText("境界Edge0");
  await page.getByRole("button", { name: "法線再計算" }).click();
  await expect(page.getByRole("button", { name: "元に戻す" })).toBeEnabled();
  await page.getByRole("button", { name: "元に戻す" }).click();
  const displayLayers = page.getByLabel("表示レイヤー");
  await expect(
    displayLayers.getByRole("button", { name: "Vertex" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    displayLayers.getByRole("button", { name: "Edge" }),
  ).toHaveAttribute("aria-pressed", "true");
  await displayLayers.getByRole("button", { name: "Vertex" }).click();
  await expect(page.getByTestId("viewport-canvas")).toHaveAttribute(
    "data-display-vertices",
    "false",
  );
  await expect(page.getByTestId("viewport-canvas")).toHaveAttribute(
    "data-selection-modes",
    "vertex,edge,face",
  );
  await displayLayers.getByRole("button", { name: "Vertex" }).click();
  await displayLayers.getByRole("button", { name: "Face" }).click();
  await displayLayers.getByRole("button", { name: "Normal" }).click();
  await expect(page.getByTestId("viewport-canvas")).toHaveAttribute(
    "data-display-normals",
    "true",
  );
  await expect(page.getByTestId("viewport-canvas")).toHaveAttribute(
    "data-display-edges",
    "true",
  );
  await expect(page.getByTestId("viewport-canvas")).toHaveAttribute(
    "data-display-faces",
    "false",
  );
  await displayLayers.getByRole("button", { name: "Face" }).click();
  const snapControls = page.getByLabel("スナップと軸制限");
  await snapControls.getByRole("button", { name: "Normal" }).click();
  await expect(page.getByTestId("viewport-canvas")).toHaveAttribute(
    "data-transform-orientation",
    "normal",
  );
  await snapControls.getByRole("button", { name: "Grid" }).click();
  await snapControls.getByRole("button", { name: "Vertex" }).click();
  await snapControls.getByRole("button", { name: "X", exact: true }).click();
  await expect(page.getByTestId("viewport-canvas")).toHaveAttribute(
    "data-grid-snap",
    "true",
  );
  await expect(page.getByTestId("viewport-canvas")).toHaveAttribute(
    "data-vertex-snap",
    "true",
  );
  await expect(page.getByTestId("viewport-canvas")).toHaveAttribute(
    "data-axis-constraint",
    "x",
  );
  await page.keyboard.press("y");
  await expect(page.getByTestId("viewport-canvas")).toHaveAttribute(
    "data-axis-constraint",
    "y",
  );
  const selectionModes = page.getByLabel("選択モード");
  await expect(
    selectionModes.getByRole("button", { name: "Object" }),
  ).toHaveCount(0);
  await selectionModes.getByRole("button", { name: "Edge" }).click();
  await selectionModes.getByRole("button", { name: "Face" }).click();
  await expect(page.getByTestId("viewport-canvas")).toHaveAttribute(
    "data-selection-modes",
    "vertex",
  );
  await expect(
    page.getByText("Vertex → Edge → Faceの順に判定 / Shiftで追加選択"),
  ).toBeVisible();
  await page.keyboard.press("ControlOrMeta+A");
  await expect(page.getByText("選択: 8")).toBeVisible();
  await page.keyboard.press("Alt+A");
  await expect(page.getByText("選択: 0")).toBeVisible();
  await selectionModes.getByRole("button", { name: "Edge" }).click();
  await expect(page.getByTestId("viewport-canvas")).toHaveAttribute(
    "data-selection-modes",
    "vertex,edge",
  );
  await page.keyboard.press("ControlOrMeta+A");
  await expect(page.getByText("選択: 20")).toBeVisible();
  await selectionModes.getByRole("button", { name: "Vertex" }).click();
  await selectionModes.getByRole("button", { name: "Edge" }).click();
  await selectionModes.getByRole("button", { name: "Face" }).click();
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
  const positionX = page
    .getByRole("group", { name: "位置" })
    .getByRole("spinbutton")
    .first();
  await positionX.fill("2");
  await positionX.blur();
  await expect(positionX).toHaveValue("2");
  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(positionX).toHaveValue("0");
  await page.getByRole("button", { name: "やり直す" }).click();
  await expect(positionX).toHaveValue("2");
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

test("cancels, commits, and replays a face extrusion dialog", async ({
  page,
}) => {
  await page.goto("/?renderer=webgl2");
  await page.getByRole("button", { name: "Plane追加" }).click();
  const selectionModes = page.getByLabel("選択モード");
  await selectionModes.getByRole("button", { name: "Vertex" }).click();
  await selectionModes.getByRole("button", { name: "Edge" }).click();
  await page.keyboard.press("ControlOrMeta+A");

  await page.getByRole("button", { name: "押し出し操作" }).click();
  await expect(page.getByTestId("viewport-canvas")).toHaveAttribute(
    "data-normal-operation",
    "extrude",
  );
  await page.getByRole("button", { name: "キャンセル" }).click();
  await expect(page.getByTestId("viewport-canvas")).toHaveAttribute(
    "data-normal-operation",
    "off",
  );

  await page.getByRole("button", { name: "押し出し数値" }).click();
  const dialog = page.getByRole("dialog", { name: "面を押し出す" });
  await expect(dialog).toBeVisible();
  const distance = dialog.getByLabel("押し出し量");
  await expect(page.getByText("モデリングプレビュー")).toBeVisible();
  await expect(page.getByTestId("viewport-canvas")).toHaveAttribute(
    "data-modeling-preview",
    "true",
  );
  await distance.fill("2");
  await expect(page.getByText("面: 1")).toBeVisible();
  await dialog.getByRole("button", { name: "キャンセル" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("モデリングプレビュー")).toHaveCount(0);
  await expect(page.getByText("面: 1")).toBeVisible();

  await page.getByRole("button", { name: "押し出し数値" }).click();
  await expect(dialog.getByLabel("押し出し量")).toHaveValue("1");
  await distance.fill("0.5");
  await dialog.getByRole("button", { name: "押し出す" }).click();
  await expect(page.getByText("面: 5")).toBeVisible();
  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(page.getByText("面: 1")).toBeVisible();
  await page.getByRole("button", { name: "やり直す" }).click();
  await expect(page.getByText("面: 5")).toBeVisible();
});

test("previews and commits a face inset dialog", async ({ page }) => {
  await page.goto("/?renderer=webgl2");
  await page.getByRole("button", { name: "Plane追加" }).click();
  const selectionModes = page.getByLabel("選択モード");
  await selectionModes.getByRole("button", { name: "Vertex" }).click();
  await selectionModes.getByRole("button", { name: "Edge" }).click();
  await page.keyboard.press("ControlOrMeta+A");

  await page.getByRole("button", { name: "インセット" }).click();
  const dialog = page.getByRole("dialog", { name: "面をインセット" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("インセット率").fill("0.25");
  await expect(page.getByTestId("viewport-canvas")).toHaveAttribute(
    "data-modeling-preview",
    "true",
  );
  await dialog.getByRole("button", { name: "インセット" }).click();
  await expect(page.getByText("面: 5")).toBeVisible();
  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(page.getByText("面: 1")).toBeVisible();
});

test("previews and commits a Knife face cut", async ({ page }) => {
  await page.goto("/?renderer=webgl2");
  await page.getByRole("button", { name: "Plane追加" }).click();
  const selectionModes = page.getByLabel("選択モード");
  await selectionModes.getByRole("button", { name: "Vertex" }).click();
  await selectionModes.getByRole("button", { name: "Edge" }).click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.getByRole("button", { name: "Knife数値", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Knifeで面を切断" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("辺上の位置").fill("0.35");
  await expect(page.getByText("モデリングプレビュー")).toBeVisible();
  await dialog.getByRole("button", { name: "切断" }).click();
  await expect(page.getByText("頂点: 6")).toBeVisible();
  await expect(page.getByText("面: 2")).toBeVisible();
  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(page.getByText("頂点: 4")).toBeVisible();
});

test("previews numeric element transforms before applying", async ({
  page,
}) => {
  await page.goto("/?renderer=webgl2");
  await page.getByRole("button", { name: "Plane追加" }).click();
  const modes = page.getByLabel("選択モード");
  await modes.getByRole("button", { name: "Edge" }).click();
  await modes.getByRole("button", { name: "Face" }).click();
  const viewport = page.getByTestId("viewport-canvas");
  await viewport.click();
  await page.keyboard.press("ControlOrMeta+A");

  const move = page.locator("fieldset").filter({ hasText: "相対移動" });
  await move.getByLabel("x軸").fill("1.5");
  await expect(viewport).toHaveAttribute("data-modeling-preview", "true");
  await expect(page.getByText("モデリングプレビュー")).toBeVisible();
  await move.getByRole("button", { name: "適用" }).click();
  await expect(viewport).toHaveAttribute("data-modeling-preview", "false");
  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(page.getByRole("button", { name: "やり直す" })).toBeEnabled();
});

test("duplicates and joins objects from the outliner", async ({ page }) => {
  await page.goto("/?renderer=webgl2");
  await page.getByRole("button", { name: "Box追加" }).click();
  await page.getByRole("button", { name: "複製" }).click();
  await expect(
    page.getByRole("button", { name: "Box 1 Copy", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Box 1", exact: true })
    .click({ modifiers: ["Shift"] });
  await page.getByRole("button", { name: "結合" }).click();
  await expect(
    page.getByRole("button", { name: /^Joined \d+$/ }),
  ).toBeVisible();
  await expect(page.getByText("面: 12")).toBeVisible();
  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(
    page.getByRole("button", { name: "Box 1", exact: true }),
  ).toBeVisible();
});

test("unions two closed objects and restores them with undo", async ({
  page,
}) => {
  await page.goto("/?renderer=webgl2");
  await page.getByRole("button", { name: "Box追加" }).click();
  await page.getByRole("button", { name: "Cylinder追加" }).click();
  await page
    .getByRole("button", { name: "Box 1", exact: true })
    .click({ modifiers: ["Shift"] });
  await expect(page.getByRole("button", { name: "Union" })).toBeEnabled();
  await page.getByRole("button", { name: "Union" }).click();
  await expect(page.getByRole("button", { name: /^Union \d+$/ })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Box 1", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(
    page.getByRole("button", { name: "Box 1", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Cylinder 2", exact: true }),
  ).toBeVisible();
});

test("selects vertices with box and lasso gestures", async ({ page }) => {
  await page.goto("/?renderer=webgl2");
  await page.getByRole("button", { name: "Box追加" }).click();
  const modes = page.getByLabel("選択モード");
  await modes.getByRole("button", { name: "Edge" }).click();
  await modes.getByRole("button", { name: "Face" }).click();
  const viewport = page.getByTestId("viewport-canvas");
  const bounds = await viewport.boundingBox();
  expect(bounds).not.toBeNull();

  await page.getByRole("button", { name: "矩形選択" }).click();
  await page.mouse.move(bounds!.x + 100, bounds!.y + 100);
  await page.mouse.down();
  await page.mouse.move(
    bounds!.x + bounds!.width - 100,
    bounds!.y + bounds!.height - 100,
  );
  await page.mouse.up();
  await expect(page.getByText("選択: 8")).toBeVisible();

  await page.keyboard.press("Alt+A");
  await page.getByRole("button", { name: "投げ縄選択" }).click();
  await page.mouse.move(bounds!.x + 120, bounds!.y + 150);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + bounds!.width - 120, bounds!.y + 150);
  await page.mouse.move(
    bounds!.x + bounds!.width - 120,
    bounds!.y + bounds!.height - 120,
  );
  await page.mouse.move(bounds!.x + 120, bounds!.y + bounds!.height - 120);
  await page.mouse.move(bounds!.x + 120, bounds!.y + 150);
  await page.mouse.up();
  await expect(page.getByText("選択: 8")).toBeVisible();
});

test("coordinates viewport focus, shortcuts, context menu, and dirty state", async ({
  page,
}) => {
  await page.goto("/?renderer=webgl2");
  await page.getByRole("button", { name: "Box追加" }).click();
  await expect(page.getByLabel("未保存の変更あり")).toBeVisible();

  const viewport = page.getByTestId("viewport-canvas");
  await viewport.click({ position: { x: 350, y: 250 } });
  await page.keyboard.press("1");
  await page.keyboard.press("2");
  await expect(
    page.getByLabel("選択モード").getByRole("button", { name: "Face" }),
  ).toHaveClass(/active/);
  await page.keyboard.press("r");
  await expect(page.getByText("変形: rotate")).toBeVisible();

  await viewport.click({ button: "right", position: { x: 350, y: 250 } });
  await expect(page.getByRole("menu")).toBeVisible();
  await page.getByRole("menuitem", { name: /すべて選択/ }).click();
  await expect(page.getByText("選択: 6")).toBeVisible();

  await viewport.focus();
  await page.keyboard.press("?");
  await expect(
    page.getByRole("dialog", { name: "キーボードショートカット" }),
  ).toBeVisible();
});

test("saves and reloads a project file", async ({ page }) => {
  await page.goto("/?renderer=webgl2");
  await page.getByRole("button", { name: "Box追加" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "保存" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).not.toBeNull();
  await expect(page.getByLabel("未保存の変更あり")).toHaveCount(0);

  await page.getByRole("button", { name: "削除" }).click();
  await expect(page.getByText("シーンは空です")).toBeVisible();
  await page.getByLabel("プロジェクトファイルを開く").setInputFiles(path!);
  await expect(
    page.getByRole("button", { name: "Box 1", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("頂点: 8")).toBeVisible();
  await expect(page.getByLabel("未保存の変更あり")).toHaveCount(0);
});

test("offers and restores the IndexedDB autosave", async ({ page }) => {
  await page.goto("/?renderer=webgl2");
  await page.getByRole("button", { name: "Plane追加" }).click();
  await page.waitForTimeout(700);
  await page.reload();
  await expect(
    page.getByRole("dialog", { name: "自動保存を復元" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "復元" }).click();
  await expect(
    page.getByRole("button", { name: "Plane 1", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("未保存の変更あり")).toHaveCount(0);
});

test("exports GLB and STL and imports the STL in print units", async ({
  page,
}) => {
  await page.goto("/?renderer=webgl2");
  await page.getByRole("button", { name: "Box追加" }).click();

  const glbPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "GLB出力" }).click();
  const glb = await glbPromise;
  expect(glb.suggestedFilename()).toBe("polygon-model.glb");

  const stlPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "STL出力" }).click();
  const stl = await stlPromise;
  expect(stl.suggestedFilename()).toBe("polygon-model.stl");
  const stlPath = await stl.path();
  expect(stlPath).not.toBeNull();

  await page.getByRole("button", { name: "削除" }).click();
  await page.getByLabel("GLBまたはSTLを読み込む").setInputFiles(stlPath!);
  await expect(
    page.getByRole("button", { name: "STL Mesh", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("頂点: 8")).toBeVisible();
  await expect(page.getByText("面: 12")).toBeVisible();
});
