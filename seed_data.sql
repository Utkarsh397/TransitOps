-- =====================================================================
-- TransitOps Demo Seed Data
-- Run this AFTER the schema script in Supabase SQL Editor
-- Populates all 7 tables with realistic Indian transit fleet data
-- =====================================================================

-- 1. VEHICLES (8 vehicles across regions)
insert into vehicles (id, registration_number, name_model, type, max_load_capacity, odometer, acquisition_cost, status, region, revenue) values
  ('a1000000-0000-0000-0000-000000000001', 'MH-12-AB-1234', 'Tata Prima 4928.S',     'Truck',   28000, 124500, 2800000, 'AVAILABLE', 'Maharashtra', 1850000),
  ('a1000000-0000-0000-0000-000000000002', 'KA-01-CD-5678', 'Ashok Leyland 3520',     'Truck',   20000,  98200, 2200000, 'AVAILABLE', 'Karnataka',   1420000),
  ('a1000000-0000-0000-0000-000000000003', 'DL-05-EF-9012', 'BharatBenz 1617R',       'Truck',   16000,  67800, 1900000, 'ON_TRIP',   'Delhi NCR',   1100000),
  ('a1000000-0000-0000-0000-000000000004', 'GJ-06-GH-3456', 'Eicher Pro 6049',        'Truck',   25000,  45600, 2500000, 'AVAILABLE', 'Gujarat',      920000),
  ('a1000000-0000-0000-0000-000000000005', 'TN-09-IJ-7890', 'Tata 407 Gold SFC',      'Mini',     3500,  32100,  850000, 'ON_TRIP',   'Tamil Nadu',   680000),
  ('a1000000-0000-0000-0000-000000000006', 'RJ-14-KL-2345', 'Mahindra Blazo X 46',    'Truck',   31000, 156000, 3100000, 'IN_SHOP',   'Rajasthan',   2200000),
  ('a1000000-0000-0000-0000-000000000007', 'UP-32-MN-6789', 'Force Traveller 3350',   'Van',      1500,  21400, 1200000, 'AVAILABLE', 'Uttar Pradesh', 340000),
  ('a1000000-0000-0000-0000-000000000008', 'AP-28-OP-0123', 'Tata Signa 4825.TK',     'Truck',   28000,  88700, 2950000, 'RETIRED',   'Andhra Pradesh', 3100000);

-- 2. DRIVERS (6 drivers)
insert into drivers (id, name, license_number, license_category, license_expiry, contact_number, safety_score, status) values
  ('b1000000-0000-0000-0000-000000000001', 'Rajesh Kumar',     'MH-DL-2020-114523', 'HMV', '2027-11-30', '+91 98765 43210', 95, 'AVAILABLE'),
  ('b1000000-0000-0000-0000-000000000002', 'Suresh Patel',     'GJ-DL-2019-228714', 'HMV', '2026-08-15', '+91 87654 32109', 88, 'ON_TRIP'),
  ('b1000000-0000-0000-0000-000000000003', 'Vikram Singh',     'DL-DL-2021-337891', 'HMV', '2028-03-20', '+91 76543 21098', 92, 'ON_TRIP'),
  ('b1000000-0000-0000-0000-000000000004', 'Anil Sharma',      'RJ-DL-2018-445612', 'HMV', '2026-12-01', '+91 65432 10987', 78, 'AVAILABLE'),
  ('b1000000-0000-0000-0000-000000000005', 'Deepak Yadav',     'KA-DL-2022-556789', 'LMV', '2029-06-10', '+91 54321 09876', 97, 'AVAILABLE'),
  ('b1000000-0000-0000-0000-000000000006', 'Mohammed Farooq',  'TN-DL-2020-667234', 'HMV', '2027-01-25', '+91 43210 98765', 83, 'OFF_DUTY');

