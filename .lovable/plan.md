

# Venues Management Page (with View-Only Badge)

Build the full Venues management page and integrate it into routing/sidebar, plus update TeamsManagement with a Home Venue dropdown. Incorporates the "View only" badge for CLUB_ADMIN users and the delete safety check from prior discussions.

## Files to create/modify

### 1. New: `src/pages/admin/VenuesManagement.tsx`
- `max-w-7xl mx-auto` layout matching other admin pages
- Title "Venues" + subtitle "Manage grounds and pitches"
- **View-only badge**: Next to the title, show a `<Badge variant="secondary">View only</Badge>` when the user is CLUB_ADMIN (not SUPER_ADMIN or ASSOCIATION_ADMIN). Uses `useAdminScope` to determine role.
- "Add Venue" button top-right (hidden for view-only users)
- Table: Name, Suburb, Association, Pitches (count), Actions (edit/delete — hidden for view-only)
- Add/Edit dialog: Name (required), Address, Suburb, State, Postcode, Phone, Email, Association dropdown (scoped), Available Times textarea, Notes textarea
- Inline expandable pitches panel per row: list pitch name + notes; add/rename/delete controls (hidden for view-only)
- **Delete safety check**: On delete, query pitches count and teams using this venue as home_venue_id. If dependencies exist, show AlertDialog listing affected items. On confirm: delete pitches → clear home_venue_id on teams → delete venue.
- ASSOCIATION_ADMIN scoped to venues matching their association IDs

### 2. Update: `src/App.tsx`
- Import and add route `/admin/venues` → `VenuesManagement`

### 3. Update: `src/components/layout/AppLayout.tsx`
- Add "Venues" nav item with `MapPin` icon after Fixtures in super_admin and association nav sets

### 4. Update: `src/pages/admin/TeamsManagement.tsx`
- Fetch venues, add Home Venue dropdown to edit/add dialog, save `home_venue_id`

