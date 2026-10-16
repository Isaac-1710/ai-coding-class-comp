create extension if not exists pgcrypto;

create table public.families (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users (id) on delete cascade,
  state_code text,
  grading_scale jsonb not null default '{"a":90,"b":80,"c":70,"d":60}'::jsonb,
  created_at timestamptz not null default now(),
  constraint families_state_code_valid check (
    state_code is null or state_code in (
      'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
      'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
      'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
      'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
      'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'
    )
  )
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  grade_level smallint not null check (grade_level between 9 and 12),
  graduation_year smallint check (graduation_year between 2025 and 2100),
  created_at timestamptz not null default now(),
  unique (id, family_id)
);

create table public.requirements (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  required_credits numeric(5,2) not null check (required_credits >= 0 and required_credits <= 100),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (id, student_id)
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  requirement_id uuid,
  title text not null check (char_length(title) between 1 and 100),
  credits numeric(4,2) not null check (credits > 0 and credits <= 10),
  status text not null check (status in ('planned', 'in_progress', 'completed')),
  grade_percent numeric(5,2) check (grade_percent between 0 and 100),
  school_year text not null check (char_length(school_year) between 4 and 20),
  created_at timestamptz not null default now(),
  foreign key (requirement_id, student_id)
    references public.requirements (id, student_id)
    on delete set null (requirement_id)
);

create index students_family_id_idx on public.students (family_id);
create index requirements_student_id_idx on public.requirements (student_id, sort_order);
create index courses_student_id_idx on public.courses (student_id);

alter table public.families enable row level security;
alter table public.students enable row level security;
alter table public.requirements enable row level security;
alter table public.courses enable row level security;

create policy "Family owners manage their family"
on public.families
for all
to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy "Family owners manage their students"
on public.students
for all
to authenticated
using (
  exists (
    select 1
    from public.families
    where families.id = students.family_id
      and families.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.families
    where families.id = students.family_id
      and families.owner_id = (select auth.uid())
  )
);

create policy "Family owners manage student requirements"
on public.requirements
for all
to authenticated
using (
  exists (
    select 1
    from public.students
    join public.families on families.id = students.family_id
    where students.id = requirements.student_id
      and families.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.students
    join public.families on families.id = students.family_id
    where students.id = requirements.student_id
      and families.owner_id = (select auth.uid())
  )
);

create policy "Family owners manage student courses"
on public.courses
for all
to authenticated
using (
  exists (
    select 1
    from public.students
    join public.families on families.id = students.family_id
    where students.id = courses.student_id
      and families.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.students
    join public.families on families.id = students.family_id
    where students.id = courses.student_id
      and families.owner_id = (select auth.uid())
  )
);

create function public.create_family_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.families (owner_id)
  values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created_create_family
after insert on auth.users
for each row execute function public.create_family_for_new_user();
