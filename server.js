-- ============================================================
-- CIVIX part 18: WhatsApp-style incoming calls
--  * Phones that can show the ringing call screen by themselves (CIVIX closed) say so here.
--  * When the caller hangs up before you answer, your phone stops ringing at once.
--  * Off switch: update public.app_config set value = '{"full": false}' where key = 'call_push';
-- Paste into Supabase -> SQL Editor -> Run. Safe to run more than once.
-- ============================================================

alter table public.push_tokens add column if not exists full_call boolean not null default false;

-- The app tells us "this phone can show the full call screen"
create or replace function public.set_full_call(push_token text, can boolean)
returns void language sql security definer set search_path = public as $$
  update public.push_tokens set full_call = coalesce(can, false)
   where token = push_token and user_id = auth.uid();
$$;
revoke execute on function public.set_full_call(text, boolean) from public, anon;
grant execute on function public.set_full_call(text, boolean) to authenticated;

-- Caller hung up / nobody answered: which phones should stop ringing (only the caller can ask)
create or replace function public.push_call_end(call_id uuid)
returns table (token text, ref uuid)
language sql stable security definer set search_path = public as $$
  select t.token, c.id
    from public.calls c
    join public.push_tokens t on t.user_id = c.callee_id and t.full_call
   where c.id = call_id
     and c.caller_id = auth.uid()
     and c.status in ('missed', 'ended', 'declined')
     and c.created_at > now() - interval '10 minutes';
$$;
revoke execute on function public.push_call_end(uuid) from public, anon;
grant execute on function public.push_call_end(uuid) to authenticated;

-- On / off switch for the new call style (no app update needed)
insert into public.app_config(key, value) values ('call_push', '{"full": true}')
on conflict (key) do nothing;
