-- =====================================================================
-- TransitOps � All-in-One Supabase Schema
-- Run this entire script once in Supabase SQL Editor (Project > SQL Editor > New query)
-- Idempotent: safe to re-run (uses IF NOT EXISTS / DROP ... IF EXISTS patterns)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. EXTENSIONS
-- ---------------------------------------------------------------------
create extension if not exists "pgcrypto";  -- for gen_random_uuid()

-- ---------------------------------------------------------------------
-- 1. TABLES
-- ---------------------------------------------------------------------

-- Profiles: extends auth.users, holds role for RBAC
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('fleet_manager','driver','safety_officer','financial_analyst')),
  created_at timestamptz default now()
);

-- Vehicles
create table if not exists vehicles (
  id uuid primary key default gen_random_uuid(),
  registration_number text unique not null,
  name_model text not null,
  type text not null,
  max_load_capacity numeric not null check (max_load_capacity > 0),
  odometer numeric not null default 0 check (odometer >= 0),
  acquisition_cost numeric not null check (acquisition_cost >= 0),
  status text not null default 'AVAILABLE'
    check (status in ('AVAILABLE','ON_TRIP','IN_SHOP','RETIRED')),
  photo_url text,
  photo_public_id text,
  region text,
  revenue numeric not null default 0,  -- used for ROI calc in Reports
  created_at timestamptz default now()
);

-- Drivers
create table if not exists drivers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  license_number text unique not null,
  license_category text not null,
  license_expiry date not null,
  contact_number text,
  safety_score numeric not null default 100 check (safety_score between 0 and 100),
  status text not null default 'AVAILABLE'
    check (status in ('AVAILABLE','ON_TRIP','OFF_DUTY','SUSPENDED')),
  license_doc_url text,
  license_doc_public_id text,
  created_at timestamptz default now()
);

-- Trips
create table if not exists trips (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  destination text not null,
  vehicle_id uuid references vehicles(id) not null,
  driver_id uuid references drivers(id) not null,
  cargo_weight numeric not null check (cargo_weight > 0),
  planned_distance numeric,
  final_odometer numeric,
  fuel_consumed numeric,
  status text not null default 'DRAFT'
    check (status in ('DRAFT','DISPATCHED','COMPLETED','CANCELLED')),
  created_at timestamptz default now(),
  dispatched_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz
);

-- Maintenance Logs
create table if not exists maintenance_logs (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid references vehicles(id) not null,
  description text not null,
  cost numeric not null default 0 check (cost >= 0),
  status text not null default 'OPEN' check (status in ('OPEN','CLOSED')),
  receipt_url text,
  receipt_public_id text,
  opened_at timestamptz default now(),
  closed_at timestamptz
);

-- Fuel Logs
create table if not exists fuel_logs (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid references vehicles(id) not null,
  trip_id uuid references trips(id),
  liters numeric not null check (liters > 0),
  cost numeric not null check (cost >= 0),
  log_date date not null default current_date,
  receipt_url text,
  receipt_public_id text
);

-- Expenses (tolls, misc)
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid references vehicles(id) not null,
  category text not null check (category in ('toll','maintenance','other')),
  amount numeric not null check (amount >= 0),
  expense_date date not null default current_date,
  receipt_url text,
  receipt_public_id text
);

-- ---------------------------------------------------------------------
-- 2. INDEXES (frequently filtered columns)
-- ---------------------------------------------------------------------
create index if not exists idx_vehicles_status on vehicles(status);
create index if not exists idx_vehicles_type on vehicles(type);
create index if not exists idx_vehicles_region on vehicles(region);
create index if not exists idx_drivers_status on drivers(status);
create index if not exists idx_drivers_license_expiry on drivers(license_expiry);
create index if not exists idx_trips_status on trips(status);
create index if not exists idx_trips_vehicle_id on trips(vehicle_id);
create index if not exists idx_trips_driver_id on trips(driver_id);
create index if not exists idx_maintenance_vehicle_id on maintenance_logs(vehicle_id);
create index if not exists idx_maintenance_status on maintenance_logs(status);
create index if not exists idx_fuel_vehicle_id on fuel_logs(vehicle_id);
create index if not exists idx_expenses_vehicle_id on expenses(vehicle_id);

