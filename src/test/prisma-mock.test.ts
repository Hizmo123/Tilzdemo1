import { describe, expect, it, vi } from "vitest";
import { createPrismaMock } from "./prisma-mock";

describe("createPrismaMock", () => {
  it("caches the same vi.fn() per model.method across repeated access", () => {
    const prisma = createPrismaMock() as any;
    prisma.bill.findFirst.mockResolvedValue({ id: "b1" });
    expect(prisma.bill.findFirst).toBe(prisma.bill.findFirst);
  });

  it("$transaction runs an array of promises", async () => {
    const prisma = createPrismaMock() as any;
    const result = await prisma.$transaction([Promise.resolve(1), Promise.resolve(2)]);
    expect(result).toEqual([1, 2]);
  });

  it("$transaction runs a callback with itself as tx", async () => {
    const prisma = createPrismaMock() as any;
    prisma.order.update.mockResolvedValue({ id: "o1" });
    const spy = vi.fn(async (tx: any) => tx.order.update({ where: { id: "o1" }, data: {} }));
    const result = await prisma.$transaction(spy);
    expect(result).toEqual({ id: "o1" });
    expect(prisma.order.update).toHaveBeenCalledTimes(1);
  });
});
