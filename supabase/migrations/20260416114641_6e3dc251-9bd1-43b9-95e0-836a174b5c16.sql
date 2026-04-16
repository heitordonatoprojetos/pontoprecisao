
-- Punches table
CREATE TABLE public.punches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  timestamp BIGINT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('in', 'out')),
  date TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.punches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own punches" ON public.punches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own punches" ON public.punches FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own punches" ON public.punches FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own punches" ON public.punches FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_punches_user_date ON public.punches (user_id, date);

-- Adjustments table
CREATE TABLE public.adjustments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  minutes INTEGER NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own adjustments" ON public.adjustments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own adjustments" ON public.adjustments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own adjustments" ON public.adjustments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own adjustments" ON public.adjustments FOR DELETE USING (auth.uid() = user_id);

-- User settings table
CREATE TABLE public.user_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_hours INTEGER NOT NULL DEFAULT 480,
  work_days INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}',
  default_punches TEXT[] NOT NULL DEFAULT '{"08:00","12:00","13:00","17:00"}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings" ON public.user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own settings" ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON public.user_settings FOR UPDATE USING (auth.uid() = user_id);

-- Update trigger for settings
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_user_settings_updated_at
BEFORE UPDATE ON public.user_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
