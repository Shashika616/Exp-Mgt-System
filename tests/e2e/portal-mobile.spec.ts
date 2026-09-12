import { expect, test } from "./helpers/fixtures";
import { USERS, login } from "./helpers/auth";

/** FR-CP-09: mobile-first portal with a bottom-sheet new-request flow. */
test("portal new request works as a bottom sheet on a phone", async ({ page }) => {
  await login(page, USERS.clientUser);
  await page.goto("/portal/new");
  await page.getByTestId("type-question").click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  await sheet.getByTestId("subject").fill("How do we archive job cards older than 3 years?");
  await sheet.getByTestId("description").fill("We want to keep the list fast but retain history for audits.");
  await sheet.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByTestId("request-confirmation")).toBeVisible();
  await page.goto("/portal");
  await expect(page.getByTestId("new-request")).toBeVisible();
  const box = await page.getByTestId("new-request").boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(36);
});
