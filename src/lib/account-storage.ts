import {
  createServiceClient,
  MENU_IMAGE_BUCKET,
  STAND_DESIGN_BUCKET,
} from "@/lib/supabase/service";

// The slice of the Supabase storage client this file actually uses — a
// structural type so the sweep can be unit-tested with a fake instead of
// hitting real storage.
export type StorageLike = {
  storage: {
    from(bucket: string): {
      list(
        path?: string,
        options?: { limit?: number },
      ): Promise<{ data: { name: string; id?: string | null }[] | null; error: { message: string } | null }>;
      remove(paths: string[]): Promise<{ error: { message: string } | null }>;
    };
  };
};

// Prefixes here are always cuid ids (restaurant/organization). An empty,
// dotted or slashed prefix would make list() walk the bucket ROOT, and this
// function deletes whatever it lists — so anything that isn't a plain id is
// refused outright rather than trusted.
const SAFE_PREFIX = /^[A-Za-z0-9_-]{6,64}$/;

const PAGE = 100;
// Hard ceiling on passes (PAGE files each) so a misbehaving listing can never
// spin forever; 100 * 100 = 10,000 files per prefix.
const MAX_PASSES = 100;

// Deletes every FILE directly under `prefix/` in a bucket. Always re-lists
// from the start instead of paging forward: each pass removes what it just
// listed, so an offset would skip files. Sub-folders (id === null in
// Supabase's listing) are ignored — nothing in this app nests uploads.
export async function removeStoragePrefix(
  client: StorageLike,
  bucket: string,
  prefix: string,
): Promise<{ removed: number }> {
  if (!SAFE_PREFIX.test(prefix)) {
    throw new Error(`Refusing to sweep unsafe storage prefix "${prefix}".`);
  }

  const bucketApi = client.storage.from(bucket);
  let removed = 0;

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const { data, error } = await bucketApi.list(prefix, { limit: PAGE });
    if (error) throw new Error(`Listing ${bucket}/${prefix} failed: ${error.message}`);

    const files = (data ?? []).filter((entry) => entry.id);
    if (files.length === 0) break;

    const { error: rmError } = await bucketApi.remove(files.map((f) => `${prefix}/${f.name}`));
    if (rmError) throw new Error(`Removing from ${bucket}/${prefix} failed: ${rmError.message}`);
    removed += files.length;
  }

  return { removed };
}

// Sweeps everything an organisation ever uploaded: logos, covers, backgrounds
// and menu photos (all under `<restaurantId>/` in the menu-images bucket) and
// custom stand designs (under `<organizationId>/` in stand-designs). Never
// throws — returns what failed, so a storage hiccup is reported without
// undoing an account closure that already happened. Idempotent: safe to run
// again (the admin purge does exactly that as a safety net).
export async function deleteOrganizationFiles(
  organizationId: string,
  restaurantIds: string[],
  client?: StorageLike,
): Promise<{ removed: number; failures: string[] }> {
  const failures: string[] = [];
  let removed = 0;

  let supabase: StorageLike;
  try {
    supabase = client ?? (createServiceClient() as unknown as StorageLike);
  } catch (e) {
    return { removed, failures: [e instanceof Error ? e.message : "Storage isn't configured."] };
  }

  const targets: { bucket: string; prefix: string }[] = [
    ...restaurantIds.map((id) => ({ bucket: MENU_IMAGE_BUCKET, prefix: id })),
    { bucket: STAND_DESIGN_BUCKET, prefix: organizationId },
  ];

  for (const { bucket, prefix } of targets) {
    try {
      removed += (await removeStoragePrefix(supabase, bucket, prefix)).removed;
    } catch (e) {
      failures.push(e instanceof Error ? e.message : `Failed sweeping ${bucket}/${prefix}.`);
    }
  }

  return { removed, failures };
}
