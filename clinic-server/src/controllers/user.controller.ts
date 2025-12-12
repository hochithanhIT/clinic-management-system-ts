import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import Send from "../utils/response.utils";
import userSchema from "../validations/user.schema";
import { z } from "zod";

const userSelect = {
	id: true,
	maNV: true,
	hoTen: true,
	ngaySinh: true,
	gioiTinh: true,
	sdt: true,
	soChungChiHanhNghe: true,
	ngayCapChungChi: true,
	ngayHetHanChungChi: true,
	daXoa: true,
	khoa: {
		select: {
			id: true,
			tenKhoa: true,
		},
	},
	chucDanh: {
		select: {
			id: true,
			tenChucDanh: true,
		},
	},
	chucVu: {
		select: {
			id: true,
			tenChucVu: true,
		},
	},
	vaiTro: {
		select: {
			id: true,
			tenVaiTro: true,
		},
	},
	taiKhoan: {
		select: {
			id: true,
			tenDangNhap: true,
			trangThai: true,
			createdAt: true,
			updatedAt: true,
		},
	},
} satisfies Prisma.NhanVienSelect;

type GetUsersQuery = z.infer<typeof userSchema.getUsersQuery>;
type GetUserParam = z.infer<typeof userSchema.getUserParam>;
type CreateUserBody = z.infer<typeof userSchema.createUserBody>;
type UpdateUserBody = z.infer<typeof userSchema.updateUserBody>;

const EMPLOYEE_CODE_PREFIX = "NV";
const EMPLOYEE_CODE_PADDING = 4;

const generateEmployeeCode = async (): Promise<string> => {
	const latestEmployee = await prisma.nhanVien.findFirst({
		select: { maNV: true },
		orderBy: { id: "desc" },
	});

	let nextNumber = 1;
	if (latestEmployee?.maNV) {
		const match = latestEmployee.maNV.match(/(\d+)$/);
		if (match) {
			nextNumber = Number.parseInt(match[1], 10) + 1;
		}
	}

	let candidateNumber = nextNumber;
	while (candidateNumber < nextNumber + 1000) {
		const candidate = `${EMPLOYEE_CODE_PREFIX}${candidateNumber
			.toString()
			.padStart(EMPLOYEE_CODE_PADDING, "0")}`;
		const existing = await prisma.nhanVien.findUnique({
			where: { maNV: candidate },
			select: { id: true },
		});
		if (!existing) {
			return candidate;
		}
		candidateNumber += 1;
	}

	return `${EMPLOYEE_CODE_PREFIX}${Date.now()}`;
};

const resolveReferenceId = async <T extends { id: number }>(
	value: number | undefined,
	fallbackQuery: () => Promise<T | null>,
	entityName: string
): Promise<number> => {
	if (typeof value === "number") {
		const entity = await fallbackQuery();
		if (entity) {
			return entity.id;
		}
		throw new ReferenceError(`${entityName} không tồn tại`);
	}

	const fallback = await fallbackQuery();
	if (!fallback) {
		throw new ReferenceError(`Không tìm thấy ${entityName.toLowerCase()}`);
	}

	return fallback.id;
};

const getUsers = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	try {
		const { page, limit, search, departmentId, roleId }: GetUsersQuery =
			userSchema.getUsersQuery.parse(req.query);

		const skip = (page - 1) * limit;
		const where: Prisma.NhanVienWhereInput = {};

		if (search) {
			where.OR = [
				{ maNV: { contains: search, mode: "insensitive" } },
				{ hoTen: { contains: search, mode: "insensitive" } },
				{ sdt: { contains: search, mode: "insensitive" } },
			];
		}

		if (typeof departmentId === "number") {
			where.khoaId = departmentId;
		}

		if (typeof roleId === "number") {
			where.vaiTroId = roleId;
		}

		const [users, total] = await Promise.all([
			prisma.nhanVien.findMany({
				where,
				select: userSelect,
				skip,
				take: limit,
				orderBy: { id: "asc" },
			}),
			prisma.nhanVien.count({ where }),
		]);

		const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

		return Send.success(res, {
			users,
			pagination: {
				page,
				limit,
				total,
				totalPages,
			},
		});
	} catch (error) {
		if (error instanceof z.ZodError) {
			return Send.validationErrors(res, error.flatten().fieldErrors);
		}

		return next(error);
	}
};

const getUser = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	try {
		const { id }: GetUserParam = userSchema.getUserParam.parse(req.params);

		const user = await prisma.nhanVien.findUnique({
			where: { id },
			select: userSelect,
		});

		if (!user) {
			return Send.notFound(res, null, "Không tìm thấy người dùng");
		}

		return Send.success(res, { user });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return Send.validationErrors(res, error.flatten().fieldErrors);
		}

		return next(error);
	}
};

