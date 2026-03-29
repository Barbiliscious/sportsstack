

# Header Restructure & Profile Settings Migration

## What Changes

### 1. Header bar — left side reorder
Current: Hamburger → Association logo → Club selector → Team selector → Mode badge
New: **Hamburger → Association logo → Club selector → Division selector (new) → Team selector**

Remove the mode badge from the header (mode switcher stays in sidebar).

### 2. Add Division selector between Club and Team
Derive unique `division` values from `teams` rows filtered by `club_id`. Add `selectedDivision`, `setSelectedDivision`, and `filteredDivisions` to `TeamContext`. Filter `filteredTeams` by both `club_id` AND `division` when a division is selected.

### 3. Header bar — right side cleanup
Current: ThemeToggle → Bell → generic User icon circle
New: **Bell → User avatar** (with actual `avatar_url` from profiles, linking always to `/profile`)

Remove `ThemeToggle` from header. Change `PROFILE_DEST` for all modes to `/profile`.

### 4. Fetch user avatar for header
Add a small `useEffect` in `AppLayout` (or extend `AuthContext`) to fetch the current user's `profiles.avatar_url` and display it in the header avatar. Show initials as fallback.

### 5. Move Theme Toggle to Profile page
Add a "Preferences" or "Settings" card on `/profile` containing:
- Dark/Light mode toggle (restyled as a labeled row, not icon button)
- Notification preferences (already there)

### Files to Modify

| File | Change |
|------|--------|
| `src/contexts/TeamContext.tsx` | Add `selectedDivision`, `setSelectedDivision`, `filteredDivisions` derived from teams of selected club |
| `src/components/layout/AppLayout.tsx` | Remove ThemeToggle import, remove mode badge, add division Select, fetch avatar_url, update PROFILE_DEST to always `/profile`, show real avatar |
| `src/pages/Profile.tsx` | Add "Preferences" section with inline theme toggle |
| `src/components/ThemeToggle.tsx` | Restyle as a labeled switch row for use in profile settings |

### Division Filtering Logic
No new DB table needed (that's Week 2). Derive unique `division` strings from `teams` where `club_id` matches selected club. When a division is selected, `filteredTeams` filters by both `club_id` and `division`. Changing club resets division. Changing association resets club and division.

