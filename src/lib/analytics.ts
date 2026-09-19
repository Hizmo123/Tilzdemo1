import { prisma } from "@/lib/prisma";
import { pctChange, priorRange, type ResolvedRange } from "@/lib/date-range";

// All analytics are derived from real recorded data (paid bills, bill items,
// orders). Nothing is estimated or faked (spec §43).

function dayKey(d: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
function dayLabel(d: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: timezone,
    day: "numeric",
    month: "short",
  }).format(d);
}

// ---- Revenue overview --------------------------------------------------

export type RevenueOverview = {
  empty: boolean;
  totalRevenueCents: number;
  orderCount: number;
  avgOrderCents: number;
  tipsCents: number;
  revenueChangePct: number | null;
  orderCountChangePct: number | null;
  series: { label: string; valueCents: number }[];
  topItems: { name: string; qty: number; revenueCents: number }[];
};

export async function getRevenueOverview(
  restaurantId: string,
  timezone: string,
  range: ResolvedRange,
): Promise<RevenueOverview> {
  const hasTables = (await prisma.table.count({ where: { location: { restaurantId } } })) > 0;
  if (!hasTables) {
    return {
      empty: true,
      totalRevenueCents: 0,
      orderCount: 0,
      avgOrderCents: 0,
      tipsCents: 0,
      revenueChangePct: null,
      orderCountChangePct: null,
      series: [],
      topItems: [],
    };
  }

  const tableFilter = { location: { restaurantId } };
  const prev = priorRange(range);

  const [current, previous, bills, topItemsRaw] = await Promise.all([
    prisma.bill.aggregate({
      where: { table: tableFilter, status: "PAID", paidAt: { gte: range.from, lt: range.to } },
      // Revenue is amountPaidCents, not totalCents: for a PAID bill the two
      // start out equal, but a later refund only ever decrements
      // amountPaidCents (never totalCents/status — see refundBillPayment in
      // lib/bills.ts), so amountPaidCents is the figure that's actually net
      // of refunds.
      _sum: { amountPaidCents: true, tipCents: true },
      _count: true,
    }),
    prisma.bill.aggregate({
      where: { table: tableFilter, status: "PAID", paidAt: { gte: prev.from, lt: prev.to } },
      _sum: { amountPaidCents: true },
      _count: true,
    }),
    prisma.bill.findMany({
      where: { table: tableFilter, status: "PAID", paidAt: { gte: range.from, lt: range.to } },
      select: { amountPaidCents: true, paidAt: true },
    }),
    prisma.billItem.groupBy({
      by: ["nameSnapshot"],
      where: {
        bill: { table: tableFilter, status: "PAID", paidAt: { gte: range.from, lt: range.to } },
      },
      _sum: { quantity: true, lineTotalCents: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 8,
    }),
  ]);

  // Daily buckets spanning the whole range (the chart thins labels itself for
  // long ranges, so this stays simple regardless of span).
  const buckets = new Map<string, number>();
  const labels: { key: string; label: string }[] = [];
  for (let d = new Date(range.from); d < range.to; d = new Date(d.getTime() + 86_400_000)) {
    const key = dayKey(d, timezone);
    buckets.set(key, 0);
    labels.push({ key, label: dayLabel(d, timezone) });
  }
  for (const b of bills) {
    if (!b.paidAt) continue;
    const key = dayKey(b.paidAt, timezone);
    if (buckets.has(key)) buckets.set(key, buckets.get(key)! + b.amountPaidCents);
  }
  const series = labels.map((l) => ({ label: l.label, valueCents: buckets.get(l.key) ?? 0 }));

  const totalRevenueCents = current._sum.amountPaidCents ?? 0;
  const orderCount = current._count;
  const prevRevenueCents = previous._sum.amountPaidCents ?? 0;

  return {
    empty: false,
    totalRevenueCents,
    orderCount,
    avgOrderCents: orderCount > 0 ? Math.round(totalRevenueCents / orderCount) : 0,
    tipsCents: current._sum.tipCents ?? 0,
    revenueChangePct: pctChange(totalRevenueCents, prevRevenueCents),
    orderCountChangePct: pctChange(orderCount, previous._count),
    series,
    topItems: topItemsRaw.map((t) => ({
      name: t.nameSnapshot,
      qty: t._sum.quantity ?? 0,
      revenueCents: t._sum.lineTotalCents ?? 0,
    })),
  };
}

// ---- Product performance ------------------------------------------------

export type ProductRow = {
  name: string;
  category: string | null;
  units: number;
  revenueCents: number;
  sharePct: number;
};

// Per-item performance over a range. Built from paid bills only. Also
// surfaces items that sold nothing in the window — the "dead menu" an owner
// most wants to find.
export async function getProductPerformance(restaurantId: string, range: ResolvedRange) {
  const paidWhere = {
    table: { location: { restaurantId } },
    status: "PAID" as const,
    paidAt: { gte: range.from, lt: range.to },
  };

  const [grouped, menuItems] = await Promise.all([
    prisma.billItem.groupBy({
      by: ["nameSnapshot"],
      where: { bill: paidWhere },
      _sum: { quantity: true, lineTotalCents: true },
    }),
    prisma.menuItem.findMany({
      where: { category: { restaurantId } },
      select: { name: true, available: true, category: { select: { name: true } } },
    }),
  ]);

  const categoryByName = new Map(menuItems.map((m) => [m.name, m.category.name]));
  const soldNames = new Set(grouped.map((g) => g.nameSnapshot));

  const totalRevenue = grouped.reduce((sum, g) => sum + (g._sum.lineTotalCents ?? 0), 0);

  const rows: ProductRow[] = grouped
    .map((g) => {
      const revenueCents = g._sum.lineTotalCents ?? 0;
      return {
        name: g.nameSnapshot,
        category: categoryByName.get(g.nameSnapshot) ?? null,
        units: g._sum.quantity ?? 0,
        revenueCents,
        sharePct: totalRevenue > 0 ? (revenueCents / totalRevenue) * 100 : 0,
      };
    })
    .sort((a, b) => b.revenueCents - a.revenueCents);

  const notSelling = menuItems
    .filter((m) => !soldNames.has(m.name))
    .map((m) => ({ name: m.name, category: m.category.name, available: m.available }));

  return {
    rows,
    notSelling,
    totalRevenue,
    totalUnits: rows.reduce((s, r) => s + r.units, 0),
    hasMenu: menuItems.length > 0,
  };
}

// ---- Order tracking -------------------------------------------------------

export type OrderTracking = {
  totalOrders: number;
  bySource: { customer: number; staff: number };
  byStatus: { served: number; cancelled: number; active: number };
  cancelledPct: number;
  avgItemsPerOrder: number;
  hourly: { hour: number; count: number }[]; // 24 buckets, local time
};

export async function getOrderTracking(
  restaurantId: string,
  timezone: string,
  range: ResolvedRange,
): Promise<OrderTracking> {
  const orders = await prisma.order.findMany({
    where: { restaurantId, createdAt: { gte: range.from, lt: range.to } },
    select: {
      status: true,
      source: true,
      createdAt: true,
      _count: { select: { items: true } },
    },
  });

  const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
  let served = 0;
  let cancelled = 0;
  let customerCount = 0;
  let staffCount = 0;
  let totalItems = 0;

  for (const o of orders) {
    const hour = Number(
      new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", hourCycle: "h23" })
        .format(o.createdAt)
        .slice(0, 2),
    );
    if (hourly[hour]) hourly[hour].count++;

    if (o.status === "SERVED") served++;
    else if (o.status === "CANCELLED") cancelled++;
    if (o.source === "CUSTOMER") customerCount++;
    else staffCount++;
    totalItems += o._count.items;
  }

  const totalOrders = orders.length;
  return {
    totalOrders,
    bySource: { customer: customerCount, staff: staffCount },
    byStatus: { served, cancelled, active: totalOrders - served - cancelled },
    cancelledPct: totalOrders > 0 ? (cancelled / totalOrders) * 100 : 0,
    avgItemsPerOrder: totalOrders > 0 ? totalItems / totalOrders : 0,
    hourly,
  };
}

// ---- Customer tracking ------------------------------------------------
//
// There are no customer accounts in Tillz — guests are anonymous QR
// sessions. The only durable identity signal is a phone number, left
// voluntarily on a bill. So "customer tracking" here means exactly that,
// honestly: repeat-visit behaviour among guests who left a number, plus a
// plain visit-count (not identity-count). The UI must not imply this is a
// full CRM.

export type CustomerTracking = {
  visits: number;
  identifiedCustomers: number; // unique phones seen in range
  newCustomers: number; // first-ever paid bill for that phone falls in range
  returningCustomers: number;
  topCustomers: { phone: string; name: string | null; visits: number; totalSpentCents: number }[];
};

export async function getCustomerTracking(
  restaurantId: string,
  range: ResolvedRange,
): Promise<CustomerTracking> {
  const tableFilter = { location: { restaurantId } };

  const [visits, inRangeGroups] = await Promise.all([
    prisma.bill.count({
      where: {
        table: tableFilter,
        status: "PAID",
        paidAt: { gte: range.from, lt: range.to },
      },
    }),
    prisma.bill.groupBy({
      by: ["customerPhone"],
      where: {
        table: tableFilter,
        status: "PAID",
        customerPhone: { not: null },
        paidAt: { gte: range.from, lt: range.to },
      },
      _count: true,
      _sum: { totalCents: true },
    }),
  ]);

  const phones = inRangeGroups.map((g) => g.customerPhone as string);

  const returningPhones =
    phones.length > 0
      ? await prisma.bill.groupBy({
          by: ["customerPhone"],
          where: {
            table: tableFilter,
            status: "PAID",
            customerPhone: { in: phones },
            paidAt: { lt: range.from },
          },
          _count: true,
        })
      : [];
  const returningSet = new Set(returningPhones.map((g) => g.customerPhone));

  const sorted = [...inRangeGroups].sort(
    (a, b) => (b._sum.totalCents ?? 0) - (a._sum.totalCents ?? 0),
  );
  const topPhones = sorted.slice(0, 5).map((g) => g.customerPhone as string);

  const latestNames =
    topPhones.length > 0
      ? await prisma.bill.findMany({
          where: { customerPhone: { in: topPhones }, status: "PAID", table: tableFilter },
          orderBy: { createdAt: "desc" },
          select: { customerPhone: true, customerName: true },
          distinct: ["customerPhone"],
        })
      : [];
  const nameByPhone = new Map(latestNames.map((b) => [b.customerPhone, b.customerName]));

  return {
    visits,
    identifiedCustomers: phones.length,
    newCustomers: phones.filter((p) => !returningSet.has(p)).length,
    returningCustomers: returningSet.size,
    topCustomers: sorted.slice(0, 5).map((g) => ({
      phone: g.customerPhone as string,
      name: nameByPhone.get(g.customerPhone as string) ?? null,
      visits: g._count,
      totalSpentCents: g._sum.totalCents ?? 0,
    })),
  };
}