const createUser = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	try {
		const payload: CreateUserBody = userSchema.createUserBody.parse(req.body);

		const [phoneConflict, certConflict] = await Promise.all([
			payload.sdt
				? prisma.nhanVien.findFirst({
					where: { sdt: payload.sdt },
					select: { id: true },
				})
				: Promise.resolve(null),
			payload.soChungChiHanhNghe
				? prisma.nhanVien.findFirst({
					where: { soChungChiHanhNghe: payload.soChungChiHanhNghe },
					select: { id: true },
				})
				: Promise.resolve(null),
		]);

		if (phoneConflict) {
			return Send.badRequest(res, null, "Số điện thoại đã được sử dụng");
		}

		if (certConflict) {
			return Send.badRequest(res, null, "Số chứng chỉ đã được sử dụng");
		}

		const [department, role] = await Promise.all([
			prisma.khoa.findUnique({
				where: { id: payload.khoaId },
				select: { id: true },
			}),
			prisma.vaiTro.findUnique({
				where: { id: payload.vaiTroId },
				select: { id: true },
			}),
		]);

		if (!department) {
			return Send.badRequest(res, null, "Khoa không tồn tại");
		}

		if (!role) {
			return Send.badRequest(res, null, "Vai trò không tồn tại");
		}

		const [titleId, positionId] = await Promise.all([
			resolveReferenceId(
				payload.chucDanhId,
				() =>
					payload.chucDanhId
						? prisma.chucDanh.findUnique({
							where: { id: payload.chucDanhId },
							select: { id: true },
						})
						: prisma.chucDanh.findFirst({
							select: { id: true },
							orderBy: { id: "asc" },
						}),
				"Chức danh"
			),
			resolveReferenceId(
				payload.chucVuId,
				() =>
					payload.chucVuId
						? prisma.chucVu.findUnique({
							where: { id: payload.chucVuId },
							select: { id: true },
						})
						: prisma.chucVu.findFirst({
							select: { id: true },
							orderBy: { id: "asc" },
						}),
				"Chức vụ"
			),
		]);

		const code = await generateEmployeeCode();

		const createdUser = await prisma.nhanVien.create({
			data: {
				maNV: code,
				hoTen: payload.hoTen,
				ngaySinh: payload.ngaySinh,
				gioiTinh: payload.gioiTinh,
				sdt: payload.sdt,
				soChungChiHanhNghe: payload.soChungChiHanhNghe,
				ngayCapChungChi: payload.ngayCapChungChi,
				ngayHetHanChungChi: payload.ngayHetHanChungChi,
				daXoa: payload.daXoa ?? false,
				khoa: { connect: { id: department.id } },
				chucDanh: { connect: { id: titleId } },
				chucVu: { connect: { id: positionId } },
				vaiTro: { connect: { id: role.id } },
			},
			select: userSelect,
		});

		return Send.success(res, { user: createdUser }, "Tạo người dùng thành công");
	} catch (error) {
		if (error instanceof z.ZodError) {
			return Send.validationErrors(res, error.flatten().fieldErrors);
		}

		if (error instanceof ReferenceError) {
			return Send.badRequest(res, null, error.message);
		}

		if (error instanceof Prisma.PrismaClientKnownRequestError) {
			if (error.code === "P2002") {
				return Send.badRequest(res, null, "Thông tin người dùng bị trùng lặp");
			}
		}

		return next(error);
	}
};

