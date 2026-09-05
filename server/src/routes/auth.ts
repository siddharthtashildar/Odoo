import { Router } from "express";
import crypto from "node:crypto";
import { prisma } from "../lib/prisma";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { sendCredentialsEmail, emailAuditLog, getDispatchedEmails } from "../lib/email";

const router = Router();

// ── 1. POST /api/auth/provision-user ──────────────────────────────────────────
// STRICTLY RESTRICTED TO HR: Only HR Manager or Administrator can provision accounts
router.post("/provision-user", async (req, res) => {
  try {
    const callerRole = (req.headers["x-user-role"] as string | undefined) || req.body.callerRole;

    // Strict HR Access Control Check
    if (callerRole !== "hr_manager" && callerRole !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Forbidden: Only HR Managers and Administrators are authorized to provision user accounts and dispatch credentials.",
      });
    }

    const { employeeId, email, role = "employee", customPassword } = req.body as {
      employeeId?: string;
      email?: string;
      role?: string;
      customPassword?: string;
    };

    if (!employeeId && !email) {
      return res.status(400).json({ success: false, error: "employeeId or email is required" });
    }

    const isUuid = employeeId ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(employeeId) : false;
    let employee = null;

    if (isUuid && employeeId) {
      employee = await prisma.employees.findUnique({
        where: { id: employeeId },
        include: {
          departments_employees_department_idTodepartments: { select: { name: true } },
          designations: { select: { title: true } },
        },
      });
    }

    if (!employee) {
      const searchCode = employeeId || "";
      const mappedCode = searchCode.startsWith("E") ? searchCode.replace(/^E/, "PP-") : searchCode;
      employee = await prisma.employees.findFirst({
        where: {
          OR: [
            ...(email ? [{ email }] : []),
            ...(searchCode ? [{ employee_code: searchCode }, { employee_code: mappedCode }, { email: searchCode }] : []),
          ],
        },
        include: {
          departments_employees_department_idTodepartments: { select: { name: true } },
          designations: { select: { title: true } },
        },
      });
    }

    if (!employee) {
      return res.status(404).json({ success: false, error: "Employee record not found" });
    }

    // Generate secure temporary password (or use custom if specified by HR)
    const temporaryPassword =
      customPassword ||
      `PP360!${Math.random().toString(36).slice(2, 6).toUpperCase()}${Math.floor(100 + Math.random() * 900)}`;

    const passwordHash = await hashPassword(temporaryPassword);

    // Check if user already exists in Better Auth table
    let betterUser = await prisma.user.findUnique({
      where: { email: employee.email },
    });

    if (betterUser) {
      // User exists — update role and re-set credentials
      betterUser = await prisma.user.update({
        where: { id: betterUser.id },
        data: {
          name: employee.full_name,
          role,
          employeeId: employee.id,
        },
      });

      // Update or create credential account
      const existingAccount = await prisma.account.findFirst({
        where: { userId: betterUser.id, providerId: "credential" },
      });

      if (existingAccount) {
        await prisma.account.update({
          where: { id: existingAccount.id },
          data: { password: passwordHash },
        });
      } else {
        await prisma.account.create({
          data: {
            id: crypto.randomUUID(),
            userId: betterUser.id,
            accountId: betterUser.id,
            providerId: "credential",
            password: passwordHash,
          },
        });
      }
    } else {
      // Create new Better Auth User & Account
      const newUserId = crypto.randomUUID();
      betterUser = await prisma.user.create({
        data: {
          id: newUserId,
          name: employee.full_name,
          email: employee.email,
          emailVerified: true,
          role,
          employeeId: employee.id,
        },
      });

      await prisma.account.create({
        data: {
          id: crypto.randomUUID(),
          userId: newUserId,
          accountId: newUserId,
          providerId: "credential",
          password: passwordHash,
        },
      });
    }

    // Dispatch credentials email to the employee with password change redirection
    const frontendUrl = (process.env.FRONTEND_URL as string | undefined) || "http://localhost:8081";
    const changePasswordUrl = `${frontendUrl}/?action=change-password&email=${encodeURIComponent(employee.email)}`;
    const emailResult = await sendCredentialsEmail({
      to: employee.email,
      employeeName: employee.full_name,
      role,
      temporaryPassword,
      loginUrl: changePasswordUrl,
    });

    res.json({
      success: true,
      message: `User account provisioned successfully. Credentials dispatched to ${employee.email}.`,
      data: {
        userId: betterUser.id,
        email: betterUser.email,
        name: betterUser.name,
        role: betterUser.role,
        employeeId: employee.id,
        credentials: {
          email: employee.email,
          temporaryPassword,
          loginUrl: changePasswordUrl,
        },
        emailDispatched: emailResult.success,
        messageId: emailResult.messageId,
        previewUrl: emailResult.previewUrl,
      },
    });
  } catch (err) {
    console.error("Provision user error:", err);
    res.status(500).json({ success: false, error: "Failed to provision user account" });
  }
});

// ── 2. GET /api/auth/dispatched-emails ─────────────────────────────────────────
// Allows HR and Admin to view audit records of dispatched credential emails
router.get("/dispatched-emails", (req, res) => {
  const callerRole = (req.headers["x-user-role"] as string | undefined) || (req.query.role as string | undefined);

  if (callerRole && callerRole !== "hr_manager" && callerRole !== "admin") {
    return res.status(403).json({ success: false, error: "Forbidden: HR access required" });
  }

  const emails = getDispatchedEmails();
  res.json({
    success: true,
    data: emails,
    total: emails.length,
  });
});

