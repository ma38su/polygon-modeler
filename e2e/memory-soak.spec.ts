import { expect, test } from "@playwright/test";

const enabled = process.env.RUN_MEMORY_SOAK === "1";
const durationMinutes = Number(process.env.MEMORY_SOAK_MINUTES ?? "30");
const durationMs = durationMinutes * 60_000;

test.skip(!enabled, "長時間メモリ試験は npm run test:memory で実行します");

test("keeps editing memory bounded for a continuous session", async ({
  page,
}) => {
  test.setTimeout(durationMs + 120_000);
  await page.goto("/?renderer=webgl2");
  await page.getByRole("button", { name: "Box追加" }).click();
  await page.getByRole("button", { name: "Box 1", exact: true }).click();

  const client = await page.context().newCDPSession(page);
  await client.send("Performance.enable");
  const samples: Array<{
    elapsedMinutes: number;
    heap: number;
    nodes: number;
    listeners: number;
  }> = [];
  const started = Date.now();
  let nextSample = started;
  let iteration = 0;

  while (Date.now() - started < durationMs) {
    const positionX = page
      .getByRole("group", { name: "位置" })
      .getByRole("spinbutton")
      .first();
    await positionX.fill(String((iteration % 20) / 10));
    await positionX.blur();
    await page.getByRole("button", { name: "元に戻す" }).click();
    await page.getByRole("button", { name: "やり直す" }).click();

    const display = page.getByLabel("表示レイヤー");
    await display.getByRole("button", { name: "Vertex" }).click();
    await display.getByRole("button", { name: "Vertex" }).click();
    await display.getByRole("button", { name: "Edge" }).click();
    await display.getByRole("button", { name: "Edge" }).click();

    if (Date.now() >= nextSample) {
      await page.requestGC();
      const metrics = await client.send("Performance.getMetrics");
      const counters = await client.send("Memory.getDOMCounters");
      const metric = (name: string) =>
        metrics.metrics.find((item) => item.name === name)?.value ?? 0;
      const sample = {
        elapsedMinutes: (Date.now() - started) / 60_000,
        heap: metric("JSHeapUsedSize"),
        nodes: counters.nodes,
        listeners: counters.jsEventListeners,
      };
      samples.push(sample);
      console.log(`MEMORY_SAMPLE ${JSON.stringify(sample)}`);
      nextSample += 60_000;
    }
    iteration += 1;
    await page.waitForTimeout(250);
  }

  await page.requestGC();
  const stable = samples.slice(Math.min(2, samples.length - 1));
  const first = stable[0]!;
  const last = stable.at(-1)!;
  expect(last.heap).toBeLessThanOrEqual(
    Math.max(first.heap * 1.35, first.heap + 16_000_000),
  );
  expect(last.nodes).toBeLessThanOrEqual(first.nodes + 100);
  expect(last.listeners).toBeLessThanOrEqual(first.listeners + 20);
  console.log(
    `MEMORY_RESULT ${JSON.stringify({ durationMinutes, iterations: iteration, first, last })}`,
  );
});
