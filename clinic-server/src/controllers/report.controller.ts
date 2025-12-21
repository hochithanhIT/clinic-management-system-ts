import { Prisma } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import clinicConstants from "../constants/clinic.constants";
import { prisma } from "../db";
import Send from "../utils/response.utils";

type TimelineUnit = "day" | "week" | "month" | "year";

type DetailRange = "day" | "week" | "month" | "year";

interface TimelinePoint {
  date: string;
  totalAdmissions: number;
}

interface TimelineRow {
  bucket: Date;
  count: number;
}

type RevenuePeriod = "daily" | "monthly" | "yearly";

interface RevenueRange {
  start: Date;
  end: Date;
}

interface RevenueTimelineRow {
  bucket: Date;
  total: unknown;
  count: number;
}

const toNumber = (value: unknown): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseRevenuePeriod = (value: unknown): RevenuePeriod => {
  if (value === "daily" || value === "monthly" || value === "yearly") {
    return value;
  }

  return "daily";
};

const parseDateQueryParam = (value: unknown): Date | null => {
  const input = Array.isArray(value) ? value[0] : value;

  if (typeof input !== "string") {
    return null;
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
};

const getDefaultRevenueRange = (period: RevenuePeriod): RevenueRange => {
  const end = new Date();
  end.setUTCHours(23, 59, 59, 999);

  const start = new Date(end);

  if (period === "daily") {
    start.setUTCDate(start.getUTCDate() - 6);
    start.setUTCHours(0, 0, 0, 0);
    return { start, end };
  }

  if (period === "monthly") {
    start.setUTCMonth(start.getUTCMonth() - 11, 1);
    start.setUTCHours(0, 0, 0, 0);
    return { start, end };
  }

  start.setUTCFullYear(start.getUTCFullYear() - 4, 0, 1);
  start.setUTCHours(0, 0, 0, 0);
  return { start, end };
};

const alignRevenueRangeStart = (date: Date, period: RevenuePeriod): Date => {
  const aligned = new Date(date);
  aligned.setUTCHours(0, 0, 0, 0);

  if (period === "monthly") {
    aligned.setUTCDate(1);
  } else if (period === "yearly") {
    aligned.setUTCMonth(0, 1);
  }

  return aligned;
};

const alignRevenueRangeEnd = (date: Date, period: RevenuePeriod): Date => {
  if (period === "daily") {
    const aligned = new Date(date);
    aligned.setUTCHours(23, 59, 59, 999);
    return aligned;
  }

  if (period === "monthly") {
    const boundary = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
    boundary.setUTCHours(0, 0, 0, 0);
    return new Date(boundary.getTime() - 1);
  }

  const boundary = new Date(Date.UTC(date.getUTCFullYear() + 1, 0, 1));
  boundary.setUTCHours(0, 0, 0, 0);
  return new Date(boundary.getTime() - 1);
};

const normalizeRevenueRange = (
  period: RevenuePeriod,
  from: unknown,
  to: unknown,
): RevenueRange => {
  const defaults = getDefaultRevenueRange(period);
  const parsedStart = parseDateQueryParam(from) ?? defaults.start;
  const parsedEnd = parseDateQueryParam(to) ?? defaults.end;

  let start = parsedStart;
  let end = parsedEnd;

  if (start.getTime() > end.getTime()) {
    const swap = start;
    start = end;
    end = swap;
  }

  start = alignRevenueRangeStart(start, period);
  end = alignRevenueRangeEnd(end, period);

  return { start, end };
};

const alignRevenueBucketStart = (date: Date, period: RevenuePeriod): Date => {
  const aligned = new Date(date);
  aligned.setUTCHours(0, 0, 0, 0);

  if (period === "monthly") {
    aligned.setUTCDate(1);
  } else if (period === "yearly") {
    aligned.setUTCMonth(0, 1);
  }

  return aligned;
};

const generateRevenueBuckets = (
  period: RevenuePeriod,
  start: Date,
  end: Date,
): Date[] => {
  if (start.getTime() > end.getTime()) {
    return [];
  }

  const buckets: Date[] = [];
  const current = new Date(start);
  const last = alignRevenueBucketStart(end, period);

  while (current.getTime() <= last.getTime()) {
    buckets.push(new Date(current));

    if (period === "daily") {
      current.setUTCDate(current.getUTCDate() + 1);
    } else if (period === "monthly") {
      current.setUTCMonth(current.getUTCMonth() + 1);
    } else {
      current.setUTCFullYear(current.getUTCFullYear() + 1);
    }
  }

  return buckets;
};

const buildRevenueTimeline = (
  period: RevenuePeriod,
  buckets: Date[],
  rows: RevenueTimelineRow[],
): Array<{
  date: string;
  totalRevenue: number;
  invoiceCount: number;
}> => {
  if (buckets.length === 0) {
    return [];
  }

  const unit: TimelineUnit = period === "daily" ? "day" : period === "monthly" ? "month" : "year";
  const rowMap = new Map<string, { total: number; count: number }>();

  rows.forEach((row) => {
    const key = timelineKey(row.bucket, unit);
    rowMap.set(key, {
      total: toNumber(row.total),
      count: toNumber(row.count),
    });
  });

  return buckets.map((bucket) => {
    const key = timelineKey(bucket, unit);
    const value = rowMap.get(key);

    return {
      date: bucket.toISOString(),
      totalRevenue: value?.total ?? 0,
      invoiceCount: value?.count ?? 0,
    };
  });
};

const createTimelineBuckets = (unit: TimelineUnit, length: number): Date[] => {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const day = now.getUTCDate();

  if (length <= 0) {
    return [];
  }

  if (unit === "day") {
    return Array.from({ length }, (_, index) => {
      const offset = length - 1 - index;
      return new Date(Date.UTC(year, month, day - offset));
    });
  }

  if (unit === "week") {
    const anchor = new Date(Date.UTC(year, month, day));
    const weekday = anchor.getUTCDay();
    const weekStart = new Date(anchor);
    const offsetToMonday = (weekday + 6) % 7;
    weekStart.setUTCDate(anchor.getUTCDate() - offsetToMonday);

    return Array.from({ length }, (_, index) => {
      const offset = length - 1 - index;
      const bucket = new Date(weekStart);
      bucket.setUTCDate(weekStart.getUTCDate() - offset * 7);
      return bucket;
    });
  }

  if (unit === "month") {
    const anchor = new Date(Date.UTC(year, month, 1));
    return Array.from({ length }, (_, index) => {
      const offset = length - 1 - index;
      const bucket = new Date(anchor);
      bucket.setUTCMonth(anchor.getUTCMonth() - offset);
      return bucket;
    });
  }

  const anchor = new Date(Date.UTC(year, 0, 1));
  return Array.from({ length }, (_, index) => {
    const offset = length - 1 - index;
    const bucket = new Date(anchor);
    bucket.setUTCFullYear(anchor.getUTCFullYear() - offset);
    return bucket;
  });
};

const timelineKey = (date: Date, unit: TimelineUnit): string => {
  const year = date.getUTCFullYear().toString().padStart(4, "0");
  if (unit === "week") {
    return date.toISOString().slice(0, 10);
  }
  if (unit === "year") {
    return year;
  }

  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  if (unit === "month") {
    return `${year}-${month}`;
  }

  const day = date.getUTCDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const buildTimeline = (unit: TimelineUnit, buckets: Date[], rows: TimelineRow[]): TimelinePoint[] => {
  if (!buckets.length) {
    return [];
  }

  const rowMap = new Map<string, number>();

  rows.forEach((row) => {
    rowMap.set(timelineKey(row.bucket, unit), Number(row.count) || 0);
  });

  return buckets.map((bucket) => ({
    date: bucket.toISOString(),
    totalAdmissions: rowMap.get(timelineKey(bucket, unit)) ?? 0,
  }));
};

const parseDetailRange = (value: unknown): DetailRange => {
  if (value === "day" || value === "week" || value === "month" || value === "year") {
    return value;
  }

  return "day";
};

const getDetailRangeStart = (range: DetailRange): Date => {
  const now = new Date();
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);

  if (range === "day") {
    return start;
  }

  if (range === "week") {
    start.setUTCDate(start.getUTCDate() - 6);
    return start;
  }

  if (range === "month") {
    start.setUTCMonth(start.getUTCMonth() - 1);
    return start;
  }

  start.setUTCFullYear(start.getUTCFullYear() - 1);
  return start;
};

const getNurseReceptionReport = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const detailRange = parseDetailRange(req.query.detailsRange);
    const detailRangeStart = getDetailRangeStart(detailRange);

    const dayBuckets = createTimelineBuckets("day", 7);
    const weekBuckets = createTimelineBuckets("week", 8);
    const monthBuckets = createTimelineBuckets("month", 12);
    const yearBuckets = createTimelineBuckets("year", 5);

    const dayStart = dayBuckets.length > 0 ? dayBuckets[0] : new Date(0);
    const weekStart = weekBuckets.length > 0 ? weekBuckets[0] : new Date(0);
    const monthStart = monthBuckets.length > 0 ? monthBuckets[0] : new Date(0);
    const yearStart = yearBuckets.length > 0 ? yearBuckets[0] : new Date(0);

    const [
      totalAdmissions,
      groupedAdmissions,
      dailyRows,
      weeklyRows,
      monthlyRows,
      yearlyRows,
    ] = await Promise.all([
      prisma.benhAn.count(),
      prisma.benhAn.groupBy({
        by: ["nvTiepNhanId"],
        _count: { _all: true },
        where: {
          thoiGianVao: {
            gte: detailRangeStart,
          },
        },
      }),
      prisma.$queryRaw<TimelineRow[]>`
        SELECT DATE_TRUNC('day', "BA_ThoiGianVao") AS bucket, COUNT(*)::int AS count
        FROM "BenhAn"
        WHERE "BA_ThoiGianVao" >= ${dayStart}
        GROUP BY bucket
        ORDER BY bucket ASC
      `,
      prisma.$queryRaw<TimelineRow[]>`
        SELECT DATE_TRUNC('week', "BA_ThoiGianVao") AS bucket, COUNT(*)::int AS count
        FROM "BenhAn"
        WHERE "BA_ThoiGianVao" >= ${weekStart}
        GROUP BY bucket
        ORDER BY bucket ASC
      `,
      prisma.$queryRaw<TimelineRow[]>`
        SELECT DATE_TRUNC('month', "BA_ThoiGianVao") AS bucket, COUNT(*)::int AS count
        FROM "BenhAn"
        WHERE "BA_ThoiGianVao" >= ${monthStart}
        GROUP BY bucket
        ORDER BY bucket ASC
      `,
      prisma.$queryRaw<TimelineRow[]>`
        SELECT DATE_TRUNC('year', "BA_ThoiGianVao") AS bucket, COUNT(*)::int AS count
        FROM "BenhAn"
        WHERE "BA_ThoiGianVao" >= ${yearStart}
        GROUP BY bucket
        ORDER BY bucket ASC
      `,
    ]);

    let admissionsByStaff: Array<{
      staffId: number;
      staffCode: string;
      staffName: string;
      totalAdmissions: number;
    }> = [];

    if (groupedAdmissions.length > 0) {
      const staffIds = groupedAdmissions.map((group) => group.nvTiepNhanId);

      const staffMembers = await prisma.nhanVien.findMany({
        where: { id: { in: staffIds } },
        select: {
          id: true,
          hoTen: true,
          maNV: true,
        },
      });

      const staffMap = new Map<number, { id: number; hoTen: string; maNV: string }>(
        staffMembers.map((member) => [member.id, member])
      );

      admissionsByStaff = groupedAdmissions
        .map((group) => {
          const staff = staffMap.get(group.nvTiepNhanId);

          if (!staff) {
            return null;
          }

          return {
            staffId: staff.id,
            staffCode: staff.maNV,
            staffName: staff.hoTen,
            totalAdmissions: group._count?._all ?? 0,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .sort((a, b) => b.totalAdmissions - a.totalAdmissions);
    }

    const timeline = {
      day: buildTimeline("day", dayBuckets, dailyRows),
      week: buildTimeline("week", weekBuckets, weeklyRows),
      month: buildTimeline("month", monthBuckets, monthlyRows),
      year: buildTimeline("year", yearBuckets, yearlyRows),
    };

    return Send.success(
      res,
      {
        totalAdmissions,
        admissionsByStaff,
        timeline,
        detailRange,
      },
      "Fetched nurse reception report"
    );
  } catch (error) {
    return next(error);
  }
};

const getAccountantRevenueReport = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const period = parseRevenuePeriod(req.query.period);
    const range = normalizeRevenueRange(period, req.query.from, req.query.to);
    const bucketStart = alignRevenueBucketStart(range.start, period);
    const bucketEnd = alignRevenueBucketStart(range.end, period);
    const buckets = generateRevenueBuckets(period, bucketStart, bucketEnd);

    const where = {
      trangThai: clinicConstants.invoiceStatus.active,
      ngayLap: {
        gte: range.start,
        lte: range.end,
      },
    } as const;

    const truncUnit = period === "daily" ? "day" : period === "monthly" ? "month" : "year";
    const truncUnitSql =
      truncUnit === "day"
        ? Prisma.raw("'day'")
        : truncUnit === "month"
          ? Prisma.raw("'month'")
          : Prisma.raw("'year'");

    const [summary, groupedByEmployee, timelineRows] = await Promise.all([
      prisma.hoaDon.aggregate({
        _sum: { tongTien: true },
        _count: { _all: true },
        where,
      }),
      prisma.hoaDon.groupBy({
        by: ["nhanVienId"],
        where,
        _sum: { tongTien: true },
        _count: { _all: true },
      }),
      prisma.$queryRaw<RevenueTimelineRow[]>(
        Prisma.sql`
          SELECT DATE_TRUNC(${truncUnitSql}, "HD_NgayLap") AS bucket,
                 COALESCE(SUM("HD_TongTien"), 0)::numeric AS total,
                 COUNT(*)::int AS count
          FROM "HoaDon"
          WHERE "HD_NgayLap" >= ${range.start}
            AND "HD_NgayLap" <= ${range.end}
            AND "HD_TrangThai" = ${clinicConstants.invoiceStatus.active}
          GROUP BY bucket
          ORDER BY bucket ASC
        `,
      ),
    ]);

    const employeeIds = groupedByEmployee
      .map((item) => item.nhanVienId)
      .filter((id): id is number => typeof id === "number" && Number.isInteger(id));

    const employees = employeeIds.length
      ? await prisma.nhanVien.findMany({
          where: { id: { in: employeeIds } },
          select: {
            id: true,
            hoTen: true,
            maNV: true,
          },
        })
      : [];

    const employeeMap = new Map<number, { id: number; hoTen: string; maNV: string }>(
      employees.map((employee) => [employee.id, employee])
    );

    const breakdown = groupedByEmployee
      .map((group) => {
        const staff = employeeMap.get(group.nhanVienId ?? 0);
        if (!staff) {
          return null;
        }

        return {
          employeeId: staff.id,
          employeeCode: staff.maNV,
          employeeName: staff.hoTen,
          totalRevenue: toNumber(group._sum?.tongTien ?? 0),
          invoiceCount: toNumber(group._count?._all ?? 0),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    const timeline = buildRevenueTimeline(period, buckets, timelineRows);

    const totalRevenue = toNumber(summary._sum?.tongTien ?? 0);
    const totalInvoices = toNumber(summary._count?._all ?? 0);

    return Send.success(
      res,
      {
        period,
        range: {
          start: range.start.toISOString(),
          end: range.end.toISOString(),
        },
        totalRevenue,
        totalInvoices,
        breakdown,
        timeline,
      },
      "Fetched accountant revenue report"
    );
  } catch (error) {
    return next(error);
  }
};

const getDoctorSummary = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const context = req.body as Record<string, unknown> | undefined;
    const doctorIdRaw = context?.authenticatedNhanVienId ?? context?.nhanVienId;

    const doctorId = typeof doctorIdRaw === "number" ? doctorIdRaw : Number(doctorIdRaw);

    if (!Number.isInteger(doctorId) || doctorId <= 0) {
      return Send.badRequest(res, null, "Doctor identifier is required");
    }

    const range = parseDetailRange(req.query.range);
    const rangeStart = getDetailRangeStart(range);

    const [totalPatients, patientVisits] = await Promise.all([
      prisma.benhAn.count({
        where: {
          nvKhamId: doctorId,
          thoiGianVao: {
            gte: rangeStart,
          },
        },
      }),
      prisma.benhAn.findMany({
        where: {
          nvKhamId: doctorId,
          thoiGianVao: {
            gte: rangeStart,
          },
        },
        orderBy: {
          thoiGianVao: "desc",
        },
        select: {
          id: true,
          thoiGianVao: true,
          benhNhan: {
            select: {
              id: true,
              hoTen: true,
              maBenhNhan: true,
            },
          },
        },
      }),
    ]);

    const patients = patientVisits
      .filter((visit) => visit.benhNhan !== null)
      .map((visit) => ({
        visitId: visit.id,
        patientId: visit.benhNhan.id,
        patientCode: visit.benhNhan.maBenhNhan,
        patientName: visit.benhNhan.hoTen,
        examinedAt: visit.thoiGianVao.toISOString(),
      }));

    return Send.success(
      res,
      {
        totalPatients,
        patients,
        range,
      },
      "Fetched doctor summary"
    );
  } catch (error) {
    return next(error);
  }
};

export default {
  getNurseReceptionReport,
  getAccountantRevenueReport,
  getDoctorSummary,
};
