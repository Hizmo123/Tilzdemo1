import { prisma } from "@/lib/prisma";
import { addDays, startOfWeekInTz, isoWeekInfo } from "@/lib/time";
import { pctChange } from "@/lib/date-range";

export type WeeklyReport = {
  weekStart: Date;
  weekEnd: Date; // exclusive
  isoYear: number;
  isoWeek: number;
  totalRevenueCents: number;
  tipsCents: number;
  orderCount: number;
  avgOrderCents: number;
  revenueChangePct: number | null;
  byDay: { label: string; valueCents: number }[];
};

// weekOffset: 0 = the week containing "now", -1 = the week before, etc.
// Weeks always run Monday -> Sunday in the venue's local timezone, so "each
// calendar week" lines up with how an owner actually thinks about a week.
export async function getWeeklyReport(
  restaurantId: string,
  timezone: string,
  weekOffset = 0,
): Promise<WeeklyReport> {
  const thisMonday = startOfWeekInTz(new Date(), timezone);
  const weekStart = addDays(thisMonday, weekOffset * 7);
  const weekEnd = addDays(weekStart, 7);
  const prevWeekStart = addDays(weekStart, -7);

  const tableFilter = { location: { restaurantId } };

  const [current, prevTotal, bills] = await Promise.all([
    prisma.bill.aggregate({
      where: {
        table: tableFilter,
        status: "PAID",
        paidAt: { gte: weekStart, lt: weekEnd },
      },
      _sum: { totalCents: true, tipCents: true },
      _count: true,
    }),
    prisma.bill.aggregate({
      where: { table: tableFilter, status: "PAID", paidAt: { gte: prevWeekStart, lt: weekStart } },
      _sum: { totalCents: true },
    }),
    prisma.bill.findMany({
      where: { table: tableFilter, status: "PAID", paidAt: { gte: weekStart, lt: weekEnd } },
      select: { totalCents: true, paidAt: true },
    }),
  ]);

  const totalRevenueCents = current._sum.totalCents ?? 0;
  const orderCount = current._count;
  const prevRevenueCents = prevTotal._sum.totalCents ?? 0;

  const dayBuckets = Array.from({ length: 7 }, (_, i) => ({
    day: addDays(weekStart, i),
    valueCents: 0,
  }));
  const dayKey = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: timezone, dateStyle: "short" }).format(d);
  const bucketByKey = new Map(dayBuckets.map((b) => [dayKey(b.day), b]));
  for (const b of bills) {
    if (!b.paidAt) continue;
    const bucket = bucketByKey.get(dayKey(b.paidAt));
    if (bucket) bucket.valueCents += b.totalCents;
  }

  const { year: isoYear, week: isoWeek } = isoWeekInfo(weekStart, timezone);

  return {
    weekStart,
    weekEnd,
    isoYear,
    isoWeek,
    totalRevenueCents,
    tipsCents: current._sum.tipCents ?? 0,
    orderCount,
    avgOrderCents: orderCount > 0 ? Math.round(totalRevenueCents / orderCount) : 0,
    revenueChangePct: pctChange(totalRevenueCents, prevRevenueCents),
    byDay: dayBuckets.map((b) => ({
      label: new Intl.DateTimeFormat("en-AU", { timeZone: timezone, weekday: "short" }).format(
        b.day,
      ),
      valueCents: b.valueCents,
    })),
  };
}
