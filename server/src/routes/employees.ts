import { Router } from "express";
import crypto from "node:crypto";
import { prisma } from "../lib/prisma";
import { hashPassword } from "better-auth/crypto";
import { sendCredentialsEmail } from "../lib/email";
import { resolveEmployee } from "../lib/resolve-employee";

const router = Router();

// ── GET /api/employees ────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { department, status, q } = req.query as { department?: string; status?: string; q?: string };

    const employees = await prisma.employees.findMany({
      where: {
        ...(department && department !== "all" && {
          departments_employees_department_idTodepartments: { name: { equals: department, mode: "insensitive" } },
        }),
        ...(status && status !== "all" && { status: status as any }),
        ...(q && {
          OR: [
            { full_name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { employee_code: { contains: q, mode: "insensitive" } },
          ],
        }),
      },
      orderBy: { created_at: "desc" },
      include: {
        departments_employees_department_idTodepartments: { select: { name: true } },
        designations: { select: { title: true } },
        employees: { select: { full_name: true } }, // reporting manager
        contracts: { where: { status: "active" }, orderBy: { created_at: "desc" }, take: 1 },
      },
    });

    const mapped = employees.map((e) => ({
      id: e.id,
      code: e.employee_code,
      name: e.full_name,
      email: e.email,
      phone: e.phone ?? "",
      department: e.departments_employees_department_idTodepartments?.name ?? "Engineering",
      designation: e.designations?.title ?? "Staff",
      manager: e.employees?.full_name ?? "",
      employmentType: e.employment_type === "full_time" ? "Full-time" : e.employment_type === "part_time" ? "Part-time" : e.employment_type,
      status: e.status === "notice_period" ? "offboarding" : e.status,
      joinedOn: e.joining_date?.toISOString().slice(0, 10) ?? "",
      exitDate: e.exit_date?.toISOString().slice(0, 10) ?? null,
      ctc: e.contracts[0]?.salary ? Number(e.contracts[0].salary) : 1800000,
      location: e.address || "Ahmedabad HQ",
      bankAccount: e.bank_account_number || "HDFC00984210",
      bankName: e.bank_name || "HDFC Bank",
      pan: `AAAC${e.employee_code.replace(/[^0-9]/g, "").slice(0, 4) || "1234"}P`,
      leaveBalance: 18,
    }));

    res.json({ success: true, data: mapped });
  } catch (err) {
    console.error("Fetch employees error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch employees" });
  }
});

// ── GET /api/employees/:id ────────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const e = await resolveEmployee(req.params.id);
    if (!e) return res.status(404).json({ success: false, error: "Employee not found" });

    // Fetch active contract
    const contract = await prisma.contracts.findFirst({
      where: { employee_id: e.id, status: "active" },
      orderBy: { created_at: "desc" },
    });

    res.json({
      success: true,
      data: {
        id: e.id,
        code: e.employee_code,
        name: e.full_name,
        email: e.email,
        phone: e.phone ?? "",
        department: e.departments_employees_department_idTodepartments?.name ?? "",
        designation: e.designations?.title ?? "",
        manager: e.employees?.full_name ?? "",
        employmentType: e.employment_type,
        status: e.status === "notice_period" ? "offboarding" : e.status,
        joinedOn: e.joining_date?.toISOString().slice(0, 10),
        bankAccount: e.bank_account_number ?? "Pending",
        address: e.address ?? "",
        ctc: contract?.salary ? Number(contract.salary) : 0,
      },
    });
  } catch (err) {
    console.error("Fetch employee error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch employee" });
  }
});

