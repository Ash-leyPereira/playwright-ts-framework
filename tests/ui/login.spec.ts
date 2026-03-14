import { test } from "@core/fixtures/testFixture";
import { expect } from "@playwright/test";
import { users, urls } from "@data/testData";
import { logger } from "@core/utils/logger";

test('Login with valid credentials', async ({ loginPage }) => {

 await loginPage.navigate(urls.sauceDemoUrl);

 await loginPage.login(users.validUser.username, users.validUser.password);

 logger.info("Login successful for user: " + users.validUser.username);

 await expect(loginPage.getPage()).toHaveURL(/inventory/);

});

test('Login with invalid credentials', async ({ loginPage }) => {

 await loginPage.navigate(urls.sauceDemoUrl);

 await loginPage.login(users.invalidUser.username, users.invalidUser.password);

 logger.info("Login failed for user: " + users.invalidUser.username);

 await expect(loginPage.getPage().locator('.error-message-container')).toBeVisible();

});