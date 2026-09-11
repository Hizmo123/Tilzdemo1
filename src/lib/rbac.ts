import type { Role } from "@prisma/client";

// Server-enforced permissions. The dashboard also hides controls a role can't
// use, but that is cosmetic — every mutation re-checks permission server-side
// (spec §29, §100). Never trust the client to have hidden something.
export type Permission =
  | "menu:manage" // create/edit/delete categories & items, change prices
  | "menu:availability" // toggle sold-out only
  | "orders:manage" // take orders / add items to a table's bill
  | "kitchen:manage" // advance order cook status, mark served
  | "tables:manage" // create/edit tables, generate/regenerate QR
  | "staff:manage" // invite/remove staff, change roles
  | "bills:view" // see bills, payments, live tables
  | "audit:view" // see the activity log
  | "settings:manage"; // restaurant/org settings

const ALL: Permission[] = [
  "menu:manage",
  "menu:availability",
  "orders:manage",
  "kitchen:manage",
  "tables:manage",
  "staff:manage",
  "bills:view",
  "audit:view",
  "settings:manage",
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  OWNER: ALL,
  ADMIN: ALL,
  MANAGER: [
    "menu:manage",
    "menu:availability",
    "orders:manage",
    "kitchen:manage",
    "tables:manage",
    "bills:view",
  ],
  STAFF: ["menu:availability", "orders:manage", "kitchen:manage", "bills:view"],
  KITCHEN: ["kitchen:manage", "bills:view"],
  VIEW_ONLY: ["bills:view"],
};

export function roleCan(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

// Human-readable role labels + descriptions for the staff UI.
export const ROLE_META: Record<Role, { label: string; blurb: string }> = {
  OWNER: { label: "Owner", blurb: "Full access, including staff and settings." },
  ADMIN: { label: "Admin", blurb: "Full access to run the venue." },
  MANAGER: {
    label: "Manager",
    blurb: "Menu, tables and bills. No staff or settings.",
  },
  STAFF: { label: "Staff", blurb: "See bills, mark items sold out." },
  KITCHEN: { label: "Kitchen", blurb: "See bills and orders." },
  VIEW_ONLY: { label: "View only", blurb: "Read-only access to bills." },
};

// Roles an owner/admin can assign when inviting (excludes OWNER — ownership is
// not handed out through the invite flow).
export const ASSIGNABLE_ROLES: Role[] = [
  "ADMIN",
  "MANAGER",
  "STAFF",
  "KITCHEN",
  "VIEW_ONLY",
];

// Roles a PIN staff account may hold — operational only. OWNER/ADMIN require a
// real email account, not a shared-terminal PIN. Lives here (not in the server
// actions file) so client components can import it — a "use server" module can
// only export async functions.
export const STAFF_PIN_ROLES: Role[] = [
  "MANAGER",
  "STAFF",
  "KITCHEN",
  "VIEW_ONLY",
];
