import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: (import.meta.env["VITE_API_URL"] as string | undefined) ?? "http://localhost:5001",
});
