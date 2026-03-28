
ALTER TABLE public.categories
ADD COLUMN parent_id uuid REFERENCES public.categories(id) ON DELETE CASCADE DEFAULT NULL;
