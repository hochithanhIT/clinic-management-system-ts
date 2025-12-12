import bcrypt from "bcryptjs";
import { prisma } from "../db";

const ADMIN_ROLE_NAME = process.env.ADMIN_ROLE_NAME ?? "Admin";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? "admin";
const ADMIN_DISPLAY_NAME = process.env.ADMIN_DISPLAY_NAME ?? "System Administrator";

const generateAdminEmployeeCode = async (): Promise<string> => {
  const prefix = "ADMIN";

  for (let attempt = 1; attempt <= 999; attempt += 1) {
    const candidate = `${prefix}${attempt.toString().padStart(3, "0")}`;
    const existing = await prisma.nhanVien.findUnique({ where: { maNV: candidate } });
    if (!existing) {
      return candidate;
    }
  }

  return `${prefix}${Date.now()}`;
};

const createAdminEmployee = async (): Promise<{ id: number }> => {
  const [department, title, position, role] = await Promise.all([
    prisma.khoa.findFirst({ select: { id: true } }),
    prisma.chucDanh.findFirst({ select: { id: true } }),
    prisma.chucVu.findFirst({ select: { id: true } }),
    prisma.vaiTro.findFirst({
      where: {
        tenVaiTro: {
          equals: ADMIN_ROLE_NAME,
          mode: "insensitive",
        },
      },
      select: { id: true },
    }),
  ]);

  if (!department || !title || !position || !role) {
    throw new Error("Missing reference data to create admin employee");
  }

  const employeeCode = await generateAdminEmployeeCode();

  return prisma.nhanVien.create({
    data: {
      maNV: employeeCode,
      hoTen: ADMIN_DISPLAY_NAME,
      ngaySinh: new Date("1990-01-01T00:00:00.000Z"),
      gioiTinh: 1,
      khoa: { connect: { id: department.id } },
      chucDanh: { connect: { id: title.id } },
      chucVu: { connect: { id: position.id } },
      vaiTro: { connect: { id: role.id } },
    },
    select: { id: true },
  });
};

const resolveAdminEmployee = async (): Promise<{ id: number }> => {
  const existingAdmin = await prisma.nhanVien.findFirst({
    where: {
      vaiTro: {
        tenVaiTro: {
          equals: ADMIN_ROLE_NAME,
          mode: "insensitive",
        },
      },
      taiKhoan: null,
    },
    select: { id: true },
    orderBy: { id: "asc" },
  });

  if (existingAdmin) {
    return existingAdmin;
  }

  return createAdminEmployee();
};

const ensureAdminAccount = async () => {
  try {
    const existingAccountByUsername = await prisma.taiKhoan.findUnique({
      where: { tenDangNhap: ADMIN_USERNAME },
      select: { id: true },
    });

    if (existingAccountByUsername) {
      return;
    }

    const adminPassword = process.env.ADMIN_PASSWORD ?? process.env.DEFAULT_PASSWORD;
    if (!adminPassword) {
      console.warn("Admin account bootstrap skipped: missing ADMIN_PASSWORD or DEFAULT_PASSWORD");
      return;
    }

    const employee = await resolveAdminEmployee();
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    await prisma.taiKhoan.create({
      data: {
        nhanVienId: employee.id,
        tenDangNhap: ADMIN_USERNAME,
        matKhau: hashedPassword,
      },
    });

    console.log(`Admin account ready (username: ${ADMIN_USERNAME}).`);
  } catch (error) {
    console.error("Failed to ensure admin account", error);
  }
};

export default ensureAdminAccount;
