import { test } from "@fixtures/testFixture";

test("Login Test", async ({ loginPage }) => {

  await loginPage.navigate("https://www.saucedemo.com");

  await loginPage.login("standard_user", "secret_sauce");

});