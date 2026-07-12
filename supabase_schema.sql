-- ====================================================================================
-- SECTION 5: DATABASE SCHEMA
-- ====================================================================================

-- Profiles (extends Supabase auth.users, holds role for RBAC)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('fleet_manager','driver','safety_officer','financial_analyst')),
  created_at timestamptz default now()
);

-- Vehicles
create table vehicles (
  id uuid primary key default gen_random_uuid(),
  registration_number text unique not null,
  name_model text not null,
  type text not null,
  max_load_capacity numeric not null,
  odometer numeric default 0,
  acquisition_cost numeric not null,
  status text not null default 'AVAILABLE'
    check (status in ('AVAILABLE','ON_TRIP','IN_SHOP','RETIRED')),
  photo_url text,          -- Cloudinary secure_url
  photo_public_id text,    -- Cloudinary public_id (for deletion/transforms)
  region text,
  created_at timestamptz default now()
);

-- Drivers
create table drivers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  license_number text unique not null,
  license_category text not null,
  license_expiry date not null,
  contact_number text,
  safety_score numeric default 100,
  status text not null default 'AVAILABLE'
    check (status in ('AVAILABLE','ON_TRIP','OFF_DUTY','SUSPENDED')),
  license_doc_url text,        -- Cloudinary secure_url
  license_doc_public_id text,
  created_at timestamptz default now()
);

-- Trips
create table trips (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  destination text not null,
  vehicle_id uuid references vehicles(id),
  driver_id uuid references drivers(id),
  cargo_weight numeric not null,
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
create table maintenance_logs (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid references vehicles(id) not null,
  description text not null,
  cost numeric default 0,
  status text not null default 'OPEN' check (status in ('OPEN','CLOSED')),
  receipt_url text,          -- Cloudinary secure_url
  receipt_public_id text,
  opened_at timestamptz default now(),
  closed_at timestamptz
);

-- Fuel Logs
create table fuel_logs (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid references vehicles(id) not null,
  trip_id uuid references trips(id),
  liters numeric not null,
  cost numeric not null,
  log_date date default current_date,
  receipt_url text,
  receipt_public_id text
);

-- Expenses (tolls, misc)
create table expenses (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid references vehicles(id) not null,
  category text not null,           -- 'toll' | 'maintenance' | 'other'
  amount numeric not null,
  expense_date date default current_date,
  receipt_url text,
  receipt_public_id text
);

-- ====================================================================================
-- SECTION 6: ROW LEVEL SECURITY (RLS)
-- ====================================================================================

alter table profiles enable row level security;
alter table vehicles enable row level security;
alter table drivers enable row level security;
alter table trips enable row level security;
alter table maintenance_logs enable row level security;
alter table fuel_logs enable row level security;
alter table expenses enable row level security;

-- Read Access: Everyone authenticated can read (dashboard needs cross-role visibility)
create policy "read_all_authenticated_profiles" on profiles for select using (auth.role() = 'authenticated');
create policy "read_all_authenticated_vehicles" on vehicles for select using (auth.role() = 'authenticated');
create policy "read_all_authenticated_drivers" on drivers for select using (auth.role() = 'authenticated');
create policy "read_all_authenticated_trips" on trips for select using (auth.role() = 'authenticated');
create policy "read_all_authenticated_maintenance" on maintenance_logs for select using (auth.role() = 'authenticated');
create policy "read_all_authenticated_fuel" on fuel_logs for select using (auth.role() = 'authenticated');
create policy "read_all_authenticated_expenses" on expenses for select using (auth.role() = 'authenticated');

-- Profiles Write (Self)
create policy "users_insert_own_profile" on profiles for insert with check (auth.uid() = id);
create policy "users_update_own_profile" on profiles for update using (auth.uid() = id);

-- Fleet Manager Write Policies
create policy "fleet_manager_write_vehicles" on vehicles
  for all using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'fleet_manager'));
  
create policy "fleet_manager_write_maintenance" on maintenance_logs
  for all using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'fleet_manager'));

create policy "fleet_manager_write_fuel" on fuel_logs
  for all using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'fleet_manager'));

create policy "fleet_manager_write_expenses" on expenses
  for all using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'fleet_manager'));

