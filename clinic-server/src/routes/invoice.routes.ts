import { Router } from "express";
import authMiddleware from "../middlewares/auth.middleware";
import ValidationMiddleware from "../middlewares/validation.middleware";
import invoiceSchema from "../validations/invoice.schema";
import invoiceController from "../controllers/invoice.controller";

const router = Router();

router.get(
  "/",
  authMiddleware.authenticateUser,
  invoiceController.getInvoices,
);

router.get(
  "/:id",
  authMiddleware.authenticateUser,
  invoiceController.getInvoice,
);

router.post(
  "/",
  authMiddleware.authenticateUser,
  ValidationMiddleware.validateBody(invoiceSchema.addInvoiceBody),
  invoiceController.addInvoice,
);

router.post(
  "/pay",
  authMiddleware.authenticateUser,
  ValidationMiddleware.validateBody(invoiceSchema.settleInvoiceBody),
  invoiceController.settleInvoice,
);

router.post(
  "/:id/cancel",
  authMiddleware.authenticateUser,
  invoiceController.cancelInvoice,
);

router.post(
  "/details",
  authMiddleware.authenticateUser,
  ValidationMiddleware.validateBody(invoiceSchema.addInvoiceDetailBody),
  invoiceController.addInvoiceDetail,
);

router.put(
  "/:id",
  authMiddleware.authenticateUser,
  ValidationMiddleware.validateBody(invoiceSchema.updateInvoiceBody),
  invoiceController.updateInvoice,
);

router.put(
  "/details/:id",
  authMiddleware.authenticateUser,
  ValidationMiddleware.validateBody(invoiceSchema.updateInvoiceDetailBody),
  invoiceController.updateInvoiceDetail,
);

router.delete(
  "/:id",
  authMiddleware.authenticateUser,
  invoiceController.deleteInvoice,
);

export default router;
