

# Consolidated Implementation Plan — COMPLETED

## ✅ Step 1: Header Cascade Visibility
- Club selector only shows when association is selected
- Division selector only shows when club is selected and divisions exist
- Team selector only shows when club is selected AND (no divisions exist OR a division is selected)
- Removed unused `showDivisionSelector` / `showTeamSelector` flags

## ✅ Step 2: Personal Details — Cancel Button + Layout Reformat
- Split `name` into `firstName` / `lastName` fields
- 2-column grid layout: First/Last Name, Email/Phone, Address (full width), DOB/Gender
- Cancel + Save buttons when editing; Edit button when not
- Hidden Hockey Victoria Number field
- `savedFormData` snapshot for cancel restoration

## ✅ Step 3: Team Request Flow
- "Request Team" button added to Additional Teams card header
- New `RequestAdditionalTeamDialog` with cascading Association → Club → Team selection
- Inserts PENDING team_membership and notifies club/association admins
- `SetPrimaryTeamDialog` unchanged (one-primary-per-association enforcement pending)

## Remaining / Future
- One-primary-per-association enforcement in SetPrimaryTeamDialog (group by association, block duplicates)
- Admin notification on primary change requests
