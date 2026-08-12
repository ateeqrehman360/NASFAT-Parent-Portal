-- Preserve each subject's marking scale alongside the earned mark.
-- For example, a parent can see 35/40 rather than an ambiguous 35.

begin;

alter table public.exam_results
  add column if not exists quran_max_score numeric,
  add column if not exists islamic_studies_max_score numeric,
  add column if not exists arabic_max_score numeric;

alter table public.exam_results
  drop constraint if exists exam_results_max_scores_are_valid;

alter table public.exam_results
  add constraint exam_results_max_scores_are_valid check (
    (quran_max_score is null or quran_max_score > 0)
    and (islamic_studies_max_score is null or islamic_studies_max_score > 0)
    and (arabic_max_score is null or arabic_max_score > 0)
    and (quran_score is null or quran_max_score is null or quran_score <= quran_max_score)
    and (islamic_studies_score is null or islamic_studies_max_score is null or islamic_studies_score <= islamic_studies_max_score)
    and (arabic_score is null or arabic_max_score is null or arabic_score <= arabic_max_score)
  );

commit;
