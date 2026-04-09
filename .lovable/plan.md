

# Fix Cascade Bar Bugs

## Root Cause

All three bugs stem from the same underlying issue: **Radix UI Select treats `value={undefined}` as "uncontrolled"**, so it retains its last displayed value internally even after the parent state clears it to `""`.

In the current code, `value={selectedClubId || undefined}` converts empty string to `undefined`, which tells Radix "I'm not controlling you anymore" — so the old text stays visible.

Additionally, the Dashboard button in the association popover doesn't clear the association selection.

## Fix (two files, minimal changes)

### 1. `src/components/layout/AppLayout.tsx`

**Club/Division/Team Selects — add `key` props to force remount when parent changes:**
- Club Select: add `key={selectedAssociationId}` — remounts when association changes, wiping internal state
- Division Select: add `key={selectedClubId}` — remounts when club changes
- Team Select: add `key={selectedClubId + selectedDivision}` — remounts when club or division changes

**Dashboard button in association popover — clear all selections:**
- Call `setSelectedAssociationId("")` before navigating (this triggers `handleAssociationChange("")` in TeamContext which clears club, division, team too)

### 2. No changes to `TeamContext.tsx`
The cascade clearing logic there is already correct (`handleAssociationChange` clears all children, etc.). The bug is purely in the UI component not reflecting the cleared state.

## Files Changed
| File | Change |
|------|--------|
| `src/components/layout/AppLayout.tsx` | Add `key` props to 3 Select components; clear association on Dashboard click |

