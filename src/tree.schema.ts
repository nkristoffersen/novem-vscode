import { z } from 'zod';

// The four kinds of novem visualisation surfaces the extension exposes as tree
// views. Kept as a zod enum so values and types stay in sync.
export const VisTypeSchema = z.enum(['plots', 'mails', 'jobs', 'repos']);
export type VisType = z.infer<typeof VisTypeSchema>;

// Root-level items returned from /u/<user>/p, /u/<user>/m, /code/jobs, /code/repos.
// The API is historically inconsistent: some endpoints return `id`, others `name`.
// The existing tree code treats them interchangeably (`each.id || each.name`) — we
// encode that by requiring at least one and normalising to `id` after parsing.
// Fields are `.nullish()` (accepts undefined *or* null) because the server
// returns explicit nulls for unset values — e.g. plots with no display name.
const TreeRootItemRawSchema = z.object({
    id: z.string().nullish(),
    name: z.string().nullish(),
    permissions: z.array(z.string()).nullish(),
    type: z.string().nullish(),
});

export const TreeRootItemSchema = TreeRootItemRawSchema.refine(
    item => {
        const key = item.id ?? item.name;
        return key !== undefined && key !== null;
    },
    { message: 'Tree root item must have either `id` or `name`' },
).transform(item => ({
    id: (item.id ?? item.name) as string,
    permissions: item.permissions ?? undefined,
    type: item.type ?? undefined,
}));
export type TreeRootItem = z.infer<typeof TreeRootItemSchema>;

// Child items returned when expanding a tree node. Only file/dir/link are
// rendered — the old code filtered other types silently, and the schema does
// the same by rejecting them.
export const TreeChildItemSchema = z.object({
    name: z.string(),
    type: z.enum(['file', 'dir', 'link']),
    permissions: z.array(z.string()),
});
export type TreeChildItem = z.infer<typeof TreeChildItemSchema>;

// Parse an unknown API response into a typed array, dropping entries that fail
// validation. Matches the defensive style of the rest of the codebase: a single
// bad item from the server should not break an entire tree view.
export function parseTreeRootItems(data: unknown): TreeRootItem[] {
    if (!Array.isArray(data)) return [];
    return data.flatMap(item => {
        const result = TreeRootItemSchema.safeParse(item);
        if (result.success) return [result.data];
        console.warn('Dropping invalid tree root item:', item, result.error.issues);
        return [];
    });
}

export function parseTreeChildItems(data: unknown): TreeChildItem[] {
    if (!Array.isArray(data)) return [];
    return data.flatMap(item => {
        const result = TreeChildItemSchema.safeParse(item);
        if (result.success) return [result.data];
        return [];
    });
}
