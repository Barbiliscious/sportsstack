

# Database Schema Update — Venues, Pitches, and Game/Team Columns

## New Tables

### `venues`
- `id` uuid PK default `gen_random_uuid()`
- `name` text NOT NULL
- `address` text
- `suburb` text
- `state` text
- `postcode` text
- `phone` text
- `email` text
- `notes` text
- `available_times` text
- `association_id` uuid nullable
- `created_at` timestamptz default `now()`

RLS (matching `clubs`/`associations` pattern):
- SELECT: public, `true` (anyone can view)
- ALL: authenticated admins (`SUPER_ADMIN`, `ASSOCIATION_ADMIN`, `CLUB_ADMIN`)

### `pitches`
- `id` uuid PK default `gen_random_uuid()`
- `venue_id` uuid NOT NULL
- `name` text NOT NULL
- `notes` text
- `created_at` timestamptz default `now()`

RLS (same pattern):
- SELECT: public, `true`
- ALL: authenticated admins (`SUPER_ADMIN`, `ASSOCIATION_ADMIN`, `CLUB_ADMIN`)

### `teams` — add column
- `home_venue_id` uuid nullable

### `games` — add columns
- `host_club_id` uuid nullable
- `venue_id` uuid nullable
- `pitch_id` uuid nullable
- `umpire_club_1_id` uuid nullable
- `umpire_club_2_id` uuid nullable
- `special_round_name` text nullable
- `is_bye` boolean default false
- `bye_team_id` uuid nullable

## Migration

Single migration with:
1. CREATE TABLE venues + enable RLS + 2 policies
2. CREATE TABLE pitches + enable RLS + 2 policies
3. ALTER TABLE teams ADD home_venue_id
4. ALTER TABLE games ADD 8 new columns

No FK constraints (matching existing project pattern of no foreign keys). No UI changes.

