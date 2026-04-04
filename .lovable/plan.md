

# Super Admin: Assign Users to Association, Club, Team

## Problem
The current "Roles" dialog only toggles role checkboxes. When a Super Admin assigns a role like `ASSOCIATION_ADMIN`, the scope fields (`association_id`, `club_id`, `team_id`) are either left null or defaulted to the admin's own scope — which doesn't work for Super Admins who need to assign users to any entity.

Additionally, there's no way to directly assign a user to a team membership from the Users Management page.

## Solution

### 1. Enhance the Role Management Dialog (`UsersManagement.tsx`)

When a role is checked, show a scope selector below it:
- **ASSOCIATION_ADMIN** → show Association dropdown
- **CLUB_ADMIN** → show Club dropdown (filtered by selected association)
- **TEAM_MANAGER / COACH** → show Association → Club → Team cascade dropdowns
- **PLAYER / SUPER_ADMIN** → no scope needed

The dialog will track scope per role: `Map<AppRole, { association_id?, club_id?, team_id? }>`.

On save, each role insert includes the selected scope IDs.

### 2. Add "Assign to Team" Action (`UsersManagement.tsx`)

Add a second action button per user row: "Assign Team" (or include it in the existing Roles dialog as a separate section).

Better approach: add a **Team Assignment section** inside the existing Roles dialog below the role checkboxes. This section shows:
- Current team memberships (read-only list)
- "Add to Team" button that reveals the `ScopedTeamSelector` + membership type (PRIMARY/PERMANENT/FILL_IN) dropdown
- Submit adds a `team_memberships` record

### Files to Change

| File | Change |
|------|--------|
| `src/pages/admin/UsersManagement.tsx` | Expand role dialog with scope selectors per role + team assignment section |

### Technical Detail

Role dialog state changes from `selectedRoles: AppRole[]` to:
```typescript
interface RoleWithScope {
  role: AppRole;
  association_id: string | null;
  club_id: string | null;
  team_id: string | null;
}
selectedRoleScopes: RoleWithScope[]
```

When saving, diff against current roles (fetched with scope) and insert/delete accordingly. The `can_grant_role` DB function already validates scope, so the RLS will enforce correctness.

For team assignment, use a simple insert into `team_memberships` with `status: 'APPROVED'` (since an admin is doing it).

