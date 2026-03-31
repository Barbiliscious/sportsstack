

# Multi-Issue Fix Plan

This plan addresses 8 distinct issues reported by the user across imports, header navigation, sidebar, user management, and player creation.

---

## 1. Bulk Import — Better Error Messages, All Columns, Template with Dropdowns, DOB Fix

**Problem:** Preview only shows limited columns. DOB shows as Excel serial number (32872.458333333336). Template has no dropdowns for constrained fields. Errors are vague.

**Fix in `src/pages/admin/BulkImport.tsx`:**
- **DOB parsing**: Detect Excel serial numbers (numeric values) and convert them to dates using `new Date((serial - 25569) * 86400 * 1000)` in addition to the existing DD/MM/YYYY parsing
- **Preview table**: Show ALL imported columns (phone, suburb, emergency contacts, association, club, competition, team_name, is_primary_team, jersey_number, position, role, notes)
- **Template with dropdowns**: Use `xlsx` data validation to add dropdown lists for: `gender` (Male/Female/Other), `role` (PLAYER/COACH/TEAM_MANAGER/CLUB_ADMIN/ASSOCIATION_ADMIN), `is_primary_team` (Yes/No), `position` (GK/FB/HB/MF/IF/CF), and dynamically populate `association` and `club` columns based on loaded reference data
- **Error messages**: Show specific validation errors per row (e.g., "Club 'XYZ' not found in selected association — did you mean 'ABC'?") with option to correct values inline via dropdowns in the preview table
- **Editable preview**: Allow users to fix club/division/team_name mismatches in the preview by selecting from dropdowns instead of re-uploading

**Also update `ParsedRow` interface** to include all new columns: `team_name`, `association_name`, `jersey_number`, `position`, `role`, `notes`.

---

## 2. Fixture Import — Template, Import, View/Edit/Delete

**Problem:** No fixture import UI, no template, no way to edit/delete imported fixtures.

**New file: `src/pages/admin/FixtureImport.tsx`** (similar structure to BulkImport):
- Download template button with headers: `round_number`, `date`, `time`, `home_team`, `away_team`, `location`, `competition`, `notes`
- File upload with XLSX/CSV parsing
- Preview table with validation (team name resolution against DB)
- Submit to edge function or direct insert via Supabase client

**Update `src/pages/admin/FixturesManagement.tsx`:**
- Add "Import Fixtures" button linking to the new import page
- Add inline edit capability per fixture row (click to edit opponent, date, location, status, scores)
- Add delete button per fixture with confirmation dialog
- Add "Add Fixture" button for manual single-fixture creation

**Add route** in `src/App.tsx` for `/admin/fixture-import`.

---

## 3. Users Management — Association & Club Filters (Remove Team Filter)

**Problem:** Users page has a Team filter but should have Association and Club filters instead.

**Fix in `src/pages/admin/UsersManagement.tsx`:**
- Replace `teamFilter` state with `associationFilter` and `clubFilter`
- Add Association dropdown (scoped to admin's associations)
- Add Club dropdown (filtered by selected association)
- Remove Team dropdown
- Update `filteredUsers` logic to filter by association/club via the membership → team → club → association chain

---

## 4. Header Cascade — Back/Reset Behavior & Dashboard Link

**Problem:** Clicking back in the header cascade (Association → Club → Division → Team) doesn't clear child selections. No "Dashboard" option.

**Fix in `src/components/layout/AppLayout.tsx`:**
- Add a "Dashboard" link at the top of the Association popover list (navigates to `/admin` or `/dashboard` depending on mode)
- Ensure `setSelectedAssociationId` handler (already in TeamContext) clears club/division/team — verify the `handleAssociationChange` in TeamContext already does this (it does)
- Add "clear" option to Club, Division, and Team selectors so the user can step back: add "All Clubs" / "All Divisions" / "All Teams" option with value `""` that resets child selectors
- When Club selector value changes to "", also clear division and team (already handled by `handleClubChange` in TeamContext)

---

## 5. Sidebar — Make Static (No Scroll)

**Problem:** Sidebar moves during page scrolling.

**Fix in `src/components/layout/AppLayout.tsx`:**
- Change desktop sidebar from `min-h-[calc(100vh-3.5rem)]` to `sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto`
- This pins the sidebar to the viewport while the main content scrolls independently

---

## 6. Primary Team Request Flow — User Requests, Admin Accepts, User Confirms

**Problem:** User needs to request a primary team change, admin approves, then user confirms.

The `primary_change_requests` table already exists with status field. The `SetPrimaryTeamDialog` already creates requests.

**Fix in `src/components/profile/SetPrimaryTeamDialog.tsx`:**
- Allow requesting from ANY team (not just current memberships) — user can search/browse teams
- On submit, insert a `primary_change_requests` record with status `PENDING`

**Fix in `src/pages/admin/UsersManagement.tsx`:**
- Show pending primary change requests with Approve/Decline actions
- On admin approval, update request status to `ADMIN_APPROVED`

**Fix in `src/pages/Profile.tsx` or `TeamMembershipSection.tsx`:**
- Show pending requests with "Confirm Change" button when status is `ADMIN_APPROVED`
- On user confirmation, execute the actual membership swap (downgrade old PRIMARY to PERMANENT, upgrade new team to PRIMARY)

**Database migration:** Add `ADMIN_APPROVED` as a valid status value if using a check constraint, or just use the text field as-is.

---

## 7. Add Player — Better Duplicate Email Error & Team Assignment

**Problem:** Duplicate email gives a generic error. Team should be assigned to new user if selected.

**Fix in `supabase/functions/create-player/index.ts`:**
- Catch the specific `inviteUserByEmail` error for duplicate emails and return: `"A user with email 'x@y.com' already exists. Use Bulk Import to add them to additional teams."`

**Fix in `src/pages/admin/AddPlayer.tsx`:**
- The form already sends `team_assignments` and the edge function already creates memberships — verify the error message is surfaced properly in the toast. The current code at line 117-124 does show `data?.error`, so the fix is primarily in the edge function error message.

---

## Files Summary

| File | Change |
|------|--------|
| `src/pages/admin/BulkImport.tsx` | All columns in preview, DOB serial fix, template dropdowns, editable preview, better errors |
| `src/pages/admin/FixturesManagement.tsx` | Import button, inline edit/delete per fixture, add fixture |
| `src/pages/admin/FixtureImport.tsx` | **New** — fixture import with template, upload, preview, submit |
| `src/pages/admin/UsersManagement.tsx` | Replace team filter with association + club filters |
| `src/components/layout/AppLayout.tsx` | Sticky sidebar, dashboard link in association popover, clear options in cascade selectors |
| `src/components/profile/SetPrimaryTeamDialog.tsx` | Support request flow |
| `src/components/profile/TeamMembershipSection.tsx` | Show admin-approved requests with confirm button |
| `supabase/functions/create-player/index.ts` | Better duplicate email error message |
| `src/App.tsx` | Add `/admin/fixture-import` route |

