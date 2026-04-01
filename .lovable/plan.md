

# Multi-Feature Implementation Plan

## Security Pre-check (Priority 0)

### .env in .gitignore
The `.gitignore` file does NOT include `.env`. Add `.env` to `.gitignore`. The Lovable environment variables are loaded automatically via the built-in system — the `.env` file should never be committed. No keys are hardcoded in code; `client.ts` uses `import.meta.env` correctly.

**Action:** Add `.env` line to `.gitignore`.
**Note to user:** Since the `.env` was previously exposed, you should rotate your Supabase keys (anon key and service role key) in the Supabase dashboard to invalidate the leaked credentials.

---

## 1. Dashboard Icon Active State (AppLayout.tsx)

Add a Dashboard link/icon in the top bar (next to the association logo area) that shows an active state when on `/admin` or `/dashboard`. Use the `LayoutDashboard` icon with a highlight when the route matches.

---

## 2-4. Top Bar Dropdown Navigation Behavior (AppLayout.tsx + TeamContext.tsx)

When Association is selected: clear child selections (already works), navigate to `/admin/associations`, close popover.
When Club is selected: clear division/team (already works), navigate to `/admin/clubs`, close dropdown.
When Division is selected: clear team, navigate to the current page (no dedicated division page exists — stay on current page or navigate to `/admin/teams` filtered).

**Changes:**
- `handleAssociationChange`: add `navigate("/admin/associations")`
- Club `onValueChange`: add navigation to `/admin/clubs`
- Division `onValueChange`: add navigation to `/admin/teams`
- Ensure Select components close automatically (they do by default on selection)

---

## 5. Teams — Add "Team Type" Field

### Database Migration
Add `team_type` column to `teams` table:
```sql
ALTER TABLE public.teams ADD COLUMN team_type text;
```

### Frontend (TeamsManagement.tsx)
- Add `team_type` to `formData` state with options: Senior, Junior, Masters
- Add Select dropdown in the create/edit dialog
- Display Team Type column in the table

---

## 6. Teams — Auto-fill Team Name with Club Name

In `handleOpenDialog` (create mode only), when `club_id` is set, pre-fill the `name` field with the selected club's name. Show helper text "Tip: Rename this team after saving." below the name field only when `!editingTeam`.

---

## 7. Teams — Editable Team Names

Team names are already editable via the edit dialog (pencil icon on each row calls `handleOpenDialog(team)`). The name input is currently disabled when division+gender are set (auto-generated). Fix: always allow the name field to be editable, removing the `disabled` prop. The auto-generation can still pre-fill but not lock the field.

---

## 8. Primary Team Request Workflow (Profile + Admin)

The `primary_change_requests` table and `SetPrimaryTeamDialog` already exist. The `TeamMembershipSection` already has `onConfirmChange` and `pendingChangeRequest` props.

### Profile.tsx Changes
- When user requests primary team: insert `primary_change_requests` record with `status = 'PENDING'`
- Show pending request status in `TeamMembershipSection`
- When `status = 'ADMIN_APPROVED'`: show "Confirm Change" button
- On confirm: update old PRIMARY membership to PERMANENT, update new team to PRIMARY, set request status to `COMPLETED`
- Send notification to user on approval/decline

### Admin side — handled in item 12 (Requests page)

---

## 9. Fixtures Screen — Toolbar with Add, Import, Export, Filters (FixturesManagement.tsx)

Add to the existing toolbar:
- **Add button**: Opens a dialog to manually create a single fixture (team, opponent, date, time, location, round, status)
- **Filter controls**: Add filter row with Date range, Team, Round, and Status dropdowns above the table

Import and Export buttons already exist.

---

## 10. Fixture Import — Fix Time Display (FixtureImport.tsx)

The `time` field from Excel arrives as a decimal fraction of 24 hours (e.g., 0.6458 = 15:30). Add a `parseTime` function:

```typescript
function parseTime(val: unknown): string {
  if (!val) return "";
  const num = Number(val);
  if (!isNaN(num) && num >= 0 && num < 1) {
    const totalMinutes = Math.round(num * 24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const period = hours >= 12 ? "PM" : "AM";
    const h12 = hours % 12 || 12;
    return `${h12}:${String(minutes).padStart(2, "0")} ${period}`;
  }
  return String(val).trim();
}
```

Apply to the `time` field during parsing and convert back to 24h format (HH:MM) for DB storage.

---

## 11. Fixture Import — Interactive Error Correction (FixtureImport.tsx)

When a row has a "team not found" error:
- Render the unrecognized team name as a clickable link/button
- On click, show a Popover/Dialog listing all valid teams in the association (from `teamNameLookup`)
- On selection, show confirmation: "Change '[original]' to '[selected]'?" with Cancel and "Change All" buttons
- "Change All" replaces all instances of that name across all rows and re-validates

---

## 12. Sidebar — Requests Section for Admins

### New Page: `src/pages/admin/Requests.tsx`
- Fetch `primary_change_requests` with status `PENDING`, joined with profiles and teams
- Scope by admin level (Club Admin → their club only, Association Admin → their association, Super Admin → all)
- Display: player name, current primary team, requested team, date
- Accept button: set request `status = 'ADMIN_APPROVED'`, send notification to player
- Decline button: set request `status = 'DECLINED'`, send notification to player

### AppLayout.tsx Sidebar
- Add "Requests" nav item (with `ClipboardList` icon) to `super_admin`, `association`, and `club` nav sets
- Show badge with pending request count

### App.tsx
- Add route `/admin/requests` → `Requests` component

---

## Files Summary

| File | Change |
|------|--------|
| `.gitignore` | Add `.env` |
| `src/components/layout/AppLayout.tsx` | Dashboard active state, dropdown navigation, Requests nav item with badge |
| `src/contexts/TeamContext.tsx` | No changes needed (cascade reset already works) |
| `src/pages/admin/TeamsManagement.tsx` | Add team_type field, auto-fill name from club, always-editable name |
| `src/pages/admin/FixturesManagement.tsx` | Add fixture dialog, filter controls |
| `src/pages/admin/FixtureImport.tsx` | Fix time parsing, interactive error correction |
| `src/pages/admin/Requests.tsx` | **New** — admin requests page |
| `src/pages/Profile.tsx` | Wire primary team confirm flow |
| `src/App.tsx` | Add `/admin/requests` route |
| DB migration | Add `team_type` column to `teams` |

