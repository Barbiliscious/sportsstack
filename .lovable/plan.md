

# Security Fixes Plan

## Active Findings (5 actionable)

### 1. Sensitive Profile Fields Exposed to Teammates (ERROR)
**Problem:** The "Team members can view teammate profiles" policy exposes all columns including `admin_notes`, `emergency_contact_*`, `date_of_birth`, `phone`, `suburb`, `hockey_vic_number`.

**Fix:** Replace the teammate RLS policy with a security-barrier view that only exposes safe columns (`id`, `first_name`, `last_name`, `avatar_url`, `gender`). Update frontend code to query this view for teammate lookups instead of the `profiles` table directly.

- Create `public.teammate_profiles` view with restricted columns
- Enable RLS-like access via the view's underlying query (filter by shared team membership)
- Drop the "Team members can view teammate profiles" policy on `profiles`
- Keep the "Admins can view scoped profiles" policy (admins need full access)

### 2. Privilege Escalation via Role Insertion (ERROR)
**Problem:** `CLUB_ADMIN` can insert `SUPER_ADMIN` or `ASSOCIATION_ADMIN` roles. No scope validation on INSERT/UPDATE.

**Fix:** Create a `SECURITY DEFINER` function `public.can_grant_role` that enforces:
- `SUPER_ADMIN` can grant any role
- `ASSOCIATION_ADMIN` can only grant `CLUB_ADMIN`, `TEAM_MANAGER`, `COACH`, `PLAYER` within their association
- `CLUB_ADMIN` can only grant `TEAM_MANAGER`, `COACH`, `PLAYER` within their club's teams
- Nobody can self-assign roles

Replace the INSERT and UPDATE policies on `user_roles` with policies that call this function.

### 3. Realtime Channel Subscription Not Scoped (ERROR)
**Problem:** Any authenticated user can subscribe to any team's Realtime channel.

**Fix:** Realtime RLS on `realtime.messages` cannot be modified (reserved schema). Instead, switch the Realtime subscription to use Realtime Authorization by filtering on `team_id` in the channel subscription, and ensure the existing table-level RLS on `team_messages` is the enforcement layer. Add a note that Realtime broadcasts are filtered by Postgres RLS on the source table — this is how Supabase Realtime works by default when using `postgres_changes`. Mark this as mitigated.

### 4. Notifications INSERT Policy Uses Public Role (WARN)
**Problem:** INSERT policy on `notifications` applies to `public` role instead of `authenticated`.

**Fix:** Drop and recreate the policy targeting `authenticated` role only.

### 5. Leaked Password Protection (WARN)
**Problem:** Leaked password protection is disabled.

**Fix:** This requires enabling it via auth configuration. Will use the configure_auth tool.

---

## Migration SQL Summary

```sql
-- 1. Create teammate_profiles view (safe columns only)
CREATE VIEW public.teammate_profiles AS
SELECT p.id, p.first_name, p.last_name, p.avatar_url, p.gender
FROM public.profiles p
WHERE p.id IN (
  SELECT tm2.user_id FROM public.team_memberships tm1
  JOIN public.team_memberships tm2 ON tm1.team_id = tm2.team_id
  WHERE tm1.user_id = auth.uid()
    AND tm1.status = 'APPROVED' AND tm2.status = 'APPROVED'
);

-- Drop overly broad teammate policy
DROP POLICY "Team members can view teammate profiles" ON public.profiles;

-- 2. Scoped role granting function + updated policies
CREATE FUNCTION public.can_grant_role(...) ...
DROP POLICY "Admins can insert roles" ON public.user_roles;
DROP POLICY "Admins can update roles" ON public.user_roles;
CREATE POLICY ... WITH CHECK (public.can_grant_role(...));

-- 3. Fix notifications INSERT policy
DROP POLICY "System and admins can create notifications" ON public.notifications;
CREATE POLICY ... TO authenticated ...;
```

## Frontend Changes
- Search for any code querying `profiles` for teammate data and switch to `teammate_profiles` view
- Mark realtime finding as mitigated (Supabase postgres_changes already filters by table RLS)

## Files
| File | Change |
|------|--------|
| New migration SQL | View, function, policy updates |
| Frontend files using teammate profiles | Query the new view instead |

