import { Page } from "@playwright/test";

export class BasePage {

 constructor(protected page: Page) {}

 public getPage(): Page {
    return this.page;
  }

 async navigate(url: string) {
   await this.page.goto(url);
 }

 async click(locator: string) {
   await this.page.locator(locator).click();
 }

 async fill(locator: string, value: string) {
   await this.page.fill(locator, value);
 }

}