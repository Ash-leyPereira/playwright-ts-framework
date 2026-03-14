import { test as base, Page } from '@playwright/test';
import { LoginPage } from '@pages/loginPage';
import { CartPage } from '@pages/cartPage';

type MyFixtures = {
  loginPage: LoginPage;
  cartPage: CartPage;
};

export const test = base.extend<MyFixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  cartPage: async ({ page }, use) => {

   const cartPage = new CartPage(page);
   await use(cartPage);
  }
});
