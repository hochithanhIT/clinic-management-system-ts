import { Router } from "express";
import authMiddleware from "../middlewares/auth.middleware";
import ValidationMiddleware from "../middlewares/validation.middleware";
import serviceGroupSchema from "../validations/service-group.schema";
import serviceGroupController from "../controllers/serviceGroup.controller";

const router = Router();

router.get(
  "/",
  authMiddleware.authenticateUser,
  serviceGroupController.getServiceGroups,
);

router.get(
  "/:id",
  authMiddleware.authenticateUser,
  serviceGroupController.getServiceGroup,
);

router.post(
  "/",
  authMiddleware.authenticateUser,
  ValidationMiddleware.validateBody(serviceGroupSchema.addServiceGroupBody),
  serviceGroupController.addServiceGroup,
);

router.put(
  "/:id",
  authMiddleware.authenticateUser,
  ValidationMiddleware.validateBody(serviceGroupSchema.updateServiceGroupBody),
  serviceGroupController.updateServiceGroup,
);

router.delete(
  "/:id",
  authMiddleware.authenticateUser,
  serviceGroupController.deleteServiceGroup,
);

export default router;
