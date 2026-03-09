
## Grampians Hockey — Implementation Plan

### Phase 1: 5-Mode App System ✅ COMPLETE

The app supports 5 operational modes (Super Admin, Association, Club, Team, Player) with role-based navigation, mode switching, and localStorage persistence. See `AppModeContext.tsx`.

### Phase 2: Data & Import (Current)

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Sunraysia Hockey Association setup | ✅ Done | SHA + Koowinda, Wanderers, Riverside, Waratahs (6 teams each) |
| 2 | Team nicknames column | ✅ Done | `nickname` column added to `teams` table |
| 3 | Bulk player import | 🔲 Todo | Edge function + admin UI to import players from XLSX |
| 4 | Bulk fixture import | 🔲 Todo | Resolve club+division to team_id, insert into `games` |
| 5 | Player exceptions / compliance | 🔲 Todo | `player_exceptions` table, age checks, missing data flags |

### Phase 3: Competition Features

| # | Item | Status | Notes |
|---|------|--------|-------|
| 6 | Seasons + standings | 🔲 Todo | `seasons` table, `season_id` on games, ladder page |
| 7 | Player statistics | 🔲 Todo | `player_game_stats` table, goals/cards/BOG, leaderboard |

### Phase 4: Polish & UX

| # | Item | Status | Notes |
|---|------|--------|-------|
| 8 | Club branding in player UI | 🔲 Todo | Wire `primary_colour`, `logo_url` etc. into dashboards |
| 9 | Dark mode toggle | 🔲 Todo | `next-themes` already installed, needs wiring |
| 10 | Audit log | 🔲 Todo | `audit_log` table for admin action tracking |

### Database Structure

- **Associations**: Hockey Ballarat, Wimmera Hockey Association, Sunraysia Hockey Association
- **Clubs per association**: 4-6 clubs each, with 6 standard teams per club
- **Team divisions**: Division 1 Open, Division 1 Women, Under 11, Under 12, Under 14, Under 16
- **Roles**: SUPER_ADMIN, ASSOCIATION_ADMIN, CLUB_ADMIN, TEAM_MANAGER, COACH, PLAYER
