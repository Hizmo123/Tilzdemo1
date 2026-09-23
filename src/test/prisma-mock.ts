import { vi } from "vitest";

// A tiny auto-mock for the Prisma client, built for this test pass rather
// than pulling in vitest-mock-extended (one more dependency for something a
// two-level Proxy covers completely: every real call site here is either
// `prisma.<model>.<method>(...)` or `prisma.$transaction(...)`).
//
// Usage: `const prisma = createPrismaMock(); vi.mock("@/lib/prisma", () => ({ prisma }));`
// then `prisma.menuItem.findFirst.mockResolvedValue(...)` etc. Every
// `<model>.<method>` access returns the SAME vi.fn() on repeat access (cached
// per mock instance), so assertions like `expect(prisma.bill.update).toHaveBeenCalledWith(...)`
// work normally.
//
// $transaction supports both forms actually used in this codebase:
//   - array-of-promises: `prisma.$transaction([p1, p2])` -> resolves the array
//   - callback: `prisma.$transaction(async (tx) => {...})` -> calls it with
//     THIS SAME mock as `tx`, so a test can assert against `prisma.order.update`
//     regardless of whether the real code used `prisma.x` or `tx.x` inside.
export function createPrismaMock(): Record<string, unknown> {
  const modelCache = new Map<string, Record<string, ReturnType<typeof vi.fn>>>();

  let transactionMock: ReturnType<typeof vi.fn> | undefined;

  const root: Record<string, unknown> = new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (prop === "$transaction") {
          // Cached, same as every model below — a fresh vi.fn() on each
          // access would make `expect(prisma.$transaction).toHaveBeenCalled()`
          // always fail, since the assertion and the code under test would be
          // looking at two different spies.
          if (!transactionMock) {
            transactionMock = vi.fn(async (arg: unknown) => {
              if (Array.isArray(arg)) return Promise.all(arg);
              if (typeof arg === "function") {
                return (arg as (tx: unknown) => unknown)(root);
              }
              return arg;
            });
          }
          return transactionMock;
        }
        if (prop === "then") return undefined; // never let this be mistaken for a thenable
        if (!modelCache.has(prop)) {
          modelCache.set(
            prop,
            new Proxy(
              {},
              {
                get(methodTarget: Record<string, ReturnType<typeof vi.fn>>, method: string) {
                  if (!methodTarget[method]) methodTarget[method] = vi.fn();
                  return methodTarget[method];
                },
              },
            ) as unknown as Record<string, ReturnType<typeof vi.fn>>,
          );
        }
        return modelCache.get(prop);
      },
    },
  );
  return root;
}
