-- New players start with 1,000 chips (was 10,000)
alter table public.profiles alter column chip_balance set default 1000;
