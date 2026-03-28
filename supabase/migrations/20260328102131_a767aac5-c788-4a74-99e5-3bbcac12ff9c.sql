
-- Add round_number to games
ALTER TABLE public.games ADD COLUMN round_number integer;

-- Create seasons table
CREATE TABLE public.seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  association_id uuid NOT NULL REFERENCES public.associations(id),
  start_date date,
  end_date date,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view seasons" ON public.seasons
  FOR SELECT TO public USING (true);

CREATE POLICY "Admins can manage seasons" ON public.seasons
  FOR ALL TO authenticated USING (
    public.has_role(auth.uid(), 'SUPER_ADMIN') OR
    public.has_role(auth.uid(), 'ASSOCIATION_ADMIN')
  );

-- Add season_id FK to games
ALTER TABLE public.games ADD COLUMN season_id uuid REFERENCES public.seasons(id);

-- Add updated_at trigger to seasons
CREATE TRIGGER update_seasons_updated_at
  BEFORE UPDATE ON public.seasons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
