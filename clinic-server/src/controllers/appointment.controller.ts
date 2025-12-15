import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import Send from "../utils/response.utils";
import appointmentSchema from "../validations/appointment.schema";
import { z } from "zod";

const appointmentSelect = {
  id: true,
  scheduledAt: true,
  reason: true,
  notes: true,
  phong: {
    select: {
      id: true,
      tenPhong: true,
      khoa: {
        select: {
          id: true,
          tenKhoa: true,
        },
      },
    },
  },
  benhNhan: {
    select: {
      id: true,
      maBenhNhan: true,
      hoTen: true,
    },
  },
} as const;

type AppointmentResult = {
  id: number;
  scheduledAt: Date;
  reason: string;
  notes: string | null;
  phong: {
    id: number;
    tenPhong: string;
    khoa: {
      id: number;
      tenKhoa: string;
    } | null;
  } | null;
  benhNhan: {
    id: number;
    maBenhNhan: string;
    hoTen: string;
  } | null;
};

type GetAppointmentsQuery = z.infer<typeof appointmentSchema.getAppointmentsQuery>;
type AppointmentParam = z.infer<typeof appointmentSchema.appointmentParam>;
type CreateAppointmentBody = z.infer<typeof appointmentSchema.createAppointmentBody>;
type UpdateAppointmentBody = z.infer<typeof appointmentSchema.updateAppointmentBody>;

const appointmentDelegate = (prisma as unknown as {
  appointment?: {
    findMany: (args: unknown) => Promise<AppointmentResult[]>;
    count: (args: unknown) => Promise<number>;
    findUnique: (args: unknown) => Promise<AppointmentResult | null>;
    create: (args: unknown) => Promise<AppointmentResult>;
    update: (args: unknown) => Promise<AppointmentResult>;
    delete: (args: unknown) => Promise<void>;
  };
}).appointment;

const mapAppointment = (appointment: AppointmentResult) => ({
  id: appointment.id,
  scheduledAt: appointment.scheduledAt,
  reason: appointment.reason,
  notes: appointment.notes,
  phong: appointment.phong
    ? {
        id: appointment.phong.id,
        tenPhong: appointment.phong.tenPhong,
        khoa: appointment.phong.khoa
          ? {
              id: appointment.phong.khoa.id,
              tenKhoa: appointment.phong.khoa.tenKhoa,
            }
          : null,
      }
    : null,
  benhNhan: appointment.benhNhan
    ? {
        id: appointment.benhNhan.id,
        maBenhNhan: appointment.benhNhan.maBenhNhan,
        hoTen: appointment.benhNhan.hoTen,
      }
    : null,
});

