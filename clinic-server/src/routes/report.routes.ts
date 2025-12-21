import { Router } from "express";
import reportController from "../controllers/report.controller";
import authMiddleware from "../middlewares/auth.middleware";

const router = Router();

router.get(
  "/nurse-reception",
  authMiddleware.authenticateUser,
  reportController.getNurseReceptionReport
);

router.get(
  "/doctor-summary",
  authMiddleware.authenticateUser,
  reportController.getDoctorSummary
);

router.get(
  "/accountant-revenue",
  authMiddleware.authenticateUser,
  reportController.getAccountantRevenueReport
);

export default router;