-- ---------------------------------------------------------------------
-- 3. AUTH � auto-create a profile row on signup
-- Frontend sign-up should pass role via auth metadata:
--   supabase.auth.signUp({ email, password, options: { data: { full_name, role } } })
-- ---------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger as $#$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Unnamed User'),
    coalesce(new.raw_user_meta_data->>'role', 'driver')
  );
  return new;
end;
$#$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table profiles enable row level security;
alter table vehicles enable row level security;
alter table drivers enable row level security;
alter table trips enable row level security;
alter table maintenance_logs enable row level security;
alter table fuel_logs enable row level security;
alter table expenses enable row level security;

-- Helper: current user's role (avoids repeating the subquery everywhere)
create or replace function current_role_name()
returns text as $#$
  select role from profiles where id = auth.uid();
$#$ language sql stable security definer;

-- profiles: users read their own row; everyone authenticated can read names/roles for display
drop policy if exists "profiles_select_all" on profiles;
create policy "profiles_select_all" on profiles
  for select using (auth.role() = 'authenticated');

drop policy if exists "profiles_update_own" on profiles;
create policy "profiles_update_own" on profiles
  for update using (id = auth.uid());

-- vehicles: everyone authenticated reads; only fleet_manager writes (non-status columns � see Section 6)
drop policy if exists "vehicles_select_all" on vehicles;
create policy "vehicles_select_all" on vehicles
  for select using (auth.role() = 'authenticated');

drop policy if exists "vehicles_write_fleet_manager" on vehicles;
create policy "vehicles_write_fleet_manager" on vehicles
  for all using (current_role_name() = 'fleet_manager')
  with check (current_role_name() = 'fleet_manager');

-- drivers: everyone authenticated reads; only safety_officer writes compliance fields (status locked, see Section 6)
drop policy if exists "drivers_select_all" on drivers;
create policy "drivers_select_all" on drivers
  for select using (auth.role() = 'authenticated');

drop policy if exists "drivers_write_safety_officer" on drivers;
create policy "drivers_write_safety_officer" on drivers
  for all using (current_role_name() = 'safety_officer')
  with check (current_role_name() = 'safety_officer');

-- trips: everyone authenticated reads; driver + fleet_manager can create Draft trips
-- (dispatch/complete/cancel status changes happen ONLY via RPCs below, not direct UPDATE)
drop policy if exists "trips_select_all" on trips;
create policy "trips_select_all" on trips
  for select using (auth.role() = 'authenticated');

drop policy if exists "trips_insert_driver_fleet_manager" on trips;
create policy "trips_insert_driver_fleet_manager" on trips
  for insert with check (current_role_name() in ('driver','fleet_manager'));

-- No direct UPDATE/DELETE policy on trips for any role � all status transitions go through
-- the security-definer RPC functions in Section 7, which bypass RLS internally.

-- maintenance_logs: everyone reads; fleet_manager writes (open/close also gated via RPC)
drop policy if exists "maintenance_select_all" on maintenance_logs;
create policy "maintenance_select_all" on maintenance_logs
  for select using (auth.role() = 'authenticated');

drop policy if exists "maintenance_insert_fleet_manager" on maintenance_logs;
create policy "maintenance_insert_fleet_manager" on maintenance_logs
  for insert with check (current_role_name() = 'fleet_manager');

-- fuel_logs: everyone reads; fleet_manager + driver can log fuel
drop policy if exists "fuel_select_all" on fuel_logs;
create policy "fuel_select_all" on fuel_logs
  for select using (auth.role() = 'authenticated');