-- Safety Officer Write Policies
create policy "safety_officer_write_drivers" on drivers
  for all using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'safety_officer'));

-- Trip Creation (Driver + Fleet Manager)
create policy "create_trips" on trips
  for insert using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('driver','fleet_manager')));

create policy "update_trips" on trips
  for update using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('driver','fleet_manager')));


-- ====================================================================================
-- SECTION 7: RPC FUNCTIONS
-- ====================================================================================

-- Dispatch a trip
create or replace function dispatch_trip(p_trip_id uuid)
returns void as $$
declare
  v_vehicle vehicles%rowtype;
  v_driver  drivers%rowtype;
  v_trip    trips%rowtype;
begin
  select * into v_trip from trips where id = p_trip_id for update;
  select * into v_vehicle from vehicles where id = v_trip.vehicle_id for update;
  select * into v_driver  from drivers  where id = v_trip.driver_id  for update;

  if v_vehicle.status != 'AVAILABLE' then raise exception 'VEHICLE_NOT_AVAILABLE'; end if;
  if v_driver.status  != 'AVAILABLE' then raise exception 'DRIVER_NOT_AVAILABLE';  end if;
  if v_driver.license_expiry < current_date then raise exception 'DRIVER_LICENSE_EXPIRED'; end if;
  if v_trip.cargo_weight > v_vehicle.max_load_capacity then raise exception 'CARGO_EXCEEDS_CAPACITY'; end if;

  update trips    set status = 'DISPATCHED', dispatched_at = now() where id = p_trip_id;
  update vehicles set status = 'ON_TRIP' where id = v_vehicle.id;
  update drivers  set status = 'ON_TRIP' where id = v_driver.id;
end;
$$ language plpgsql security definer;

-- Complete a trip
create or replace function complete_trip(p_trip_id uuid, p_final_odometer numeric, p_fuel_consumed numeric)
returns void as $$
declare v_trip trips%rowtype;
begin
  select * into v_trip from trips where id = p_trip_id for update;
  if v_trip.status != 'DISPATCHED' then raise exception 'TRIP_NOT_DISPATCHED'; end if;

  update trips set status='COMPLETED', completed_at=now(),
         final_odometer=p_final_odometer, fuel_consumed=p_fuel_consumed
  where id = p_trip_id;

  update vehicles set status='AVAILABLE', odometer=p_final_odometer where id = v_trip.vehicle_id;
  update drivers  set status='AVAILABLE' where id = v_trip.driver_id;
end;
$$ language plpgsql security definer;

-- Cancel a dispatched trip
create or replace function cancel_trip(p_trip_id uuid)
returns void as $$
declare v_trip trips%rowtype;
begin
  select * into v_trip from trips where id = p_trip_id for update;
  if v_trip.status != 'DISPATCHED' then raise exception 'TRIP_NOT_DISPATCHED'; end if;

  update trips set status='CANCELLED', cancelled_at=now() where id = p_trip_id;
  update vehicles set status='AVAILABLE' where id = v_trip.vehicle_id;
  update drivers  set status='AVAILABLE' where id = v_trip.driver_id;
end;
$$ language plpgsql security definer;

-- Open a maintenance record
create or replace function open_maintenance(p_vehicle_id uuid, p_description text, p_receipt_url text default null, p_receipt_public_id text default null)
returns uuid as $$
declare v_id uuid;
begin
  insert into maintenance_logs (vehicle_id, description, receipt_url, receipt_public_id)
  values (p_vehicle_id, p_description, p_receipt_url, p_receipt_public_id)
  returning id into v_id;

  update vehicles set status='IN_SHOP' where id = p_vehicle_id and status != 'RETIRED';
  return v_id;
end;
$$ language plpgsql security definer;

-- Close a maintenance record
create or replace function close_maintenance(p_log_id uuid, p_cost numeric)
returns void as $$
declare v_vehicle_id uuid;
begin
  update maintenance_logs set status='CLOSED', cost=p_cost, closed_at=now()
  where id = p_log_id
  returning vehicle_id into v_vehicle_id;

  update vehicles set status='AVAILABLE'
  where id = v_vehicle_id and status != 'RETIRED';
end;
$$ language plpgsql security definer;
