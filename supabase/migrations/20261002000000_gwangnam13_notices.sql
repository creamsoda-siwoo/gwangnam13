-- 광남중 1-13 알림장(공지·숙제·준비물)
-- 누구나 읽을 수 있고, 글쓰기·지우기는 비밀번호를 아는 사람만 할 수 있다.
-- 비밀번호는 이 파일에 넣지 않는다. 적용한 뒤 아래처럼 따로 한 번 설정한다.
--   insert into gwangnam13_private.settings (password_hash)
--   values (extensions.crypt('비밀번호', extensions.gen_salt('bf')))
--   on conflict (id) do update set password_hash = excluded.password_hash;
create extension if not exists pgcrypto with schema extensions;

create table public.gwangnam13_notices (
  id bigint generated always as identity primary key,
  kind text not null default '공지' check (kind in ('공지', '숙제', '준비물')),
  content text not null check (char_length(content) between 1 and 500),
  due_date date,
  created_at timestamptz not null default now()
);
alter table public.gwangnam13_notices enable row level security;
create policy "누구나 알림장 보기" on public.gwangnam13_notices for select to anon, authenticated using (true);
grant select on public.gwangnam13_notices to anon, authenticated;

-- 비밀번호 해시는 API로 노출되지 않는 스키마에 둔다.
create schema if not exists gwangnam13_private;
revoke all on schema gwangnam13_private from public, anon, authenticated;
create table gwangnam13_private.settings (
  id int primary key default 1 check (id = 1),
  password_hash text not null
);

create function public.gwangnam13_add_notice(p_password text, p_kind text, p_content text, p_due date default null)
returns public.gwangnam13_notices
language plpgsql security definer set search_path = ''
as $$
declare r public.gwangnam13_notices;
begin
  if not exists (select 1 from gwangnam13_private.settings s
                 where s.password_hash = extensions.crypt(p_password, s.password_hash)) then
    raise exception '비밀번호가 틀렸어요' using errcode = '28P01';
  end if;
  insert into public.gwangnam13_notices (kind, content, due_date)
  values (coalesce(p_kind, '공지'), trim(p_content), p_due) returning * into r;
  return r;
end $$;

create function public.gwangnam13_delete_notice(p_password text, p_id bigint)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from gwangnam13_private.settings s
                 where s.password_hash = extensions.crypt(p_password, s.password_hash)) then
    raise exception '비밀번호가 틀렸어요' using errcode = '28P01';
  end if;
  delete from public.gwangnam13_notices where id = p_id;
end $$;

revoke all on function public.gwangnam13_add_notice(text, text, text, date) from public;
revoke all on function public.gwangnam13_delete_notice(text, bigint) from public;
grant execute on function public.gwangnam13_add_notice(text, text, text, date) to anon, authenticated;
grant execute on function public.gwangnam13_delete_notice(text, bigint) to anon, authenticated;
