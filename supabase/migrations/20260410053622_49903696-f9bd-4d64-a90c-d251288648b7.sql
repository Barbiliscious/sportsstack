
-- 1. Create venues table
CREATE TABLE public.venues (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  address text,
  suburb text,
  state text,
  postcode text,
  phone text,
  email text,
  notes text,
  available_times text,
  association_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view venues"
  ON public.venues FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can manage venues"
  ON public.venues FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'SUPER_ADMIN'::app_role)
    OR has_role(auth.uid(), 'ASSOCIATION_ADMIN'::app_role)
    OR has_role(auth.uid(), 'CLUB_ADMIN'::app_role)
  );

-- 2. Create pitches table
CREATE TABLE public.pitches (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  venue_id uuid NOT NULL,
  name text NOT NULL,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.pitches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view pitches"
  ON public.pitches FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can manage pitches"
  ON public.pitches FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'SUPER_ADMIN'::app_role)
    OR has_role(auth.uid(), 'ASSOCIATION_ADMIN'::app_role)
    OR has_role(auth.uid(), 'CLUB_ADMIN'::app_role)
  );

-- 3. Add home_venue_id to teams
ALTER TABLE public.teams ADD COLUMN home_venue_id uuid;

-- 4. Add columns to games
ALTER TABLE public.games ADD COLUMN host_club_id uuid;
ALTER TABLE public.games ADD COLUMN venue_id uuid;
ALTER TABLE public.games ADD COLUMN pitch_id uuid;
ALTER TABLE public.games ADD COLUMN umpire_club_1_id uuid;
ALTER TABLE public.games ADD COLUMN umpire_club_2_id uuid;
ALTER TABLE public.games ADD COLUMN special_round_name text;
ALTER TABLE public.games ADD COLUMN is_bye boolean NOT NULL DEFAULT false;
ALTER TABLE public.games ADD COLUMN bye_team_id uuid;
