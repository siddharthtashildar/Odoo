import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth";

dotenv.config();

import employeesRouter from "./routes/employees";
import contractsRouter from "./routes/contracts";
import attendanceRouter from "./routes/attendance";
import leaveRouter from "./routes/leave";
import payrollRouter from "./routes/payroll";
import salaryRouter from "./routes/salary";
import reimbursementsRouter from "./routes/reimbursements";
import allowancesRouter from "./routes/allowances";
import assetsRouter from "./routes/assets";
import helpdeskRouter from "./routes/helpdesk";
import authRouter from "./routes/auth";

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:8080",
      "http://localhost:8081",
      "http://localhost:8082",
      "http://localhost:8083",
      "http://localhost:5173",
      "http://192.168.33.1:8080",
    ],
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
    credentials: true,
  }),
);

// Better Auth requires raw or standard JSON body handling
app.use(express.json());

// Health check
app.get("/", (_req, res) => {
  res.json({ success: true, message: "PeoplePay360 API running 🚀", version: "2.0" });
});

// Custom Auth Routes (provision-user, dispatched-emails, login fallback, me)
app.use("/api/auth", authRouter);

// Better Auth Engine Handler (sign-in, get-session, etc.)
app.all("/api/auth/*splat", toNodeHandler(auth));

// Application API Routes
app.use("/api/employees", employeesRouter);
app.use("/api/contracts", contractsRouter);
app.use("/api/attendance", attendanceRouter);
app.use("/api/leave", leaveRouter);
app.use("/api/payroll", payrollRouter);
app.use("/api/salary", salaryRouter);
app.use("/api/reimbursements", reimbursementsRouter);
app.use("/api/allowances", allowancesRouter);
app.use("/api/assets", assetsRouter);
app.use("/api/helpdesk", helpdeskRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, error: "Route not found" });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`✅ PeoplePay360 API running on http://localhost:${PORT}`);
});