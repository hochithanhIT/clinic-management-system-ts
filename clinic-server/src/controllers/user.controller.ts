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
type UpdateUserBody = z.infer<typeof userSchema.updateUserBody>;

const getUsers = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	try {
		const { page, limit, search }: GetUsersQuery = userSchema.getUsersQuery.parse(req.query);

		const skip = (page - 1) * limit;
		const where: Prisma.NhanVienWhereInput = {};

		if (search) {
			where.OR = [
				{ maNV: { contains: search, mode: "insensitive" } },
				{ hoTen: { contains: search, mode: "insensitive" } },
				{ sdt: { contains: search, mode: "insensitive" } },
			];
		}

		const [users, total] = await Promise.all([
			prisma.nhanVien.findMany({
				where,
				select: userSelect,
				skip,
				take: limit,
				orderBy: { id: "desc" },
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
	updateUser,
	deleteUser,
};
