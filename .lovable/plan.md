

# Week 1 Implementation — Security & Quick Wins

## Steps to Build (in order)

### Step 1: Fix `create-player` invite emails (CRITICAL)
- In `supabase/functions/create-player/index.ts`, replace `auth.admin.createUser` with `auth.admin.inviteUserByEmail`
- Remove temp password generation
- Player receives email link to set their own password

### Step 2: Fix `bulk-import` invite emails (CRITICAL)
- Same change in `supabase/functions/bulk-import/index.ts`
- Remove mock email generation — block rows with no email instead
- Return skipped rows in the error response

### Step 3: Dark mode toggle
- Wire `next-themes` ThemeProvider in `main.tsx`
- Add toggle button to sidebar/header
- Ensure Tailwind dark class strategy is set

### Step 4: Club branding in player UI
- Fetch club's `primary_colour`, `logo_url` etc. via team context
- Apply to dashboard header, sidebar team name, and team pages

### Step 5: Notification preferences
- DB migration: `notification_preferences` table (user_id, channel, category, enabled)
- Add preferences section to Profile page with toggles

### Step 6: Player status field
- DB migration: add `status` (Active/Inactive/Suspended) and `admin_notes` to profiles
- Update Users Management table to show/edit status

### Step 7: `is_player` flag on team_memberships
- DB migration: add `is_player` boolean (default false)
- When true, coach/manager appears in lineup player selection list

## Technical Notes
- Steps 1-2 are the highest priority — current flow creates accounts with random passwords players never see
- `inviteUserByEmail` sends a magic link; the user sets their password on first visit
- Steps 3-7 are independent of each other and can be built in any order after 1-2

