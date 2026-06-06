-- Allow contractors to edit add-on names and prices from the dashboard.
drop policy if exists "Allow authenticated update on addons" on public.contractor_addons;
create policy "Allow authenticated update on addons"
  on public.contractor_addons
  for update
  using (
    exists (
      select 1 from public.contractor_settings
      where id = contractor_id and user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.contractor_settings
      where id = contractor_id and user_id = auth.uid()
    )
  );
