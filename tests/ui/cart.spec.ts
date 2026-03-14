import { expect } from '@playwright/test';
import { test } from "@core/fixtures/testFixture";
import { users, urls } from "@data/testData";
import { logger } from '@core/utils/logger';


test('Add product to cart', async ({ loginPage, cartPage }) => {

 await loginPage.navigate(urls.sauceDemoUrl);
 await loginPage.login(users.validUser.username, users.validUser.password);

 logger.info("Login successful for user: " + users.validUser.username);

 await cartPage.addItem();

 logger.info("Product added to cart");
 await cartPage.openCart();

 logger.info("Cart opened");

 await expect(cartPage.getPage().locator('.cart_item')).toBeVisible();

});