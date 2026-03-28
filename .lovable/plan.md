

# Fixture Export + Round Numbers + Season Foundation

## Overview

Three related changes bundled together: XLSX fixture export (team page + admin bulk), round number display on game cards, and a seasons table with filter dropdown. The seasons table is a prerequisite for the season filter and lays groundwork for Phase 3 standings.

---

## 1. Database Migration

Add two columns to `games` and create a `seasons` table:

```sql
-- Add round_number to games
ALTER TABLE games ADD COLUMN round_number integer;

-- Create seasons table
CREATE TABLE seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  association_id uuid NOT NULL,
  start_date date,
  end_date date,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;

-- Anyone can view seasons
CREATE POLICY "Anyone can view seasons" ON seasons
  FOR SELECT TO public USING (true);

-- Admins can manage seasons
CREATE POLICY "Admins can manage seasons" ON seasons
  FOR ALL TO authenticated USING (
    has_role(auth.uid(), 'SUPER_ADMIN') OR
    has_role(auth.uid(), 'ASSOCIATION_ADMIN')
  );

-- Add season_id FK to games
ALTER TABLE games ADD COLUMN season_id uuid REFERENCES seasons(id);
```

---

## 2. Fixture Export on Games Page

**File: `src/pages/Games.tsx`**

- Add a `Download` button in the header (next to list/calendar toggles)
- Export handler builds XLSX with columns: Round, Date, Day, Time, Home/Away, Opponent, Location, Status, Home Score, Away Score, Notes
- Uses the `xlsx` library (already installed)
- File named `fixtures-{teamName}-{YYYY-MM-DD}.xlsx`
- Button disabled when no games exist
- Toast on success

---

## 3. Admin Bulk Fixture Export

**New file: `src/pages/admin/FixturesManagement.tsx`**

- Admin page at `/admin/fixtures` with scoped team selector
- Fetches all games for selected scope (association/club/team)
- Export button generates XLSX with an extra "Team" column
- Add route and nav link in `AppLayout.tsx` for admin modes

---

## 4. Round Number on Game Cards

**File: `src/pages/Games.tsx`**

- Show `Rd {round_number}` badge on `GameCard` when `round_number` is present
- Positioned alongside the Home/Away badge

---

## 5. Season Filter Dropdown

**File: `src/pages/Games.tsx`**

- Fetch seasons for the current team's association
- Add a `Select` dropdown in the header to filter by season
- Default to "All" or the active season if one exists
- Filter games query by `season_id` when selected

---

## 6. Update Plan

Mark Item 6 (Fixture Export) as done. Note round_number and seasons table as complete prerequisites for Items 5 and 8.

---

## Files Changed

| File | Change |
|------|--------|
| Migration SQL | `seasons` table, `round_number` + `season_id` on `games` |
| `src/pages/Games.tsx` | Export button, round badge, season filter |
| `src/pages/admin/FixturesManagement.tsx` | New admin fixtures page with bulk export |
| `src/components/layout/AppLayout.tsx` | Add Fixtures nav item for admin modes |
| `src/App.tsx` | Add `/admin/fixtures` route |
| `.lovable/plan.md` | Update statuses |

