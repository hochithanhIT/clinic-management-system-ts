import Send from "../utils/response.utils";
import { prisma } from "../db";
import { NextFunction, Request, Response } from "express";

const getUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { nhanVienId } = req.body;

        const user = await prisma.taiKhoan.findUnique({
            where: { nhanVienId },
            select: {
                nhanVienId: true,
                tenDangNhap: true,
                createdAt: true,
                updatedAt: true,
                // Add other fields you want to return
            }
        });

        if (!user) {
            return Send.notFound(res, {}, "Không tìm thấy người dùng!");
        }

        return Send.success(res, { user });
    } catch (error) {
        next(error);
    }
}

export default {
    getUser
}