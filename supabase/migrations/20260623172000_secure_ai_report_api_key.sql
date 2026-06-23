drop policy if exists "Allow public ai report settings read" on public.ai_report_settings;

revoke select on public.ai_report_settings from anon;
revoke select on public.ai_report_settings from authenticated;

drop function if exists public.get_ai_report_settings();

create or replace function public.get_ai_report_settings(
  p_passcode text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if encode(extensions.digest(coalesce(p_passcode, ''), 'sha256'), 'hex') <> '9f6f14d121cead2d652a430d125365e55d9658ffee24c5c8d768c763060c86a4' then
    raise exception 'Passcode incorrect.' using errcode = '28000';
  end if;

  return coalesce(
    (select config from public.ai_report_settings where id = 'default'),
    '{}'::jsonb
  );
end;
$$;

revoke all on function public.get_ai_report_settings(text) from public;
grant execute on function public.get_ai_report_settings(text) to anon;
grant execute on function public.get_ai_report_settings(text) to authenticated;
