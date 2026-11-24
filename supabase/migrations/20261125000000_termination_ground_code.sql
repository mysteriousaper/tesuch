-- Legal ground code for a termination (Labour Code Art. 113(1) points 1-13, or 93(1) for probation).
-- Makes the notice-period rule ground-aware. Optional: null = not recorded.
alter table public.contracts
  add column termination_ground_code text
  check (termination_ground_code is null or termination_ground_code in (
    '113(1)(1)','113(1)(2)','113(1)(3)','113(1)(4)','113(1)(5)','113(1)(6)','113(1)(7)',
    '113(1)(8)','113(1)(9)','113(1)(10)','113(1)(11)','113(1)(12)','113(1)(13)','93(1)'));
