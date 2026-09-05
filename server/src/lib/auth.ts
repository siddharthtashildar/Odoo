import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:5000",
  secret: process.env.BETTER_AUTH_SECRET || "peoplepay360-better-auth-secret-key-super-secure-2026",
  emailAndPassword: {
    enabled: true,
    disableSignUp: true, // Only HR Manager / Admin can create users!
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "employee",
      },
      employeeId: {
        type: "string",
        required: false,
      },
    },
  },
  trustedOrigins: [
    "http://localhost:8080",
    "http://localhost:8081",
    "http://localhost:8082",
    "http://localhost:5173",
  ],
});
