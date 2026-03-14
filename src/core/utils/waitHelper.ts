import { Page } from '@playwright/test';

export async function waitForPageLoad(page: Page) {

 await page.waitForLoadState('networkidle');

}