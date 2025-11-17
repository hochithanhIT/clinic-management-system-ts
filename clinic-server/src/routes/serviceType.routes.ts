import { Router } from "express";
import authMiddleware from "../middlewares/auth.middleware";
import ValidationMiddleware from "../middlewares/validation.middleware";
import serviceTypeSchema from "../validations/service-type.schema";
import serviceTypeController from "../controllers/serviceType.controller";

const router = Router();

router.post(
  "/",
  authMiddleware.authenticateUser,
  ValidationMiddleware.validateBody(serviceTypeSchema.addServiceTypeBody),
  serviceTypeController.addServiceType,
);

router.put(
  "/:id",
  authMiddleware.authenticateUser,
  ValidationMiddleware.validateBody(serviceTypeSchema.updateServiceTypeBody),
  serviceTypeController.updateServiceType,
);

router.delete(
  "/:id",
  authMiddleware.authenticateUser,
  serviceTypeController.deleteServiceType,
);

export default router;