drop policy if exists "fuel_insert_fleet_manager_driver" on fuel_logs;
create policy "fuel_insert_fleet_manager_driver" on fuel_logs
  for insert with check (current_role_name() in ('fleet_manager','driver'));

-- expenses: everyone reads; fleet_manager + financial_analyst can log expenses
drop policy if exists "expenses_select_all" on expenses;
create policy "expenses_select_all" on expenses
  for select using (auth.role() = 'authenticated');

drop policy if exists "expenses_insert_fleet_manager_financial" on expenses;
create policy "expenses_insert_fleet_manager_financial" on expenses
  for insert with check (current_role_name() in ('fleet_manager','financial_analyst'));

-- ---------------------------------------------------------------------
-- 5. GRANTS � baseline (RLS still applies on top of these)
-- ---------------------------------------------------------------------
grant select on profiles, vehicles, drivers, trips, maintenance_logs, fuel_logs, expenses to authenticated;
grant insert, update on profiles to authenticated;
grant insert, update, delete on vehicles to authenticated;
grant insert, update, delete on drivers to authenticated;
grant insert on trips to authenticated;
grant insert, update on maintenance_logs to authenticated;
grant insert on fuel_logs, expenses to authenticated;

-- ---------------------------------------------------------------------
-- 6. COLUMN-LEVEL LOCKDOWN � status can ONLY change via RPCs (Section 7)
-- Postgres GRANT/REVOKE operates at column level; RLS "with check" cannot
-- restrict individual columns, so we close this gap here.
-- security definer RPC functions run as the function owner and bypass this.
-- ---------------------------------------------------------------------
revoke update on vehicles from authenticated;
grant update (name_model, type, max_load_capacity, odometer, acquisition_cost, region, photo_url, photo_public_id, revenue)
  on vehicles to authenticated;

revoke update on drivers from authenticated;
grant update (name, license_category, license_expiry, contact_number, safety_score, license_doc_url, license_doc_public_id)
  on drivers to authenticated;
-- Note: safety_officer changing a driver's status to SUSPENDED is a legitimate compliance
-- action outside the trip lifecycle � if you need that, add a dedicated RPC
-- (e.g. suspend_driver(p_driver_id)) rather than reopening direct column access.

revoke update, delete on trips from authenticated;
-- trips.status/vehicle_id/driver_id/etc are only ever mutated by the RPCs below.

revoke update on maintenance_logs from authenticated;
grant update (description) on maintenance_logs to authenticated;
-- status/cost/closed_at on maintenance_logs are only ever mutated by close_maintenance() RPC.

-- ---------------------------------------------------------------------
-- 7. RPC FUNCTIONS � all state-changing business rules, atomic + row-locked
-- ---------------------------------------------------------------------

-- 7.1 Dispatch a trip
create or replace function dispatch_trip(p_trip_id uuid)
returns void as $#$
declare
  v_vehicle vehicles%rowtype;
  v_driver  drivers%rowtype;
  v_trip    trips%rowtype;
begin
  select * into v_trip from trips where id = p_trip_id for update;
  if not found then raise exception 'TRIP_NOT_FOUND'; end if;
  if v_trip.status != 'DRAFT' then raise exception 'TRIP_NOT_DRAFT'; end if;

  select * into v_vehicle from vehicles where id = v_trip.vehicle_id for update;
  if not found then raise exception 'VEHICLE_NOT_FOUND'; end if;

  select * into v_driver from drivers where id = v_trip.driver_id for update;
  if not found then raise exception 'DRIVER_NOT_FOUND'; end if;

  if v_vehicle.status != 'AVAILABLE' then raise exception 'VEHICLE_NOT_AVAILABLE'; end if;
  if v_driver.status  != 'AVAILABLE' then raise exception 'DRIVER_NOT_AVAILABLE';  end if;
  if v_driver.license_expiry < current_date then raise exception 'DRIVER_LICENSE_EXPIRED'; end if;
  if v_trip.cargo_weight > v_vehicle.max_load_capacity then raise exception 'CARGO_EXCEEDS_CAPACITY'; end if;

  update trips set status = 'DISPATCHED', dispatched_at = now() where id = p_trip_id;
  update vehicles set status = 'ON_TRIP' where id = v_vehicle.id;
  update drivers  set status = 'ON_TRIP' where id = v_driver.id;