const updateUser = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	try {
		const { id }: GetUserParam = userSchema.getUserParam.parse(req.params);
		const payload: UpdateUserBody = userSchema.updateUserBody.parse(req.body);

		const existingUser = await prisma.nhanVien.findUnique({
			where: { id },
			select: { id: true },
		});

		if (!existingUser) {
			return Send.notFound(res, null, "Không tìm thấy người dùng");
		}

		const maNV = payload.maNV?.toUpperCase();

		const [codeConflict, phoneConflict, certConflict] = await Promise.all([
			maNV
				? prisma.nhanVien.findFirst({
						where: {
							maNV,
							NOT: { id },
						},
						select: { id: true },
					})
				: Promise.resolve(null),
			payload.sdt
				? prisma.nhanVien.findFirst({
						where: {
							sdt: payload.sdt,
							NOT: { id },
						},
						select: { id: true },
					})
				: Promise.resolve(null),
			payload.soChungChiHanhNghe
				? prisma.nhanVien.findFirst({
						where: {
							soChungChiHanhNghe: payload.soChungChiHanhNghe,
							NOT: { id },
						},
						select: { id: true },
					})
				: Promise.resolve(null),
		]);

		if (codeConflict) {
			return Send.badRequest(res, null, "Mã nhân viên đã tồn tại");
		}

		if (phoneConflict) {
			return Send.badRequest(res, null, "Số điện thoại đã được sử dụng");
		}

		if (certConflict) {
			return Send.badRequest(res, null, "Số chứng chỉ đã được sử dụng");
		}

		const [khoa, chucDanh, chucVu, vaiTro] = await Promise.all([
			payload.khoaId
				? prisma.khoa.findUnique({
						where: { id: payload.khoaId },
						select: { id: true },
					})
				: Promise.resolve(null),
			payload.chucDanhId
				? prisma.chucDanh.findUnique({
						where: { id: payload.chucDanhId },
						select: { id: true },
					})
				: Promise.resolve(null),
			payload.chucVuId
				? prisma.chucVu.findUnique({
						where: { id: payload.chucVuId },
						select: { id: true },
					})
				: Promise.resolve(null),
			payload.vaiTroId
				? prisma.vaiTro.findUnique({
						where: { id: payload.vaiTroId },
						select: { id: true },
					})
				: Promise.resolve(null),
		]);

		if (payload.khoaId && !khoa) {
			return Send.badRequest(res, null, "Khoa không tồn tại");
		}

		if (payload.chucDanhId && !chucDanh) {
			return Send.badRequest(res, null, "Chức danh không tồn tại");
		}

		if (payload.chucVuId && !chucVu) {
			return Send.badRequest(res, null, "Chức vụ không tồn tại");
		}

		if (payload.vaiTroId && !vaiTro) {
			return Send.badRequest(res, null, "Vai trò không tồn tại");
		}

		const updateData: Prisma.NhanVienUpdateInput = {};

		if (maNV !== undefined) updateData.maNV = maNV;
		if (payload.hoTen !== undefined) updateData.hoTen = payload.hoTen;
		if (payload.ngaySinh !== undefined) updateData.ngaySinh = payload.ngaySinh;
		if (payload.gioiTinh !== undefined) updateData.gioiTinh = payload.gioiTinh;
		if (payload.sdt !== undefined) updateData.sdt = payload.sdt;
		if (payload.soChungChiHanhNghe !== undefined) {
			updateData.soChungChiHanhNghe = payload.soChungChiHanhNghe;
		}
		if (payload.ngayCapChungChi !== undefined) {
			updateData.ngayCapChungChi = payload.ngayCapChungChi;
		}
		if (payload.ngayHetHanChungChi !== undefined) {
			updateData.ngayHetHanChungChi = payload.ngayHetHanChungChi;
		}
		if (payload.daXoa !== undefined) updateData.daXoa = payload.daXoa;
		if (payload.khoaId !== undefined) {
			updateData.khoa = { connect: { id: payload.khoaId } };
		}
		if (payload.chucDanhId !== undefined) {
			updateData.chucDanh = { connect: { id: payload.chucDanhId } };
		}
		if (payload.chucVuId !== undefined) {
			updateData.chucVu = { connect: { id: payload.chucVuId } };
		}
		if (payload.vaiTroId !== undefined) {
			updateData.vaiTro = { connect: { id: payload.vaiTroId } };
		}

		const updatedUser = await prisma.nhanVien.update({
			where: { id },
			data: updateData,
			select: userSelect,
		});

		return Send.success(res, { user: updatedUser }, "Cập nhật người dùng thành công");
	} catch (error) {
		if (error instanceof z.ZodError) {
			return Send.validationErrors(res, error.flatten().fieldErrors);
		}

		if (error instanceof Prisma.PrismaClientKnownRequestError) {
			if (error.code === "P2002") {
				return Send.badRequest(res, null, "Thông tin người dùng bị trùng lặp");
			}
		}

		return next(error);
	}
};

const deleteUser = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	try {
		const { id }: GetUserParam = userSchema.getUserParam.parse(req.params);

		await prisma.nhanVien.delete({
			where: { id },
		});

		return Send.success(res, null, "Xóa người dùng thành công");
	} catch (error) {
		if (error instanceof z.ZodError) {
			return Send.validationErrors(res, error.flatten().fieldErrors);
		}

		if (error instanceof Prisma.PrismaClientKnownRequestError) {
			if (error.code === "P2025") {
				return Send.notFound(res, null, "Không tìm thấy người dùng");
			}

			if (error.code === "P2003") {
				return Send.badRequest(res, null, "Không thể xóa người dùng vì đang được sử dụng");
			}
		}

		return next(error);
	}
};

export default {
	getUsers,
	getUser,
	createUser,
	updateUser,
	deleteUser,
};
