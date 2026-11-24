-- Two Art. 84(1) mandatory contract items we can check: the position/functions (item 6) and the basic pay or how it is set (item 7).
-- Tri-state: null = not known (rule skipped), true = the contract states it, false = it is missing.
alter table public.contracts
  add column position_stated boolean,
  add column pay_stated boolean;
