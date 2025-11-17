import { Router } from "express";
import authMiddleware from "../middlewares/auth.middleware";
import ValidationMiddleware from "../middlewares/validation.middleware";
import resultSchema from "../validations/result.schema";
import resultController from "controllers/result.controller";

const router = Router();

router.get("/",
  authMiddleware.authenticateUser,
  resultController.getResults,
);

router.get(
  "/:id",
  authMiddleware.authenticateUser,
  resultController.getResult,
);

router.post(
  "/",
  authMiddleware.authenticateUser,
  ValidationMiddleware.validateBody(resultSchema.addResultBody),
  resultController.addResult,
);

router.put(
  "/:id",
  authMiddleware.authenticateUser,
  ValidationMiddleware.validateBody(resultSchema.updateResultBody),
  resultController.updateResult,
);

router.delete(
  "/:id",
  authMiddleware.authenticateUser,
  resultController.deleteResult,
);

router.post(
  "/details",
  authMiddleware.authenticateUser,
  ValidationMiddleware.validateBody(resultSchema.addResultDetailBody),
  resultController.addResultDetail,
);

router.put(
  "/details/:id",
  authMiddleware.authenticateUser,
  ValidationMiddleware.validateBody(resultSchema.updateResultDetailBody),
  resultController.updateResultDetail,
);

export default router;
