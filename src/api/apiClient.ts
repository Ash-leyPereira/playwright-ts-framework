import { request } from "@playwright/test";

export async function createApiContext() {

 return await request.newContext({

   baseURL: process.env.API_URL

 });

}