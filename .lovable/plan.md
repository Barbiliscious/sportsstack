

# Update Plan & Next Steps

## Plan Update

Add the following to Phase 2 as a new item between the current items 2 and 3:

| # | Item | Status | Notes |
|---|------|--------|-------|
| 3 | Admin Add Player form | 🔲 Todo | Scoped entry form with gender, HV number, team assignment. Edge function `create-player`. New profile columns. |

This bumps the existing items 3-5 to become 4-6. The `ScopedTeamSelector` component built here will be reused by bulk player import (item 4) and fixture import/export (item 5).

## Immediate Next Steps (Implementation Order)

### Step A: Database Migration
Add `gender` and `hockey_vic_number` columns to `profiles`. No RLS changes needed -- existing policies cover all columns on the row.

### Step B: Edge Function `create-player`
- Validates caller's JWT and checks their scoped roles against the target team
- Uses `SUPABASE_SERVICE_ROLE_KEY` (already configured) to call `auth.admin.createUser()`
- Updates profile with all fields (name, DOB, gender, HV number, phone, suburb, emergency contact)
- Inserts `team_membership` (status: APPROVED) and `user_role` (PLAYER, scoped to team)
- Scope enforcement: queries `user_roles` for the caller and verifies they can manage the target team (same logic as `useAdminScope` but server-side)

### Step C: `ScopedTeamSelector` Component
Reusable cascading Association > Club > Team dropdowns that auto-lock based on `useAdminScope()`:
- **Super Admin**: all selectors open
- **Association Admin**: association locked, clubs/teams filtered
- **Club Admin**: association + club locked, only their teams shown
- **Team Manager/Coach**: all three locked to their team(s)

### Step D: `AddPlayer` Admin Page
Full form at `/admin/add-player` with sections: Team Assignment (ScopedTeamSelector), Personal Details, Registration, Emergency Contact. Success redirects to Users Management with toast.

### Step E: Profile Page Updates
Add gender and Hockey Victoria number fields to `PersonalDetailsSection.tsx` and `Profile.tsx` so players can view/edit their own data.

## Files Affected

| File | Action |
|------|--------|
| `.lovable/plan.md` | Update with new item |
| DB migration | Add `gender`, `hockey_vic_number` to profiles |
| `supabase/functions/create-player/index.ts` | New edge function |
| `src/components/admin/ScopedTeamSelector.tsx` | New reusable component |
| `src/pages/admin/AddPlayer.tsx` | New admin page |
| `src/pages/admin/UsersManagement.tsx` | Add "Add Player" button |
| `src/components/profile/PersonalDetailsSection.tsx` | Add new fields |
| `src/pages/Profile.tsx` | Include new fields in state/save |
| `src/App.tsx` | Add `/admin/add-player` route |

## What This Unlocks

Once the Add Player form and `ScopedTeamSelector` are built:
- **Bulk Player Import** (next item) reuses `ScopedTeamSelector` and the same `create-player` edge function pattern
- **Fixture Import/Export** reuses `ScopedTeamSelector` for scoped filtering
- **Player Exceptions** can run against the newly imported player data

