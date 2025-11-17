import express from "express";
import authMiddleware from "../middlewares/auth.middleware";
import titleController from "../controllers/title.controller";
import ValidationMiddleware from "../middlewares/validation.middleware";
import { titleBody, updateTitleBody } from "../validations/reference.schema";

const router = express.Router();

router.get("/", authMiddleware.authenticateUser, titleController.getTitles);

router.post(
  "/",
  authMiddleware.authenticateUser,
  ValidationMiddleware.validateBody(titleBody),
  titleController.addTitle,
);

router.put(
  "/:id",
  authMiddleware.authenticateUser,
  ValidationMiddleware.validateBody(updateTitleBody),
  titleController.updateTitle,
);

router.delete(
  "/:id",
  authMiddleware.authenticateUser,
  titleController.deleteTitle,
);

export default router;
