import { z } from 'zod';

// Schemas validate only fields the codebase actually reads. They are used at
// the API boundary in novem-api.ts to log shape drift (never throw), so that
// we can learn when the upstream API changes without breaking the extension.
//
// All object schemas are `loose` — extra fields pass through unchanged, so
// extending the wire format on the server never trips validation.

// GET /admin/profile/overview — consumed in extension.ts (email, name) and
// tree.ts (username). Other UserProfile fields from config.ts are not read
// anywhere in the extension, so they are not schema'd. Fields use `.nullish()`
// (= optional OR null) because the server returns explicit nulls for unset
// values rather than omitting them.
export const UserProfileSchema = z.looseObject({
    user_info: z.looseObject({
        username: z.string().nullish(),
        email: z.string().nullish(),
        name: z.string().nullish(),
    }),
});
export type UserProfileApi = z.infer<typeof UserProfileSchema>;

// GET /code — consumed in extension.ts as `.some(item => item.name === 'jobs'/'repos')`
// to decide whether to register the Jobs and Repos tree views.
export const CodeRootItemSchema = z.looseObject({
    name: z.string(),
});
export const CodeRootResponseSchema = z.array(CodeRootItemSchema);
export type CodeRootItem = z.infer<typeof CodeRootItemSchema>;

// GET /u/<user>/p and /u/<user>/m — plot/mail list entries. Consumed as
// QuickPick items in commands.ts (id/name/type/summary/uri/shortname) and
// as tree root items in tree.ts (id/name/permissions/type, validated again
// by tree.schema.ts). `created` and `vis_type` from config.ts's VisInfo
// interface are not read anywhere, so they are omitted. Strings are
// `.nullish()` because the server returns null for unset fields (observed
// on summary/uri for freshly-created plots).
export const VisListItemSchema = z.looseObject({
    id: z.string().nullish(),
    name: z.string().nullish(),
    type: z.string().nullish(),
    summary: z.string().nullish(),
    uri: z.string().nullish(),
    shortname: z.string().nullish(),
    permissions: z.array(z.string()).nullish(),
});

// The list endpoints return an array of items — except when the list is
// empty, where the server sends `{}` instead of `[]`. Both shapes are valid
// wire responses observed in the wild, so the schema accepts both rather
// than normalising. Downstream consumers need to handle the union.
export const VisListResponseSchema = z.union([z.array(VisListItemSchema), z.strictObject({})]);
export type VisListItem = z.infer<typeof VisListItemSchema>;
export type VisListResponse = z.infer<typeof VisListResponseSchema>;

// Non-throwing validator. Logs a readable warning with the zod issues so we
// can spot upstream drift in the extension host log, and returns nothing —
// the API method keeps its current return type, validation is observational
// only. The log is formatted as plain text (not raw objects) so it's legible
// in the extension host log without expanding nested objects in devtools.
export function warnOnMismatch(schema: z.ZodType, data: unknown, label: string): void {
    const result = schema.safeParse(data);
    if (result.success) return;

    const issueLines = result.error.issues
        .map(issue => {
            const path = issue.path.length ? issue.path.join('.') : '<root>';
            return `  • ${path}: ${issue.message}`;
        })
        .join('\n');

    let rawPreview: string;
    try {
        rawPreview = JSON.stringify(data);
    } catch {
        rawPreview = String(data);
    }
    if (rawPreview.length > 800) {
        rawPreview = rawPreview.slice(0, 800) + '…';
    }

    console.warn(
        `[novem-api] response shape mismatch for ${label}:\n${issueLines}\n  raw: ${rawPreview}`,
    );
}