-- 3. TRIPS (10 trips in various states)
insert into trips (id, source, destination, vehicle_id, driver_id, cargo_weight, planned_distance, final_odometer, fuel_consumed, status, created_at, dispatched_at, completed_at) values
  ('c1000000-0000-0000-0000-000000000001', 'Mumbai',     'Pune',        'a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 18000, 150,  124650, 45,  'COMPLETED',  now() - interval '30 days', now() - interval '30 days', now() - interval '29 days'),
  ('c1000000-0000-0000-0000-000000000002', 'Bengaluru',  'Chennai',     'a1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000005', 12000, 350,   98550, 110, 'COMPLETED',  now() - interval '25 days', now() - interval '25 days', now() - interval '24 days'),
  ('c1000000-0000-0000-0000-000000000003', 'Delhi',      'Jaipur',      'a1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000004', 22000, 280,   45880, 85,  'COMPLETED',  now() - interval '20 days', now() - interval '20 days', now() - interval '19 days'),
  ('c1000000-0000-0000-0000-000000000004', 'Ahmedabad',  'Surat',       'a1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000001', 15000, 265,   45865, 78,  'COMPLETED',  now() - interval '15 days', now() - interval '15 days', now() - interval '14 days'),
  ('c1000000-0000-0000-0000-000000000005', 'Delhi',      'Lucknow',     'a1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000003', 14000, 550, null, null, 'DISPATCHED', now() - interval '1 day',  now() - interval '1 day',  null),
  ('c1000000-0000-0000-0000-000000000006', 'Coimbatore', 'Madurai',     'a1000000-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000002',  2500, 220, null, null, 'DISPATCHED', now() - interval '6 hours', now() - interval '6 hours', null),
  ('c1000000-0000-0000-0000-000000000007', 'Jaipur',     'Udaipur',     'a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 20000, 400, null, null, 'DRAFT',      now() - interval '2 hours', null, null),
  ('c1000000-0000-0000-0000-000000000008', 'Bengaluru',  'Hyderabad',   'a1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000005', 10000, 570, null, null, 'DRAFT',      now() - interval '1 hour',  null, null),
  ('c1000000-0000-0000-0000-000000000009', 'Pune',       'Nagpur',      'a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000004', 25000, 720, null, null, 'CANCELLED',  now() - interval '10 days', null, null),
  ('c1000000-0000-0000-0000-000000000010', 'Jodhpur',    'Jaisalmer',   'a1000000-0000-0000-0000-000000000006', 'b1000000-0000-0000-0000-000000000004', 28000, 290, 156290, 95, 'COMPLETED', now() - interval '45 days', now() - interval '45 days', now() - interval '44 days');

-- 4. MAINTENANCE LOGS (5 records)
insert into maintenance_logs (id, vehicle_id, description, cost, status, opened_at, closed_at) values
  ('d1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Engine oil change + air filter replacement',        4500,  'CLOSED', now() - interval '60 days', now() - interval '59 days'),
  ('d1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002', 'Brake pad replacement - all 6 wheels',              12000, 'CLOSED', now() - interval '40 days', now() - interval '38 days'),
  ('d1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000006', 'Turbocharger rebuild + exhaust system repair',       45000, 'OPEN',   now() - interval '3 days',  null),
  ('d1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000005', 'Clutch plate and pressure plate replacement',        8500,  'CLOSED', now() - interval '90 days', now() - interval '88 days'),
  ('d1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000008', 'Full engine overhaul before retirement assessment', 120000, 'CLOSED', now() - interval '100 days', now() - interval '92 days');

-- 5. FUEL LOGS (12 records)
insert into fuel_logs (vehicle_id, trip_id, liters, cost, log_date) values
  ('a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 45,   4275, current_date - 30),
  ('a1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000002', 110, 10450, current_date - 25),
  ('a1000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000003', 85,   8075, current_date - 20),
  ('a1000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000004', 78,   7410, current_date - 15),
  ('a1000000-0000-0000-0000-000000000006', 'c1000000-0000-0000-0000-000000000010', 95,   9025, current_date - 45),
  ('a1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000005', 60,   5700, current_date - 1),
  ('a1000000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000006', 25,   2375, current_date),
  ('a1000000-0000-0000-0000-000000000001', null, 50,   4750, current_date - 10),
  ('a1000000-0000-0000-0000-000000000002', null, 65,   6175, current_date - 8),
  ('a1000000-0000-0000-0000-000000000007', null, 20,   1900, current_date - 5),
  ('a1000000-0000-0000-0000-000000000003', null, 55,   5225, current_date - 12),
  ('a1000000-0000-0000-0000-000000000004', null, 70,   6650, current_date - 3);

-- 6. EXPENSES (10 records)
insert into expenses (vehicle_id, category, amount, expense_date) values
  ('a1000000-0000-0000-0000-000000000001', 'toll',         850,   current_date - 30),
  ('a1000000-0000-0000-0000-000000000001', 'toll',         650,   current_date - 10),
  ('a1000000-0000-0000-0000-000000000002', 'toll',        1200,   current_date - 25),
  ('a1000000-0000-0000-0000-000000000003', 'toll',         450,   current_date - 1),
  ('a1000000-0000-0000-0000-000000000004', 'toll',         950,   current_date - 20),
  ('a1000000-0000-0000-0000-000000000004', 'toll',         750,   current_date - 15),
  ('a1000000-0000-0000-0000-000000000006', 'maintenance', 3500,   current_date - 50),
  ('a1000000-0000-0000-0000-000000000005', 'other',        200,   current_date - 7),
  ('a1000000-0000-0000-0000-000000000007', 'other',        350,   current_date - 4),
  ('a1000000-0000-0000-0000-000000000008', 'maintenance', 8000,   current_date - 95);

-- DONE! v_fleet_kpis will automatically reflect these numbers.
