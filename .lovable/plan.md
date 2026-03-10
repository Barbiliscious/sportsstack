

# Updated Plan: Bulk Import Fields + Export + Navigation Buttons

Three related changes to the Users Management and Bulk Import system.

---

## 1. Add Bulk Import & Export buttons to Users Management page

**File: `src/pages/admin/UsersManagement.tsx`**
- Add two buttons next to the existing "Add Player" button:
  - **Bulk Import** (FileSpreadsheet icon) — navigates to `/admin/bulk-import`
  - **Export** (Download icon) — exports `filteredUsers` to XLSX
- Export function uses the already-installed `xlsx` library
- Export columns: Registration # (sequential 1, 2, 3…), First Name, Last Name, Email, Gender, DOB, Hockey Vic Number, Phone, Suburb, Club, Team, Division, Membership Status, Emergency Contact Name, Emergency Contact Phone, Emergency Contact Relationship
- Club and Division resolved from the existing `teams`/`clubs` reference data already loaded in the component
- Requires expanding `fetchUsers` to also select emergency contact fields from profiles (currently uses `select("*")` so they're already fetched)
- Filename: `players-export-YYYY-MM-DD.xlsx`

## 2. Expand Bulk Import to include all profile fields

**File: `src/pages/admin/BulkImport.tsx`**
- Add to `ParsedRow` interface: `emergency_contact_name`, `emergency_contact_phone`, `emergency_contact_relationship`
- Add header mappings: "Emergency Contact Name" / "EC Name", "Emergency Contact Phone" / "EC Phone", "Emergency Contact Relationship" / "EC Relationship"
- Update the expected columns documentation text
- Pass new fields through in `handleSubmit` payload

**File: `supabase/functions/bulk-import/index.ts`**
- Add `emergency_contact_name`, `emergency_contact_phone`, `emergency_contact_relationship` to `PlayerRow` interface
- Include these fields in the `profiles.update()` call (lines 172-180)

## 3. Update plan.md

Mark the export and bulk import enhancements as done.

---

### Files changed

| File | Change |
|------|--------|
| `src/pages/admin/UsersManagement.tsx` | Add Bulk Import + Export buttons, export function |
| `src/pages/admin/BulkImport.tsx` | Add emergency contact fields to parsing and payload |
| `supabase/functions/bulk-import/index.ts` | Add emergency contact fields to PlayerRow and profile update |
| `.lovable/plan.md` | Update status |

