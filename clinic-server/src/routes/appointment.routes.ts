import express from "express";
import authMiddleware from "../middlewares/auth.middleware";
import appointmentController from "../controllers/appointment.controller";

const router = express.Router();

router.get(
  "/",
  authMiddleware.authenticateUser,
  appointmentController.getAppointments,
);

router.get(
  "/:id",
  authMiddleware.authenticateUser,
  appointmentController.getAppointment,
);

router.post(
  "/",
  authMiddleware.authenticateUser,
  appointmentController.createAppointment,
);

router.put(
  "/:id",
  authMiddleware.authenticateUser,
  appointmentController.updateAppointment,
);

router.delete(
  "/:id",
  authMiddleware.authenticateUser,
  appointmentController.deleteAppointment,
);

export default router;
