import express from "express";
import authMiddleware from "../middlewares/auth.middleware";
import departmentController from "../controllers/department.controller";
import ValidationMiddleware from "../middlewares/validation.middleware";
import departmentSchema from "../validations/department.schema";

const router = express.Router();

router.get(
  "/",
  authMiddleware.authenticateUser,
  departmentController.getDepartments
);

router.post(
  "/",
  authMiddleware.authenticateUser,
  ValidationMiddleware.validateBody(departmentSchema.addDepartmentBody),
  departmentController.addDepartment
);

router.put(
  "/:id",
  authMiddleware.authenticateUser,
  ValidationMiddleware.validateBody(departmentSchema.updateDepartmentBody),
  departmentController.updateDepartment
);

router.delete(
  "/:id",
  authMiddleware.authenticateUser,
  departmentController.deleteDepartment
);

export default router;
