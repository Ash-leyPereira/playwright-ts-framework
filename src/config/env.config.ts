import dotenv from "dotenv";

dotenv.config({
 path: `.env.${process.env.ENV}`
});

export const BASE_URL = process.env.BASE_URL;