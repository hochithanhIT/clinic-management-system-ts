import userController from "../controllers/user.controller";
import express from "express";
import authMiddleware from "../middlewares/auth.middleware";
const router = express.Router();

router
    .get("/", authMiddleware.authenticateUser, userController.getUser);

export default router;
