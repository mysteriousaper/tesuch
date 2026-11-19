-- Import can not know every fact. "Registered on SRC" becomes tri-state: null = unknown (rules skip it).
-- Existing rows keep their stored value (false could be a real "no" or an old default; we cannot tell).
alter table public.contracts alter column src_registered drop not null;
alter table public.contracts alter column src_registered drop default;
