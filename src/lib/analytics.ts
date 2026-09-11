import { prisma } from "@/lib/prisma";
import { startOfTodayInTz } from "@/lib/time";

// All analytics are derived from real recorded data (paid bills, bill items).
// Nothing is estimated or faked (spec §43).
export async function getAnalytics(restaurantId: string, timezone: string) {
  const tableIds = (
    await prisma.table.findMany({
      where: { location: { restaurantId } },
      select: { id: true },
    })
  ).map((t) => t.id);

  if (tableIds.length === 0) {
    return {
      empty: true as const,
    };
  }

  const startToday = startOfTodayInTz(timezone);
  const start7d = new Date(startToday.getTime() - 6 * 24 * 60 * 60 * 1000);

  const [today, last7dBills, allTimePaid, topItemsRaw] = await Promise.all([
    prisma.bill.aggregate({
      where: { tableId: { in: tableIds }, status: "PAID", paidAt: { gte: startToday } },
      _sum: { totalCents: true, tipCents: true },
      _count: true,
    }),
    prisma.bill.findMany({
      where: { tableId: { in: tableIds }, status: "PAID", paidAt: { gte: start7d } },
      select: { totalCents: true, tipCents: true, paidAt: true },
    }),
    prisma.bill.aggregate({
      where: { tableId: { in: tableIds }, status: "PAID" },
      _sum: { totalCents: true, tipCents: true },
      _count: true,
    }),
    // Top items by quantity across all paid bills.
    prisma.billItem.groupBy({
      by: ["nameSnapshot"],
      where: { bill: { tableId: { in: tableIds }, status: "PAID" } },
      _sum: { quantity: true, lineTotalCents: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 8,
    }),
  ]);

  // Build a 7-day revenue series bucketed by local day.
  const dayKey = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);

  const buckets = new Map<string, number>();
  const labels: { key: string; label: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(startToday.getTime() - i * 24 * 60 * 60 * 1000);
    const key = dayKey(d);
    buckets.set(key, 0);
    labels.push({
      key,
      label: new Intl.DateTimeFormat("en-AU", {
        timeZone: timezone,
        weekday: "short",
      }).format(d),
    });
  }
  for (const b of last7dBills) {
    if (!b.paidAt) continue;
    const key = dayKey(b.paidAt);
    if (buckets.has(key)) buckets.set(key, buckets.get(key)! + b.totalCents);
  }
  const series = labels.map((l) => ({ label: l.label, cents: buckets.get(l.key) ?? 0 }));

  const salesTodayCents = today._sum.totalCents ?? 0;
  const ordersToday = today._count;
  const allPaidCount = allTimePaid._count;
  const allSalesCents = allTimePaid._sum.totalCents ?? 0;
  const avgOrderCents = allPaidCount > 0 ? Math.round(allSalesCents / allPaidCount) : 0;

  return {
    empty: false as const,
    salesTodayCents,
    ordersToday,
    tipsTodayCents: today._sum.tipCents ?? 0,
    avgOrderCents,
    allPaidCount,
    allSalesCents,
    allTipsCents: allTimePaid._sum.tipCents ?? 0,
    series,
    topItems: topItemsRaw.map((t) => ({
      name: t.nameSnapshot,
      qty: t._sum.quantity ?? 0,
      revenueCents: t._sum.lineTotalCents ?? 0,
    })),
  };
}

// ---- Product performance ----------------------------------------------------

export type ProductRow = {
  name: string;
  category: string | null;
  units: number;
  revenueCents: number;
  sharePct: number; // share of total revenue in range
};

// Per-item performance over a range (rangeDays = null means all time). Built
// from paid bills only. Also surfaces items that sold nothing in the window —
// the "dead menu" an owner most wants to find.
export async function getProductPerformance(
  restaurantId: string,
  rangeDays: number | null,
) {
  const tableIds = (
    await prisma.table.findMany({
      where: { location: { restaurantId } },
      select: { id: true },
    })
  ).map((t) => t.id);

  const paidWhere: {
    tableId: { in: string[] };
    status: "PAID";
    paidAt?: { gte: Date };
  } = { tableId: { in: tableIds }, status: "PAID" };
  if (rangeDays) {
    paidWhere.paidAt = {
      gte: new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000),
    };
  }

  const [grouped, menuItems] = await Promise.all([
    prisma.billItem.groupBy({
      by: ["nameSnapshot"],
      where: { bill: paidWhere },
      _sum: { quantity: true, lineTotalCents: true },
    }),
    // Current menu, for category labels and to find items with zero sales.
    prisma.menuItem.findMany({
      where: { category: { restaurantId } },
      select: { name: true, available: true, category: { select: { name: true } } },
    }),
  ]);

  const categoryByName = new Map(menuItems.map((m) => [m.name, m.category.name]));
  const soldNames = new Set(grouped.map((g) => g.nameSnapshot));

  const totalRevenue = grouped.reduce(
    (sum, g) => sum + (g._sum.lineTotalCents ?? 0),
    0,
  );

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

  // Current menu items that recorded no sales in the window.
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
