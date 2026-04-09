

# Bulk Import: 5 Fixes

## Fix 1 — Duplicate mock email clash

**Edge function** (`supabase/functions/bulk-import/index.ts`):
- When `player.email` is null/empty, generate `firstname.lastname@grampianshockey.mock`
- Query existing auth users to check if that email exists; if so, increment suffix (`firstname.lastname2@...`, `firstname.lastname3@...`) until unique
- Remove the current "Email is required (skipped)" error on line 148-149

**Frontend** (`BulkImport.tsx`):
- Remove the "Email required" validation on line 189
- Allow empty email rows to pass client-side validation

## Fix 2 — Clear All Test Data

**New edge function** (`supabase/functions/clear-test-data/index.ts`):
1. Validate caller is SUPER_ADMIN via service role lookup
2. Accept `association_id`
3. Find all clubs → teams in that association
4. Find all user IDs with memberships on those teams
5. Delete in order: `user_roles` for those users + teams, `team_memberships` for those teams, `profiles` for those users, then delete auth users via `admin.deleteUser()`
6. **Confirmed: profiles table records are deleted**, not just memberships and auth users
7. Only delete users who have NO remaining memberships in other associations after removing the target association's memberships
8. Return counts of deleted records

**Config** (`supabase/config.toml`): Add `[functions.clear-test-data] verify_jwt = false`

**Frontend** (`BulkImport.tsx`):
- Add "Clear All Test Data" button visible only when `isSuperAdmin`
- Show `AlertDialog` with association selector and confirmation text
- Call the edge function on confirm, show toast with results

## Fix 3 — Keep failed rows after import

**Frontend** (`BulkImport.tsx`):
- After `handleSubmit` completes with results, match returned `errors` array back to preview rows by `row_number`
- Remove successfully imported rows from `rows` state
- Keep failed rows with their server-side error message appended to `errors`
- Change the submit button condition (line 653) from `!importResult` to also show when failed rows remain, enabling re-submission
- Reset `importResult` when user edits a failed row

## Fix 4 — Reference sheet in template

**Frontend** (`BulkImport.tsx` `downloadTemplate`):
- After creating the "Players" sheet, add a second sheet "Allowed Values"
- Columns: Gender, Position, Role, Is Primary Team, Club (dynamic from `assocClubs`), Division (dynamic from teams in selected association)
- Each column header in row 1, valid values listed vertically below

## Fix 5 — Roles restricted to Super Admin

**Frontend** (`BulkImport.tsx`):
- If `!isSuperAdmin`: remove "role" from template headers, hide Role column in preview table, strip `role` to null before submission
- If `isSuperAdmin`: no change

**Edge function** (`supabase/functions/bulk-import/index.ts`):
- Add `role` field to `PlayerRow` interface
- When inserting `user_roles`: if caller is SUPER_ADMIN and `player.role` is a valid role string, use that role instead of hardcoded "PLAYER"
- For non-SUPER_ADMIN callers, always use "PLAYER" regardless of input
- Set appropriate scope on the role row: PLAYER/COACH/TEAM_MANAGER → `team_id`, CLUB_ADMIN → `club_id` (looked up from team), ASSOCIATION_ADMIN → `association_id`

## Files Changed

| File | Action |
|------|--------|
| `src/pages/admin/BulkImport.tsx` | Edit — all 5 fixes (frontend) |
| `supabase/functions/bulk-import/index.ts` | Edit — Fix 1, Fix 5 |
| `supabase/functions/clear-test-data/index.ts` | Create — Fix 2 |
| `supabase/config.toml` | Edit — add clear-test-data config |

No database migrations needed.

