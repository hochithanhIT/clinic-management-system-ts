import express from "express";
import authMiddleware from "../middlewares/auth.middleware";
import serviceController from "../controllers/service.controller";
import ValidationMiddleware from "../middlewares/validation.middleware";
import serviceSchema from "../validations/service.schema";

const router = express.Router();

router.get(
  "/",
  authMiddleware.authenticateUser,
  serviceController.getServices
);

router.post(
  "/",
  authMiddleware.authenticateUser,
  ValidationMiddleware.validateBody(serviceSchema.addServiceBody),
  serviceController.addService
);

router.put(
  "/:id",
  authMiddleware.authenticateUser,
  ValidationMiddleware.validateBody(serviceSchema.updateServiceBody),
  serviceController.updateService
);

router.delete(
  "/:id",
  authMiddleware.authenticateUser,
  serviceController.deleteService
);

export default router;
