import authController from "../controllers/auth.controller";
import express from "express";
import authMiddleware from "../middlewares/auth.middleware";
import ValidationMiddleware from "../middlewares/validation.middleware";
const router = express.Router();

router
    .post("/login", authController.login)
    .post("/create-account",ValidationMiddleware.validateBody, authController.createAccount)
    .post("/logout",authMiddleware.authenticateUser, authController.logout)
    .post("/refresh-token", authMiddleware.refreshTokenValidation, authController.refreshToken);

export default router;