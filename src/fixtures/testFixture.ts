import { test as base, Page } from '@playwright/test';
import { LoginPage } from '@pages/loginPage';

type MyFixtures = {
  loginPage: LoginPage;
};

export const test = base.extend<MyFixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  }
});