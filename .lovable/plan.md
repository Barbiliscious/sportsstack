

# Consolidated Implementation Plan

## Overview
Four groups of changes across header cascade visibility, profile editing UX, personal details layout, and team request flow.

---

## Step 1: Header Cascade Visibility

**File:** `src/components/layout/AppLayout.tsx`

Update selector rendering conditions so each only appears after its predecessor is selected:

- **Club selector** (line ~346): Add `selectedAssociationId &&` to the condition
- **Division selector** (line ~362): Change to `selectedClubId && filteredDivisions.length > 0`
- **Team selector** (line ~378): Change to `selectedClubId && (filteredDivisions.length === 0 || selectedDivision) && filteredTeams.length > 0`

No changes to `TeamContext.tsx` needed — cascade resets already work.

---

## Step 2: Personal Details — Cancel Button + Layout Reformat

### 2a. Update props and layout (`PersonalDetailsSection.tsx`)

- **Split `name` into `firstName` / `lastName`** in the `formData` interface
- **Add `onCancel` and `onSave` props** (replace `onEditToggle`)
- **Remove Hockey Victoria Number** from the rendered output
- **Reformat into 2-column grid** (`grid grid-cols-1 md:grid-cols-2 gap-4`):
  - Row 1: First Name | Last Name
  - Row 2: Email (read-only) | Phone
  - Row 3: Address (full width, `md:col-span-2`)
  - Row 4: Date of Birth | Gender
- **Header buttons**: Show "Edit" when not editing; show "Save" + "Cancel" when editing
- **Remove `PlayerProfile` import** — pass email as a direct string prop instead

### 2b. Update Profile.tsx to match

- Change `formData` shape: replace `name` with `firstName` and `lastName`
- On fetch, set `firstName` and `lastName` separately from profile data
- On save, send `first_name: formData.firstName`, `last_name: formData.lastName`
- Add `onCancel` handler: reset `formData` to stored profile values, set `isEditing = false`
- Store a `savedFormData` ref/snapshot when entering edit mode for cancel restoration
- Pass `onSave={handleSave}` and `onCancel={handleCancel}` instead of `onEditToggle`
- Pass `email={user?.email || ""}` as separate prop

---

## Step 3: Team Request Flow

### 3a. "Request Additional Team" button (`TeamMembershipSection.tsx`)

- Add a `+ Request Additional Team` button in the "Additional Teams" card header
- Add `onRequestAdditionalTeam` callback prop
- Wire it to open a new dialog

### 3b. New `RequestAdditionalTeamDialog.tsx`

- Dialog lets player search/select a team to join (fetches from `teams` table, excludes already-member teams)
- Optional association filter to narrow results
- On submit: inserts a `PENDING` row in `team_memberships` with `membership_type = PERMANENT`
- Inserts notifications for relevant club/association admins (queries `user_roles` for `CLUB_ADMIN` / `ASSOCIATION_ADMIN` matching the target team's club/association)

### 3c. One primary per association enforcement

- In `SetPrimaryTeamDialog.tsx`, group available teams by association
- Show which associations already have a primary team
- Block selecting a team in an association where a primary already exists (or route through change request)

### 3d. Admin notifications on requests (`Profile.tsx`)

- After creating a `primary_change_request`, query `user_roles` for relevant admins and insert notification rows
- Same pattern for additional team requests

---

## Files Summary

| File | Changes |
|------|---------|
| `src/components/layout/AppLayout.tsx` | Cascade visibility conditions for Club/Division/Team selectors |
| `src/components/profile/PersonalDetailsSection.tsx` | Split name fields, 2-col grid layout, cancel/save buttons, hide Hockey Vic number |
| `src/pages/Profile.tsx` | firstName/lastName in formData, cancel handler with snapshot restore, wire new props, admin notifications |
| `src/components/profile/TeamMembershipSection.tsx` | Add "Request Additional Team" button + prop |
| `src/components/profile/RequestAdditionalTeamDialog.tsx` | **New** — team search/request dialog with admin notifications |
| `src/components/profile/SetPrimaryTeamDialog.tsx` | Group by association, enforce one-primary-per-association |