// ── POST /api/employees (CREATE NEW EMPLOYEE) ──────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const {
      name,
      email,
      phone = "+91 98000 12345",
      department = "Engineering",
      designation = "Software Engineer",
      manager,
      employmentType = "full_time",
      joinedOn = new Date().toISOString().slice(0, 10),
      ctc = 1800000,
      location = "Ahmedabad",
      autoProvision = true,
      role = "employee",
      customPassword,
      status,
    } = req.body as {
      name: string;
      email: string;
      phone?: string;
      department?: string;
      designation?: string;
      manager?: string;
      employmentType?: string;
      joinedOn?: string;
      ctc?: number;
      location?: string;
      autoProvision?: boolean;
      role?: string;
      customPassword?: string;
      status?: string;
    };

    if (!name || !email) {
      return res.status(400).json({ success: false, error: "Name and email are required" });
    }

    // Check if email already registered
    const existing = await prisma.employees.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ success: false, error: "An employee with this email already exists" });
    }

    // 1. Resolve or create Department
    let deptRecord = await prisma.departments.findFirst({
      where: { name: { equals: department, mode: "insensitive" } },
    });
    if (!deptRecord) {
      const deptCode = department.slice(0, 3).toUpperCase();
      deptRecord = await prisma.departments.create({
        data: { name: department, code: `${deptCode}-${Date.now().toString().slice(-3)}` },
      });
    }

    // 2. Resolve or create Designation
    let desigRecord = await prisma.designations.findFirst({
      where: { title: { equals: designation, mode: "insensitive" } },
    });
    if (!desigRecord) {
      desigRecord = await prisma.designations.create({
        data: { title: designation, department_id: deptRecord.id },
      });
    }

    // 3. Resolve Reporting Manager
    let managerId: string | null = null;
    if (manager) {
      const mgr = await resolveEmployee(manager);
      if (mgr) managerId = mgr.id;
    }

    // 4. Generate Employee Code
    const employeeCode = `PP-${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}`;

    // 5. Create Employee in PostgreSQL
    const empTypeNorm =
      employmentType.toLowerCase().includes("part") ? "part_time" :
      employmentType.toLowerCase().includes("contract") ? "contract" :
      employmentType.toLowerCase().includes("intern") ? "intern" :
      employmentType.toLowerCase().includes("consultant") ? "consultant" : "full_time";

    const statusNorm = status
      ? status.toLowerCase() === "active"
        ? "active"
        : status.toLowerCase() === "onboarding"
          ? "onboarding"
          : status.toLowerCase() === "offboarding"
            ? "offboarding"
            : status.toLowerCase() === "exited"
              ? "exited"
              : "onboarding"
      : "onboarding";

    const employee = await prisma.employees.create({
      data: {
        id: crypto.randomUUID(),
        employee_code: employeeCode,
        full_name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        department_id: deptRecord.id,
        designation_id: desigRecord.id,
        reporting_manager_id: managerId,
        employment_type: empTypeNorm as any,
        status: statusNorm as any,
        joining_date: new Date(joinedOn),
        address: location,
      },
    });

    // 6. Create Initial Employment Contract
    const contractNumber = `CT-${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}`;
    const contractType =
      empTypeNorm === "intern" ? "intern" :
      empTypeNorm === "contract" ? "fixed_term" :
      empTypeNorm === "consultant" ? "consultant" : "permanent";

    await prisma.contracts.create({
      data: {
        id: crypto.randomUUID(),
        contract_number: contractNumber,
        employee_id: employee.id,
        department_id: deptRecord.id,
        designation_id: desigRecord.id,
        contract_type: contractType as any,
        salary: Number(ctc),
        start_date: new Date(joinedOn),
        status: "active",
        employee_accepted: true,
      },
    });

    // 7. Assign Standard Salary Structure
    const defaultStructure = await prisma.salary_structures.findFirst({
      where: { status: "active" },
      orderBy: { created_at: "asc" },
    });

    if (defaultStructure) {
      await prisma.employee_salary_structures.create({
        data: {
          id: crypto.randomUUID(),
          employee_id: employee.id,
          structure_id: defaultStructure.id,
          effective_from: new Date(joinedOn),
          is_current: true,
        },
      });
    }

    // 8. Auto-Provision Better Auth Account & Send Email if requested
    let provisionData = null;
    if (autoProvision) {
      const temporaryPassword =
        customPassword ||
        `PP360!${Math.random().toString(36).slice(2, 6).toUpperCase()}${Math.floor(100 + Math.random() * 900)}`;
      const passwordHash = await hashPassword(temporaryPassword);

      let betterUser = await prisma.user.findUnique({ where: { email: employee.email } });
      if (betterUser) {
        betterUser = await prisma.user.update({
          where: { id: betterUser.id },
          data: { employeeId: employee.id, role },
        });
      } else {
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

      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:8081";
      const changePasswordUrl = `${frontendUrl}/?action=change-password&email=${encodeURIComponent(employee.email)}`;
      const emailResult = await sendCredentialsEmail({
        to: employee.email,
        employeeName: employee.full_name,
        role,
        temporaryPassword,
        loginUrl: changePasswordUrl,
      });

      provisionData = {
        userId: betterUser.id,
        credentials: {
          email: employee.email,
          temporaryPassword,
          loginUrl: changePasswordUrl,
        },
        emailDispatched: emailResult.success,
        previewUrl: emailResult.previewUrl,
      };
    }

    res.status(201).json({
      success: true,
      message: "Employee successfully created in database",
      data: {
        id: employee.id,
        code: employee.employee_code,
        name: employee.full_name,
        email: employee.email,
        phone: employee.phone,
        department: deptRecord.name,
        designation: desigRecord.title,
        manager: manager || "",
        employmentType: employee.employment_type,
        status: employee.status,
        joinedOn: employee.joining_date.toISOString().slice(0, 10),
        ctc: Number(ctc),
        provision: provisionData,
      },
    });
  } catch (err) {
    console.error("Create employee error:", err);
    res.status(500).json({ success: false, error: "Failed to create employee" });
  }
});