const getAppointments = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!appointmentDelegate) {
      return Send.error(
        res,
        null,
        "Appointment support is not available. Please run Prisma generate to update the client.",
      );
    }

    const { page, limit, benhNhanId, phongId, from, to }: GetAppointmentsQuery =
      appointmentSchema.getAppointmentsQuery.parse(req.query);

    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {};

    if (benhNhanId !== undefined) {
      where.benhNhanId = benhNhanId;
    }

    if (phongId !== undefined) {
      where.phongId = phongId;
    }

    if (from || to) {
      const scheduledAtFilter: Record<string, Date> = {};
      if (from) {
        scheduledAtFilter.gte = from;
      }
      if (to) {
        scheduledAtFilter.lte = to;
      }
      where.scheduledAt = scheduledAtFilter;
    }

    const [appointments, total] = await Promise.all([
      appointmentDelegate.findMany({
        where,
        select: appointmentSelect,
        skip,
        take: limit,
        orderBy: { scheduledAt: "asc" },
      }),
      appointmentDelegate.count({ where }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return Send.success(res, {
      appointments: appointments.map(mapAppointment),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    return next(error);
  }
};

const getAppointment = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!appointmentDelegate) {
      return Send.error(
        res,
        null,
        "Appointment support is not available. Please run Prisma generate to update the client.",
      );
    }

    const { id }: AppointmentParam = appointmentSchema.appointmentParam.parse(req.params);

    const appointment = await appointmentDelegate.findUnique({
      where: { id },
      select: appointmentSelect,
    });

    if (!appointment) {
      return Send.notFound(res, null, "Không tìm thấy hẹn khám");
    }

    return Send.success(res, { appointment: mapAppointment(appointment) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    return next(error);
  }
};

const createAppointment = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!appointmentDelegate) {
      return Send.error(
        res,
        null,
        "Appointment support is not available. Please run Prisma generate to update the client.",
      );
    }

    const payload: CreateAppointmentBody = appointmentSchema.createAppointmentBody.parse(req.body);

    const [patient, room] = await Promise.all([
      prisma.benhNhan.findUnique({
        where: { id: payload.benhNhanId },
        select: { id: true },
      }),
      prisma.phong.findUnique({
        where: { id: payload.phongId },
        select: { id: true, isActive: true },
      }),
    ]);

    if (!patient) {
      return Send.badRequest(res, null, "Bệnh nhân không tồn tại");
    }

    if (!room || !room.isActive) {
      return Send.badRequest(res, null, "Phòng khám không tồn tại hoặc đã bị vô hiệu");
    }

    const createData: Record<string, unknown> = {
      scheduledAt: payload.scheduledAt,
      reason: payload.reason.trim(),
      phong: { connect: { id: payload.phongId } },
      benhNhan: { connect: { id: payload.benhNhanId } },
    };

    if (payload.notes !== undefined) {
      createData.notes = payload.notes;
    }

    const appointment = await appointmentDelegate.create({
      data: createData,
      select: appointmentSelect,
    });

    return Send.success(
      res,
      { appointment: mapAppointment(appointment) },
      "Tạo hẹn khám thành công",
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2003") {
        return Send.badRequest(res, null, "Thông tin liên kết không hợp lệ");
      }
    }

    return next(error);
  }
};

const updateAppointment = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!appointmentDelegate) {
      return Send.error(
        res,
        null,
        "Appointment support is not available. Please run Prisma generate to update the client.",
      );
    }

    const { id }: AppointmentParam = appointmentSchema.appointmentParam.parse(req.params);
    const payload: UpdateAppointmentBody = appointmentSchema.updateAppointmentBody.parse(req.body);

    const existingAppointment = await appointmentDelegate.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingAppointment) {
      return Send.notFound(res, null, "Không tìm thấy hẹn khám");
    }

    const updateData: Record<string, unknown> = {};

    if (payload.scheduledAt !== undefined) {
      updateData.scheduledAt = payload.scheduledAt;
    }

    if (payload.reason !== undefined) {
      updateData.reason = payload.reason.trim();
    }

    if (payload.notes !== undefined) {
      updateData.notes = payload.notes;
    }

    if (payload.phongId !== undefined) {
      const room = await prisma.phong.findUnique({
        where: { id: payload.phongId },
        select: { id: true, isActive: true },
      });

      if (!room || !room.isActive) {
        return Send.badRequest(res, null, "Phòng khám không tồn tại hoặc đã bị vô hiệu");
      }

      updateData.phong = { connect: { id: payload.phongId } };
    }

    const appointment = await appointmentDelegate.update({
      where: { id },
      data: updateData,
      select: appointmentSelect,
    });

    return Send.success(
      res,
      { appointment: mapAppointment(appointment) },
      "Cập nhật hẹn khám thành công",
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return Send.notFound(res, null, "Không tìm thấy hẹn khám");
      }

      if (error.code === "P2003") {
        return Send.badRequest(res, null, "Thông tin liên kết không hợp lệ");
      }
    }

    return next(error);
  }
};

const deleteAppointment = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!appointmentDelegate) {
      return Send.error(
        res,
        null,
        "Appointment support is not available. Please run Prisma generate to update the client.",
      );
    }

    const { id }: AppointmentParam = appointmentSchema.appointmentParam.parse(req.params);

    await appointmentDelegate.delete({
      where: { id },
    });

    return Send.success(res, null, "Xóa hẹn khám thành công");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return Send.notFound(res, null, "Không tìm thấy hẹn khám");
      }
    }

    return next(error);
  }
};

export default {
  getAppointments,
  getAppointment,
  createAppointment,
  updateAppointment,
  deleteAppointment,
};
