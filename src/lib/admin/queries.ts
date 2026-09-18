// Cross-tenant reads for the platform-admin console. Every function here
// deliberately ignores the normal tenant boundary (organizationId scoping,
// RBAC) that the rest of the app enforces everywhere else — these are meant
// to see across every organisation at once.
//
// SAFE TO USE ONLY after the caller has already run requirePlatformAdmin()
// (src/lib/platform-admin.ts) in the current request — nothing in this file
// checks that itself. Every /admin page and server action must call
// requirePlatformAdmin() before importing/calling anything from here.
//
// Populated in Task 4 (fulfilment queue) and Task 6 (platform overview,
// org list).
export {};