// ── PATCH /api/employees/:id ──────────────────────────────────────────────────
router.patch("/:id", async (req, res) => {
  try {
    const e = await resolveEmployee(req.params.id);
    if (!e) return res.status(404).json({ success: false, error: "Employee not found" });

    const {
      name,
      status,
      phone,
      address,
      department,
      designation,
      manager,
      ctc,
    } = req.body as {
      name?: string;
      status?: string;
      phone?: string;
      address?: string;
      department?: string;
      designation?: string;
      manager?: string;
      ctc?: number;
    };

    let deptId = e.department_id;
    if (department && department !== e.departments_employees_department_idTodepartments?.name) {
      let deptRecord = await prisma.departments.findFirst({
        where: { name: { equals: department, mode: "insensitive" } },
      });
      if (!deptRecord) {
        deptRecord = await prisma.departments.create({
          data: { name: department, code: `${department.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-3)}` },
        });
      }
      deptId = deptRecord.id;
    }

    let desigId = e.designation_id;
    if (designation && designation !== e.designations?.title) {
      let desigRecord = await prisma.designations.findFirst({
        where: { title: { equals: designation, mode: "insensitive" } },
      });
      if (!desigRecord) {
        desigRecord = await prisma.designations.create({
          data: { title: designation, department_id: deptId },
        });
      }
      desigId = desigRecord.id;
    }

    let managerId = e.reporting_manager_id;
    if (manager) {
      const mgr = await resolveEmployee(manager);
      if (mgr) managerId = mgr.id;
    }

    const updated = await prisma.employees.update({
      where: { id: e.id },
      data: {
        ...(name && { full_name: name.trim() }),
        ...(status && {
          status: status as any,
          ...(status === "exited" ? { exit_date: new Date() } : { exit_date: null }),
        }),
        ...(phone && { phone }),
        ...(address && { address }),
        ...((req.body as any).location && { address: (req.body as any).location }),
        ...((req.body as any).bankAccount && { bank_account_number: (req.body as any).bankAccount }),
        ...((req.body as any).bankName && { bank_name: (req.body as any).bankName }),
        department_id: deptId,
        designation_id: desigId,
        reporting_manager_id: managerId,
        updated_at: new Date(),
      },
    });

    // If CTC changed, update current contract
    if (ctc) {
      const contract = await prisma.contracts.findFirst({
        where: { employee_id: e.id, status: "active" },
        orderBy: { created_at: "desc" },
      });
      if (contract) {
        await prisma.contracts.update({
          where: { id: contract.id },
          data: { salary: Number(ctc) },
        });
      }
    }

    res.json({ success: true, data: { id: updated.id, status: updated.status } });
  } catch (err) {
    console.error("Update employee error:", err);
    res.status(500).json({ success: false, error: "Failed to update employee" });
  }
});

// ── DELETE /api/employees/:id ─────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const e = await resolveEmployee(req.params.id);
    if (!e) return res.status(404).json({ success: false, error: "Employee not found" });

    // Mark as exited (soft-delete / decommission)
    await prisma.employees.update({
      where: { id: e.id },
      data: { status: "exited", exit_date: new Date() },
    });

    res.json({ success: true, message: `Employee ${e.full_name} marked as exited` });
  } catch (err) {
    console.error("Delete employee error:", err);
    res.status(500).json({ success: false, error: "Failed to delete employee" });
  }
});

export default router;