// ── 3. POST /api/auth/login ───────────────────────────────────────────────────
// Authenticate using Better Auth credentials or email lookup
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email) {
      return res.status(400).json({ success: false, error: "Email is required" });
    }

    // Check Better Auth user table first
    const betterUser = await prisma.user.findUnique({
      where: { email },
      include: {
        accounts: { where: { providerId: "credential" } },
      },
    });

    if (betterUser) {
      // If password provided, verify against Better Auth account hash
      if (password && betterUser.accounts.length > 0 && betterUser.accounts[0].password) {
        const isValid = await verifyPassword({
          password,
          hash: betterUser.accounts[0].password,
        });

        if (!isValid) {
          return res.status(401).json({ success: false, error: "Invalid email or password" });
        }
      }

      // Fetch employee info if linked
      let employeeName = betterUser.name;
      let employeeId = betterUser.employeeId ?? null;
      let employeeCode: string | null = null;
      if (betterUser.employeeId) {
        const emp = await prisma.employees.findUnique({ where: { id: betterUser.employeeId } });
        if (emp) {
          employeeName = emp.full_name;
          employeeCode = emp.employee_code;
        }
      } else {
        // Auto-link by email if employee record exists
        const emp = await prisma.employees.findFirst({ where: { email } });
        if (emp) {
          employeeId = emp.id;
          employeeName = emp.full_name;
          employeeCode = emp.employee_code;
          await prisma.user.update({ where: { id: betterUser.id }, data: { employeeId: emp.id } }).catch(() => {});
        }
      }

      return res.json({
        success: true,
        data: {
          userId: betterUser.id,
          email: betterUser.email,
          role: betterUser.role || "employee",
          employeeId,
          employeeCode,
          employeeName,
        },
      });
    }

    // Fallback check against legacy users table for demo backwards compatibility
    const legacyUser = await prisma.users.findUnique({
      where: { email },
      include: {
        roles: { select: { name: true } },
        employees: { select: { id: true, full_name: true, employee_code: true } },
      },
    });

    if (!legacyUser || !legacyUser.is_active) {
      return res.status(401).json({ success: false, error: "User not found or inactive" });
    }

    res.json({
      success: true,
      data: {
        userId: legacyUser.id,
        email: legacyUser.email,
        role: legacyUser.roles.name,
        employeeId: legacyUser.employees?.id ?? null,
        employeeCode: legacyUser.employees?.employee_code ?? null,
        employeeName: legacyUser.employees?.full_name ?? legacyUser.email,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, error: "Login failed" });
  }
});

// ── 4. GET /api/auth/me ───────────────────────────────────────────────────────
router.get("/me", async (req, res) => {
  const email = (req.headers["x-user-email"] as string | undefined) || (req.query.email as string | undefined);
  if (!email) {
    return res.status(401).json({ success: false, error: "Not authenticated" });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(404).json({ success: false, error: "User not found" });
  }

  res.json({ success: true, data: user });
});

// ── 5. POST /api/auth/change-password ──────────────────────────────────────────
// Allows employee/user to change their temporary password to a permanent password
router.post("/change-password", async (req, res) => {
  try {
    const { email, currentPassword, newPassword } = req.body as {
      email?: string;
      currentPassword?: string;
      newPassword?: string;
    };

    if (!email || !newPassword) {
      return res.status(400).json({ success: false, error: "Email and new password are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: "New password must be at least 6 characters" });
    }

    // Check Better Auth user table
    const betterUser = await prisma.user.findUnique({
      where: { email },
      include: {
        accounts: { where: { providerId: "credential" } },
      },
    });

    if (!betterUser) {
      return res.status(404).json({ success: false, error: "User account not found" });
    }

    // If current password is provided, verify it
    if (currentPassword && betterUser.accounts.length > 0 && betterUser.accounts[0].password) {
      const isValid = await verifyPassword({
        password: currentPassword,
        hash: betterUser.accounts[0].password,
      });

      if (!isValid) {
        return res.status(401).json({ success: false, error: "Current temporary password is incorrect" });
      }
    }

    // Hash the new password
    const newHash = await hashPassword(newPassword);

    if (betterUser.accounts.length > 0) {
      await prisma.account.update({
        where: { id: betterUser.accounts[0].id },
        data: { password: newHash },
      });
    } else {
      await prisma.account.create({
        data: {
          id: crypto.randomUUID(),
          userId: betterUser.id,
          accountId: betterUser.id,
          providerId: "credential",
          password: newHash,
        },
      });
    }

    // Resolve employee info if linked
    let employeeName = betterUser.name;
    let employeeId = betterUser.employeeId ?? null;
    let employeeCode: string | null = null;
    if (betterUser.employeeId) {
      const emp = await prisma.employees.findUnique({ where: { id: betterUser.employeeId } });
      if (emp) {
        employeeName = emp.full_name;
        employeeCode = emp.employee_code;
      }
    } else {
      const emp = await prisma.employees.findFirst({ where: { email } });
      if (emp) {
        employeeId = emp.id;
        employeeName = emp.full_name;
        employeeCode = emp.employee_code;
        await prisma.user.update({ where: { id: betterUser.id }, data: { employeeId: emp.id } }).catch(() => {});
      }
    }

    // Move employee onboarding status to in_progress upon password change
    if (employeeId) {
      await prisma.onboarding_processes.updateMany({
        where: { employee_id: employeeId },
        data: {
          notes: "password_changed",
        },
      }).catch((err) => {
        console.warn("Failed to mark onboarding password_changed:", err);
      });
    }

    res.json({
      success: true,
      message: "Password changed successfully! You may now sign in with your new permanent password.",
      data: {
        userId: betterUser.id,
        email: betterUser.email,
        role: betterUser.role || "employee",
        employeeId,
        employeeCode,
        employeeName,
      },
    });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ success: false, error: "Failed to change password" });
  }
});

export default router;
