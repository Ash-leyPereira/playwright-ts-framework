import { Page } from "@playwright/test";
import { BasePage } from "@core/base/basePage";

export class LoginPage extends BasePage {

 username = "#user-name";
 password = "#password";
 loginBtn = "#login-button";

 constructor(page: Page) {
   super(page);
 }

 async login(user: string, pass: string) {

   await this.fill(this.username, user);
   await this.fill(this.password, pass);

   await this.click(this.loginBtn);

 }

}