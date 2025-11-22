-- Supabase Database Setup Script
-- Run this in your Supabase SQL Editor to enable multi-device sync

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  permission TEXT NOT NULL,
  district TEXT,
  full_name TEXT,
  service_center TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create raw_data table
CREATE TABLE IF NOT EXISTS raw_data (
  id TEXT PRIMARY KEY,
  account_number TEXT NOT NULL,
  angaza_id TEXT,
  group_name TEXT,
  owner_name TEXT,
  product_name TEXT NOT NULL,
  product_type TEXT,
  product_description TEXT,
  registration_date TEXT,
  district TEXT,
  imported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create maintenance_cases table
CREATE TABLE IF NOT EXISTS maintenance_cases (
  id TEXT PRIMARY KEY,
  account_number TEXT NOT NULL,
  angaza_id TEXT,
  date_reported_at_source TIMESTAMP WITH TIME ZONE NOT NULL,
  date_received_at_sc TIMESTAMP WITH TIME ZONE NOT NULL,
  registration_date TEXT,
  end_date TEXT,
  pickup_date TIMESTAMP WITH TIME ZONE,
  delivery_date TIMESTAMP WITH TIME ZONE,
  product_name TEXT NOT NULL,
  product_type TEXT,
  product_description TEXT NOT NULL,
  reference_number TEXT NOT NULL,
  issue TEXT,
  issue_details TEXT,
  maintenance_status TEXT NOT NULL,
  warranty_status TEXT NOT NULL,
  technician_id TEXT NOT NULL,
  technician_name TEXT NOT NULL,
  district TEXT NOT NULL,
  service_center TEXT NOT NULL,
  picked_up_by TEXT,
  maintenance_action_taken TEXT,
  sla_days INTEGER,
  sla_status TEXT,
  sla_target_days INTEGER,
  damaged_component_fee NUMERIC,
  cost_per_product_repaired NUMERIC,
  customer_agreed_to_pay BOOLEAN DEFAULT false,
  spare_parts_used JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT
);

-- Create spare_parts table
CREATE TABLE IF NOT EXISTS spare_parts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  total_stock INTEGER NOT NULL DEFAULT 0,
  remaining_stock INTEGER NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'pcs',
  low_stock_threshold INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create spare_part_assignments table (if needed)
CREATE TABLE IF NOT EXISTS spare_part_assignments (
  id TEXT PRIMARY KEY,
  part_id TEXT NOT NULL,
  technician_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  used_quantity INTEGER DEFAULT 0
);

-- Create spare_part_usage table (if needed)
CREATE TABLE IF NOT EXISTS spare_part_usage (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  part_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE spare_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE spare_part_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE spare_part_usage ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations (for multi-device sync)
-- Note: For production, you should restrict these based on user roles
CREATE POLICY "Allow all operations on users" ON users 
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on raw_data" ON raw_data 
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on maintenance_cases" ON maintenance_cases 
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on spare_parts" ON spare_parts 
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on spare_part_assignments" ON spare_part_assignments 
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on spare_part_usage" ON spare_part_usage 
  FOR ALL USING (true) WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_maintenance_cases_account_number ON maintenance_cases(account_number);
CREATE INDEX IF NOT EXISTS idx_maintenance_cases_reference_number ON maintenance_cases(reference_number);
CREATE INDEX IF NOT EXISTS idx_maintenance_cases_status ON maintenance_cases(maintenance_status);
CREATE INDEX IF NOT EXISTS idx_maintenance_cases_district ON maintenance_cases(district);
CREATE INDEX IF NOT EXISTS idx_maintenance_cases_technician ON maintenance_cases(technician_id);
CREATE INDEX IF NOT EXISTS idx_raw_data_account_number ON raw_data(account_number);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

