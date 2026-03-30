

# Mock Data Cleanup & Bulk Import Enhancement

## Overview
Three changes: (1) clean the CSV data, (2) update the bulk import edge function to handle duplicate emails with primary/additional team logic, (3) update the frontend to parse the new columns and convert dates.

---

## 1. Clean & Re-export Mock CSVs

**Player CSV** — normalize before import:
- Set `competition` to "Division 1 Womens" for all rows (per user instruction)
- Keep `is_primary_team` column as-is (Yes or blank)
- Convert `date_of_birth` from DD/MM/YYYY to YYYY-MM-DD for DB compatibility
- Output cleaned CSV to `/mnt/documents/`

**Fixture CSV** — normalize:
- Set `competition` to "Division 1 Womens" for all rows
- Keep TBD opponents as-is
- Dates are already in YYYY-MM-DD format, no change needed
- Output cleaned CSV to `/mnt/documents/`

---

## 2. Bulk Import Edge Function (`supabase/functions/bulk-import/index.ts`)

Add `is_primary_team` boolean to the `PlayerRow` interface.

**New duplicate-email logic** (replaces the current "invite or fail" approach):

```
For each player row:
  1. Check if a user with this email already exists (listUsers by email)
  2. If user exists:
     a. If is_primary_team = true:
        - Check if they already have a PRIMARY membership in this association
        - If yes → error: "Duplicate primary team in same association"
        - If no → add PRIMARY membership + update profile details
     b. If is_primary_team = false/blank:
        - Just insert a PERMANENT team_membership (additional team)
        - Do NOT update profile details
  3. If user doesn't exist:
     - Invite by email (current flow)
     - Set membership_type based on is_primary_team flag
     - Update profile details only for primary team rows
```

---

## 3. Frontend (`src/pages/admin/BulkImport.tsx`)

- Add `is_primary_team` to `ParsedRow` interface
- Parse the column from CSV: `row["is_primary_team"]` / `row["Is Primary Team"]` → boolean (truthy if "Yes")
- Convert DD/MM/YYYY dates to YYYY-MM-DD during parsing (split on `/`, rearrange)
- Pass `is_primary_team` in the payload to the edge function
- Add `competition` column alias mapping (already partially there via `division` field)
- Validation: flag duplicate emails that both have `is_primary_team = true` for the same association as client-side warnings

---

## Files Summary

| File | Change |
|------|--------|
| Player CSV | Normalize division to "Division 1 Womens", convert dates — output to `/mnt/documents/` |
| Fixture CSV | Normalize division to "Division 1 Womens" — output to `/mnt/documents/` |
| `supabase/functions/bulk-import/index.ts` | Add `is_primary_team` field, handle existing users (add as additional team vs error on duplicate primary) |
| `src/pages/admin/BulkImport.tsx` | Parse `is_primary_team` column, convert DD/MM/YYYY → YYYY-MM-DD, pass flag to edge function |

