import { test, expect } from "@playwright/test";
import { createApiContext } from "@api/apiClient";

test("API Test", async () => {

 const api = await createApiContext();

 const response = await api.get("/users");

 expect(response.status()).toBe(200);

});