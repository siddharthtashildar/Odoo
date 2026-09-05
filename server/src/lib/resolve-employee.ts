import { prisma } from "./prisma";

export async function resolveEmployee(idOrCode: string) {
  if (!idOrCode) return null;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrCode);
  if (isUuid) {
    const byId = await prisma.employees.findUnique({
      where: { id: idOrCode },
      include: {
        departments_employees_department_idTodepartments: { select: { id: true, name: true } },
        designations: { select: { id: true, title: true } },
        employees: { select: { id: true, full_name: true } },
      },
    });
    if (byId) return byId;
  }

  const mappedCode = idOrCode.startsWith("E") ? idOrCode.replace(/^E/, "PP-") : idOrCode;
  return await prisma.employees.findFirst({
    where: {
      OR: [
        { employee_code: idOrCode },
        { employee_code: mappedCode },
        { email: idOrCode },
      ],
    },
    include: {
      departments_employees_department_idTodepartments: { select: { id: true, name: true } },
      designations: { select: { id: true, title: true } },
      employees: { select: { id: true, full_name: true } },
    },
  });
}
