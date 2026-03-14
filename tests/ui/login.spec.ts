import { test } from "@playwright/test";
import { LoginPage } from "@pages/loginPage";

test("Login Test", async ({ page }) => {

 const loginPage = new LoginPage(page);

 await loginPage.navigate("https://www.saucedemo.com");

 await loginPage.login("standard_user", "secret_sauce");

});