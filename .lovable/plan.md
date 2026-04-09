

# Entity Dashboards: Association, Club, and Team

## Overview

Create three new dashboard pages — one each for Association, Club, and Team — accessible via URL params. Each shows a consistent layout: announcements feed placeholder, upcoming fixtures, and key stats (games played, goals scored, standings). Content is scoped to that specific entity.

## Routes

| Route | Page |
|-------|------|
| `/associations/:id` | Association Dashboard |
| `/clubs/:id` | Club Dashboard |
| `/teams/:id` | Team Dashboard |

All three sit inside the existing `ProtectedRoute` + `AppLayout` wrapper (any authenticated user can access them; data visibility is controlled by RLS on the underlying tables which already allow public SELECT on associations, clubs, teams, and games have team-member SELECT).

## Access Control

No new RLS needed. Associations, clubs, and teams already have public SELECT. Games are visible to team members + admins. The dashboards query public entity data and aggregate game stats — all readable by authenticated users within their hierarchy. The announcements section will be a placeholder (no `posts` table exists yet).

## Shared Layout Component

Create `src/components/entity/EntityDashboard.tsx` — a reusable layout component that receives:
- `entityName: string` (e.g. "Hockey Ballarat")
- `entityType: "association" | "club" | "team"`
- `logoUrl?: string`
- `stats: { gamesPlayed, goalsScored }`
- `upcomingGames: Game[]`

Layout (single column, responsive):
1. **Header** — Entity name + logo + type badge
2. **Stats row** — 3 cards: Games Played, Total Goals, Ladder Position (placeholder "—" until standings table is populated)
3. **Announcements** — Card with "No announcements yet" placeholder (ready for a future `posts` table)
4. **Upcoming Fixtures** — List of next 5 games with date, opponent, location, home/away badge

## Page Files

### `src/pages/AssociationDashboard.tsx`
- Reads `:id` from URL params
- Fetches association record
- Fetches all clubs → all teams for that association → all games for those teams
- Aggregates stats (games played = games with status "completed", goals = sum of home_score + away_score)
- Passes data to `EntityDashboard`

### `src/pages/ClubDashboard.tsx`
- Reads `:id` from URL params
- Fetches club record (with association name)
- Fetches all teams for that club → all games for those teams
- Aggregates stats
- Passes data to `EntityDashboard`

### `src/pages/TeamDashboard.tsx`
- Reads `:id` from URL params
- Fetches team record (with club name)
- Fetches games for that team
- Aggregates stats
- Passes data to `EntityDashboard`

## Navigation Entry Points

### Admin list pages (add clickable row links)
- `AssociationsManagement.tsx` — association name in table becomes a `<Link to={/associations/${id}}>` 
- `ClubsManagement.tsx` — club name becomes a `<Link to={/clubs/${id}}>`
- `TeamsManagement.tsx` — team name becomes a `<Link to={/teams/${id}}>`

These are minimal changes: wrap the name cell text in a Link with styling. No other changes to these pages.

### Cascade bar
The user mentioned "clicking the final selected item opens its dashboard." This requires adding click handlers to the cascade display labels. However, the user also said "Do not change the cascade bar behaviour." I will add navigation links only on the **entity name display** (the selected value text), not change any dropdown/select behaviour.

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/components/entity/EntityDashboard.tsx` | **Create** — shared dashboard layout |
| `src/pages/AssociationDashboard.tsx` | **Create** |
| `src/pages/ClubDashboard.tsx` | **Create** |
| `src/pages/TeamDashboard.tsx` | **Create** |
| `src/App.tsx` | **Edit** — add 3 routes |
| `src/pages/admin/AssociationsManagement.tsx` | **Edit** — wrap name cell in Link |
| `src/pages/admin/ClubsManagement.tsx` | **Edit** — wrap name cell in Link |
| `src/pages/admin/TeamsManagement.tsx` | **Edit** — wrap name cell in Link |

No database migrations needed. No new RLS policies needed.

