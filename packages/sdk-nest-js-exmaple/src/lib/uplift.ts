import { UpliftAI } from "@upliftai/sdk-js";

let client: UpliftAI | null = null;

export function getClient(): UpliftAI {
  if (!client) {
    client = new UpliftAI({
      apiKey: process.env.UPLIFTAI_API_KEY,
    });
  }
  return client;
}
