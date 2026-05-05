import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  API_KEY: z.string().min(16, "API_KEY must be at least 16 chars"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast at boot with a useful message instead of mysterious runtime errors.
  console.error("Invalid environment:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment, see above");
}

export const env = parsed.data;