end;
$#$ language plpgsql security definer;

-- 7.2 Complete a trip
create or replace function complete_trip(p_trip_id uuid, p_final_odometer numeric, p_fuel_consumed numeric)
returns void as $#$
declare v_trip trips%rowtype;
begin
  select * into v_trip from trips where id = p_trip_id for update;
  if not found then raise exception 'TRIP_NOT_FOUND'; end if;
  if v_trip.status != 'DISPATCHED' then raise exception 'TRIP_NOT_DISPATCHED'; end if;
  if p_final_odometer is null or p_final_odometer < 0 then raise exception 'INVALID_ODOMETER'; end if;

  update trips set status = 'COMPLETED', completed_at = now(),
         final_odometer = p_final_odometer, fuel_consumed = p_fuel_consumed
  where id = p_trip_id;

  update vehicles set status = 'AVAILABLE', odometer = p_final_odometer where id = v_trip.vehicle_id;
  update drivers  set status = 'AVAILABLE' where id = v_trip.driver_id;
end;
$#$ language plpgsql security definer;

-- 7.3 Cancel a dispatched trip
create or replace function cancel_trip(p_trip_id uuid)
returns void as $#$
declare v_trip trips%rowtype;
begin
  select * into v_trip from trips where id = p_trip_id for update;
  if not found then raise exception 'TRIP_NOT_FOUND'; end if;
  if v_trip.status not in ('DRAFT','DISPATCHED') then raise exception 'TRIP_NOT_CANCELLABLE'; end if;

  update trips set status = 'CANCELLED', cancelled_at = now() where id = p_trip_id;

  if v_trip.status = 'DISPATCHED' then
    update vehicles set status = 'AVAILABLE' where id = v_trip.vehicle_id;
    update drivers  set status = 'AVAILABLE' where id = v_trip.driver_id;
  end if;
end;
$#$ language plpgsql security definer;

-- 7.4 Open a maintenance record (locks the vehicle row � fixes race w/ dispatch_trip)
create or replace function open_maintenance(
  p_vehicle_id uuid, p_description text,
  p_receipt_url text default null, p_receipt_public_id text default null
)
returns uuid as $#$
declare
  v_id uuid;
  v_vehicle vehicles%rowtype;
begin
  select * into v_vehicle from vehicles where id = p_vehicle_id for update;
  if not found then raise exception 'VEHICLE_NOT_FOUND'; end if;
  if v_vehicle.status = 'ON_TRIP' then raise exception 'VEHICLE_ON_TRIP'; end if;
  if v_vehicle.status = 'RETIRED' then raise exception 'VEHICLE_RETIRED'; end if;

  insert into maintenance_logs (vehicle_id, description, receipt_url, receipt_public_id)
  values (p_vehicle_id, p_description, p_receipt_url, p_receipt_public_id)
  returning id into v_id;

  update vehicles set status = 'IN_SHOP' where id = p_vehicle_id;
  return v_id;
end;
$#$ language plpgsql security definer;

-- 7.5 Close a maintenance record (locks the vehicle row � fixes race w/ dispatch_trip)
create or replace function close_maintenance(p_log_id uuid, p_cost numeric)
returns void as $#$
declare
  v_log maintenance_logs%rowtype;
  v_vehicle vehicles%rowtype;
