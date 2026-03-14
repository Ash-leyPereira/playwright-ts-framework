import { BasePage } from '@core/base/basePage';
import { Page } from '@playwright/test';

export class CartPage extends BasePage {

 constructor(protected page: Page) {
   super(page);
 }

 addBackpack = '#add-to-cart-sauce-labs-backpack';
 cartIcon = '.shopping_cart_link';

 async addItem() {
   await this.page.click(this.addBackpack);
 }

 async openCart() {
   await this.page.click(this.cartIcon);
 }

}