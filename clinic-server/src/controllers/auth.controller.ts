import Send from "@utils/response.utils";
import { prisma } from "../db";
import { Request, Response } from "express";
import authSchema from "validations/auth.schema";
import bcrypt from "bcryptjs";
import { z } from "zod";
import jwt from "jsonwebtoken";
import authConfig from "@config/auth.config";
import { da } from "zod/v4/locales";

class AuthController {
    static login = async (req: Request, res: Response) => {
        const { tenDangNhap, matKhau } = req.body as z.infer<typeof authSchema.login>;

        try {
            const user = await prisma.taiKhoan.findUnique({
                where: { tenDangNhap }
            });
            if (!user) {
                return Send.error(res, null, "Tên đăng nhập hoặc mật khẩu không đúng!");
            }

            const isPasswordValid = await bcrypt.compare(matKhau, user.matKhau);
            if (!isPasswordValid) {
                return Send.error(res, null, "Tên đăng nhập hoặc mật khẩu không đúng!");
            }

            const accessToken = jwt.sign(
                { userId: user.nhanVienId },
                authConfig.secret,
                { expiresIn: authConfig.secret_expires_in as any }
            )

            const refreshToken = jwt.sign(
                { userId: user.nhanVienId },
                authConfig.refresh_secret,
                { expiresIn: authConfig.refresh_secret_expires_in as any }
            )

            await prisma.taiKhoan.update({
                where: { tenDangNhap },
                data: { refreshToken }
            })

            res.cookie("accessToken", accessToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                maxAge: 15 * 60 * 1000, // 15 minutes
                sameSite: "strict"
            })

            res.cookie("refreshToken", refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                maxAge: 24 * 60 * 60 * 1000, // 1 day
                sameSite: "strict"
            })

            return Send.success(res, {
                id: user.nhanVienId,
                tenDangNhap: user.tenDangNhap,
            })
        } catch (error) {
            console.error("Đăng nhập thất bại:", error);
            return Send.error(res, null, "Đăng nhập thất bại!");
        }
    }

    static createAccount = async (req: Request, res: Response) => {
        const { nhanVienId, tenDangNhap } = req.body as z.infer<typeof authSchema.createAccount>;

        try {
            const existingAccount = await prisma.taiKhoan.findUnique({
                where: { nhanVienId }
            })

            if (existingAccount) {
                return Send.error(res, null, "Nhân viên đã có tài khoản!");
            }

            const existingUsername = await prisma.taiKhoan.findUnique({
                where: { tenDangNhap }
            })
            if (existingUsername) {
                return Send.error(res, null, "Tên đăng nhập đã tồn tại!");
            }

            const DEFAULT_PASSWORD = process.env.DEFAULT_PASSWORD
            if (!DEFAULT_PASSWORD) {
                throw new Error("DEFAULT_PASSWORD is not set in environment variables.");
            }
            const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

            const newAccount = await prisma.taiKhoan.create({
                data: {
                    nhanVienId,
                    tenDangNhap,
                    matKhau: hashedPassword,
                }
            })

            return Send.success(res, {
                id: newAccount.nhanVienId,
                tenDangNhap: newAccount.tenDangNhap,
            }, "Tạo tài khoản thành công!");
        } catch (error) {
            console.error("Tạo tài khoản thất bại:", error);
            return Send.error(res, null, "Tạo tài khoản thất bại!");
        }

    }

    static logout = async (req: Request, res: Response) => {
        try {
            const userId = (req as any).user?.nhanVienId;
            if (userId) {
                await prisma.taiKhoan.updateMany({
                where: { nhanVienId: userId },
                data: { refreshToken: null }
                });
            }

            res.clearCookie("accessToken");
            res.clearCookie("refreshToken");

            return Send.success(res, null, "Đăng xuất thành công!");
        } catch (error) {
            console.error("Đăng xuất thất bại:", error);
            return Send.error(res, null, "Đăng xuất thất bại!");
        }
    }

    static refreshToken = async (req: Request, res: Response) => {
        try {
            const userId = (req as any).nhanVienId;
            const refreshToken = req.cookies.refreshToken;

            const user = await prisma.taiKhoan.findUnique({
                where: { nhanVienId: userId }
            });

            if (!user || !user.refreshToken) {
                return Send.unauthorized(res, "Vui lòng đăng nhập lại!");
            }

            if (user.refreshToken !== refreshToken) {
                return Send.unauthorized(res, "Vui lòng đăng nhập lại!");
            }

            const newAccessToken = jwt.sign(
                { userId: user.nhanVienId },
                authConfig.secret,
                { expiresIn: authConfig.secret_expires_in as any }
            )

            res.cookie("accessToken", newAccessToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                maxAge: 15 * 60 * 1000, // 15 minutes
                sameSite: "strict"
            })

            return Send.success(res, null, "Làm mới token thành công!");
        } catch (error) {
            console.error("Làm mới token thất bại:", error);
            return Send.error(res, null, "Làm mới token thất bại!");
        }
    } 
}

export default AuthController;