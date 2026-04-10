

# Bulk Import Improvements — 4 Fixes

## Fix 1 — Fixture Import UI consistency

Update `FixtureImport.tsx` to match `BulkImport.tsx` layout:
- Same `max-w-7xl mx-auto` container
- Same card structure with `CardTitle className="text-lg"` headers
- Same helper text block beneath upload area with three `<p>` lines: supported formats, date format hints, inline correction note
- Same badge styling in preview header (already matches — minor tweaks to description text)
- Add `max-w-sm` wrapper on Association scope content (already present but ensure consistency)

## Fix 2 — Fixture template reference sheet

In `FixtureImport.tsx`, update the inline `onClick` for "Download Template" to:
- Create a second sheet "Allowed Values" with columns: **Status** (`scheduled`), **Home Team / Away Team** (dynamically from `teamNameLookup` keys, capitalized)
- Use the same `aoa_to_sheet` pattern as `BulkImport.tsx`: headers in row 1, values below
- Scope teams to cascade selection (Fix 3 determines which teams are shown)

## Fix 3 — Cascade selector on both import pages

**Shared approach for both pages:**

Add state for `selectedClubId`, `selectedDivision`, `selectedTeamId` alongside existing `selectedAssociationId`. Replace the single Association dropdown in the Import Scope card with a 4-column grid: Association, Club, Division, Team.

Each level filters the next:
- Clubs filtered by selected association + admin scope
- Divisions derived from teams within selected club + scope
- Teams filtered by club + division + scope

Selecting a parent clears all children. Non-super-admins only see entities within their scoped IDs.

**Scope enforcement (validation):**
- In `BulkImport.tsx` `validateRows`: after resolving `team_id`, check that the resolved team/club/association falls within the cascade selection. If not, add an error like "Row outside selected scope (expected Club: X)".
- In `FixtureImport.tsx` `validate`: after resolving `team_id`, check it matches the cascade. Reject rows whose resolved team is outside scope.

**Template pre-fill:**
- `BulkImport.tsx`: In `downloadTemplate`, after headers row, add a second row with the selected association name, club name, division, and team name in their respective columns. Other cells empty.
- `FixtureImport.tsx`: Pre-fill `home_team` with the selected team name (if one is selected) and `competition` with the selected division.

**Allowed Values scoping:**
- Club list: if association selected, only clubs in that association. If club selected, only that club.
- Division list: if club selected, only divisions in that club's teams. If division selected, only that one.
- Team list: filtered by club + division selection.

**BulkImport.tsx specific changes:**
- Add `selectedClubId`, `selectedDivision`, `selectedTeamId` state
- Build filtered lists using existing `assocClubs` and `assocTeams` patterns
- Replace single Association dropdown with 4-column cascade grid
- Update `validateRows` to enforce scope boundaries
- Update `downloadTemplate` to pre-fill row 2 and scope the Allowed Values sheet

**FixtureImport.tsx specific changes:**
- Add `selectedClubId`, `selectedDivision`, `selectedTeamId` state
- Build filtered club/division/team lists from `clubs` and `teams` (from TeamContext)
- Replace single Association dropdown with 4-column cascade grid
- Update `validate` to enforce scope boundaries
- Update template download handler to pre-fill and scope reference sheet

## Fix 4 — Duplicate user detection warning

In `UsersManagement.tsx`:

**Duplicate detection logic** (after `filteredUsers` is computed):
- Build a `Map<string, string[]>` keyed by `(first_name + last_name).toLowerCase()` → array of user IDs
- Any key with 2+ entries marks those user IDs as duplicates
- Store in a `useMemo`-derived `Set<string>` of duplicate user IDs

**UI changes:**
- In the table Name cell: if user ID is in duplicates set, render an `AlertTriangle` icon (amber) with a tooltip "Possible duplicate account"
- Import `AlertTriangle` from lucide (already imported) and `Tooltip/TooltipTrigger/TooltipContent/TooltipProvider` from UI components
- Add `"duplicates"` option to status filter dropdown: `<SelectItem value="duplicates">Duplicates</SelectItem>`
- In `filteredUsers` logic: when `statusFilter === "duplicates"`, filter to only users in the duplicates set

## Files changed

| File | Fixes |
|------|-------|
| `src/pages/admin/BulkImport.tsx` | Fix 3 (cascade selector, scope enforcement, template pre-fill, scoped allowed values) |
| `src/pages/admin/FixtureImport.tsx` | Fix 1 (UI consistency), Fix 2 (reference sheet), Fix 3 (cascade selector, scope enforcement, template pre-fill) |
| `src/pages/admin/UsersManagement.tsx` | Fix 4 (duplicate detection warning + filter) |

No database migrations or edge function changes needed.

