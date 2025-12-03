import { Router } from "express";
import authMiddleware from "../middlewares/auth.middleware";
import ValidationMiddleware from "../middlewares/validation.middleware";
import serviceOrderSchema from "../validations/service-order.schema";
import serviceOrderController from "../controllers/serviceOrder.controller";

const router = Router();

router.get(
  "/",
  authMiddleware.authenticateUser,
  serviceOrderController.getServiceOrders,
);

router.get(
  "/:id",
  authMiddleware.authenticateUser,
  serviceOrderController.getServiceOrder,
);

router.get(
  "/:serviceOrderId/detail",
  authMiddleware.authenticateUser,
  serviceOrderController.getServiceOrderDetailsByOrder,
);

router.post(
  "/",
  authMiddleware.authenticateUser,
  ValidationMiddleware.validateBody(serviceOrderSchema.addServiceOrderBody),
  serviceOrderController.addServiceOrder,
);

router.put(
  "/:id",
  authMiddleware.authenticateUser,
  ValidationMiddleware.validateBody(serviceOrderSchema.updateServiceOrderBody),
  serviceOrderController.updateServiceOrder,
);

router.delete(
  "/:id",
  authMiddleware.authenticateUser,
  serviceOrderController.deleteServiceOrder,
);

router.post(
  "/detail",
  authMiddleware.authenticateUser,
  ValidationMiddleware.validateBody(serviceOrderSchema.addServiceOrderDetailBody),
  serviceOrderController.addServiceOrderDetail,
);

router.put(
  "/detail/:id",
  authMiddleware.authenticateUser,
  ValidationMiddleware.validateBody(serviceOrderSchema.updateServiceOrderDetailBody),
  serviceOrderController.updateServiceOrderDetail,
);

router.delete(
  "/detail/:id",
  authMiddleware.authenticateUser,
  serviceOrderController.deleteServiceOrderDetail,
);

export default router;
