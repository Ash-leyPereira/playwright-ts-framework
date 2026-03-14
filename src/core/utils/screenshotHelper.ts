import { Page } from "@playwright/test";

export async function takeScreenshot(page: Page, name: string) {

 await page.screenshot({
   path: `reports/screenshots/${name}.png`
 });

}