begin
  select * into v_log from maintenance_logs where id = p_log_id for update;
  if not found then raise exception 'MAINTENANCE_LOG_NOT_FOUND'; end if;
  if v_log.status != 'OPEN' then raise exception 'MAINTENANCE_ALREADY_CLOSED'; end if;
  if p_cost is null or p_cost < 0 then raise exception 'INVALID_COST'; end if;

  select * into v_vehicle from vehicles where id = v_log.vehicle_id for update;
  if not found then raise exception 'VEHICLE_NOT_FOUND'; end if;

  update maintenance_logs set status = 'CLOSED', cost = p_cost, closed_at = now() where id = p_log_id;

  update vehicles set status = 'AVAILABLE'
  where id = v_vehicle.id and status != 'RETIRED';
end;
$#$ language plpgsql security definer;

-- Grant execute on all RPCs to authenticated users (RLS/GRANT lockdown above forces this path)
grant execute on function dispatch_trip(uuid) to authenticated;
grant execute on function complete_trip(uuid, numeric, numeric) to authenticated;
grant execute on function cancel_trip(uuid) to authenticated;
grant execute on function open_maintenance(uuid, text, text, text) to authenticated;
grant execute on function close_maintenance(uuid, numeric) to authenticated;

-- ---------------------------------------------------------------------
-- 8. REPORTING VIEW � dashboard KPIs
-- ---------------------------------------------------------------------
create or replace view v_fleet_kpis as
select
  count(*) filter (where status != 'RETIRED')                as active_vehicles,
  count(*) filter (where status = 'AVAILABLE')                as available_vehicles,
  count(*) filter (where status = 'IN_SHOP')                  as vehicles_in_maintenance,
  (select count(*) from trips where status = 'DISPATCHED')    as active_trips,
  (select count(*) from trips where status = 'DRAFT')         as pending_trips,
  (select count(*) from drivers where status = 'ON_TRIP')     as drivers_on_duty,
  round(
    100.0 * count(*) filter (where status = 'ON_TRIP')
    / nullif(count(*) filter (where status != 'RETIRED'), 0), 1
  ) as fleet_utilization_pct
from vehicles;

grant select on v_fleet_kpis to authenticated;

-- Per-vehicle operational cost + ROI, used by Reports page
create or replace view v_vehicle_operational_cost as
select
  v.id as vehicle_id,
  v.registration_number,
  v.acquisition_cost,
  v.revenue,
  coalesce(f.total_fuel_cost, 0) as total_fuel_cost,
  coalesce(f.total_liters, 0) as total_liters,
  coalesce(m.total_maintenance_cost, 0) as total_maintenance_cost,
  coalesce(e.total_expense_cost, 0) as total_expense_cost,
  coalesce(f.total_fuel_cost, 0) + coalesce(m.total_maintenance_cost, 0) + coalesce(e.total_expense_cost, 0) as total_operational_cost,
  case when v.acquisition_cost > 0 then
    round((v.revenue - (coalesce(m.total_maintenance_cost,0) + coalesce(f.total_fuel_cost,0))) / v.acquisition_cost, 4)
  else null end as roi
from vehicles v
left join (
  select vehicle_id, sum(cost) as total_fuel_cost, sum(liters) as total_liters
  from fuel_logs group by vehicle_id
) f on f.vehicle_id = v.id
left join (
  select vehicle_id, sum(cost) as total_maintenance_cost
  from maintenance_logs where status = 'CLOSED' group by vehicle_id
) m on m.vehicle_id = v.id
left join (
  select vehicle_id, sum(amount) as total_expense_cost
  from expenses group by vehicle_id
) e on e.vehicle_id = v.id;

grant select on v_vehicle_operational_cost to authenticated;

-- ---------------------------------------------------------------------
-- 9. STORAGE BUCKETS � NOT NEEDED
-- File/image storage (vehicle photos, license scans, receipts) is handled by
-- Cloudinary, not Supabase Storage � no bucket creation required for the
-- documented architecture.
-- ---------------------------------------------------------------------
