import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("sample question has inspectable source passages", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Retrieval demo", { exact: true })).toBeVisible();
  const library = page.getByRole("complementary", { name: "Document library" });
  await expect(library.getByText("employee-handbook.md", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "How many days of annual leave do employees receive?" }).click();
  await page.getByRole("button", { name: "Ask question" }).click();
  const answer = page.getByRole("region", { name: "Answer", exact: true });
  await expect(answer).toContainText("30 days");
  await answer.getByRole("button", { name: "Open source 1", exact: true }).click();
  await expect(answer.locator("blockquote").first()).toBeVisible();
});

test("upload, ask, and delete a new document", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Retrieval demo", { exact: true })).toBeVisible();
  const library = page.getByRole("complementary", { name: "Document library" });
  await library.getByLabel("Upload document", { exact: true }).setInputFiles({
    name: "warranty.txt", mimeType: "text/plain",
    buffer: Buffer.from("The bicycle warranty lasts exactly 42 months."),
  });
  await expect(library.getByText("warranty.txt", { exact: true })).toBeVisible();
  await library.getByRole("checkbox", { name: /warranty.txt/ }).check();
  await page.getByLabel("Your question", { exact: true }).fill("How long does the bicycle warranty last?");
  await page.getByRole("button", { name: "Ask question" }).click();
  await expect(page.getByRole("region", { name: "Answer", exact: true })).toContainText("42 months");
  page.once("dialog", (dialog) => dialog.accept());
  await library.getByRole("button", { name: "Delete warranty.txt", exact: true }).click();
  await expect(library.getByText("warranty.txt", { exact: true })).toHaveCount(0);
});

test("unanswerable questions show an honest refusal", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Retrieval demo", { exact: true })).toBeVisible();
  await page.getByLabel("Your question", { exact: true }).fill("Which astronauts visited Jupiter?");
  await page.getByRole("button", { name: "Ask question" }).click();
  await expect(page.getByRole("heading", { name: "More information needed" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Answer", exact: true })).toContainText("couldn't find enough information");
});

test("sample repair checklist cites the current approval procedure and flags gaps", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Repair Estimate Checklist", exact: true }).click();
  await page.getByRole("button", { name: "Run sample case" }).click();
  const checklist = page.getByRole("region", { name: "Checklist results" });
  await expect(checklist.getByRole("heading", { name: "Photos", exact: true })).toBeVisible();
  await expect(checklist.getByRole("heading", { name: "Documents", exact: true })).toBeVisible();
  await expect(checklist.getByRole("heading", { name: "Approvals", exact: true })).toBeVisible();
  await expect(checklist.getByRole("heading", { name: "Needs manual confirmation" })).toBeVisible();
  await expect(checklist).toContainText("EUR 300");
  await expect(checklist).not.toContainText("EUR 500");
  await checklist.getByText(/Source supplement-approval-v2\.md/).click();
  await expect(checklist.locator("blockquote").filter({ hasText: "EUR 300" })).toBeVisible();
  await checklist.getByRole("checkbox", { name: /Obtain written authorization/ }).check();
  await expect(checklist.getByText("1 of 5 complete")).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await checklist.getByRole("button", { name: "Export Markdown" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("repair-checklist.md");
  const markdown = await readFile(await download.path(), "utf8");
  expect(markdown).toContain("- [x] Obtain written authorization");
  expect(markdown).toContain("EUR 300");
});

test("passage search and browsing lead to a persistent notebook entry", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Retrieval demo", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Evidence Explorer", exact: true }).click();
  await page.getByLabel("Search passages").fill("database backups run");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const results = page.getByRole("region", { name: "Passage results" });
  await expect(results).toContainText("disaster-recovery.md");
  await page.getByLabel("Browse a document").selectOption({ label: "employee-handbook.md" });
  await page.getByRole("button", { name: "Browse", exact: true }).click();
  await results.locator("summary").first().click();
  await expect(results.locator("blockquote").first()).toContainText("30 days");
  await results.getByRole("button", { name: "Save passage", exact: true }).click();
  await expect(results.getByRole("button", { name: "Passage saved", exact: true })).toBeDisabled();

  await page.getByRole("button", { name: "Evidence Notebook", exact: true }).click();
  await page.getByLabel("Note", { exact: true }).fill("Review this holiday policy during onboarding.");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(page.getByText("Note saved.")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Evidence Notebook", exact: true }).click();
  await expect(page.getByLabel("Note", { exact: true })).toHaveValue("Review this holiday policy during onboarding.");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Markdown" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("evidence-notebook.md");
  expect(await readFile(await download.path(), "utf8")).toContain("holiday policy during onboarding");
  await page.getByRole("button", { name: "Remove passage", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No saved passages" })).toBeVisible();
});

test("narrow layouts provide access to the library and workspace navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Ask your documents" })).toBeVisible();
  await page.getByRole("button", { name: "Show files", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: /employee-handbook.md/ })).toBeVisible();
  await page.getByRole("button", { name: "Evidence Notebook", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Evidence Notebook", exact: true })).toBeVisible();
  expect(await page.locator("body").evaluate((body) => body.scrollWidth)).toBe(390);
});
