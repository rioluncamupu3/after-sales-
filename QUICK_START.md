# Quick Start: Enable Shared Data Across Devices

## Step 1: Create Supabase Account (2 minutes)

1. Go to https://supabase.com
2. Click "Start your project" 
3. Sign up (free)
4. Click "New Project"
   - Name: `service-tracker`
   - Database Password: (create a strong password - save it!)
   - Region: Choose closest to you
   - Wait 2-3 minutes for setup

## Step 2: Get API Keys (1 minute)

1. In Supabase dashboard, click **Settings** (gear icon) → **API**
2. Copy these two values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)

## Step 3: Create Database Tables (2 minutes)

1. In Supabase dashboard, click **SQL Editor** (left sidebar)
2. Click **New Query**
3. Copy and paste this entire SQL script:

```sql
-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  permission TEXT NOT NULL,
  district TEXT,
  full_name TEXT,
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
  end_date TIMESTAMP WITH TIME ZONE,
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
  pickup_date TIMESTAMP WITH TIME ZONE,
  delivery_date TIMESTAMP WITH TIME ZONE,
  maintenance_action_taken TEXT,
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

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE spare_parts ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations (for now - you can restrict later)
CREATE POLICY "Allow all operations on users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on raw_data" ON raw_data FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on maintenance_cases" ON maintenance_cases FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on spare_parts" ON spare_parts FOR ALL USING (true) WITH CHECK (true);
```

4. Click **Run** (or press Ctrl+Enter)
5. You should see "Success. No rows returned"

## Step 4: Add Environment Variables (1 minute)

1. In your project folder, create a file named `.env`
2. Add these two lines (replace with YOUR values from Step 2):

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Example:**
```env
VITE_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYxNjIzOTAyMiwiZXhwIjoxOTMxODE1MDIyfQ.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## Step 5: Restart Your App

1. Stop your dev server (Ctrl+C)
2. Start it again:
   ```bash
   npm run dev
   ```

## Step 6: Test It!

1. Create a case on one device
2. Open the app on another device
3. The case should appear! 🎉

## Step 7: Deploy to Vercel with Environment Variables

1. Go to https://vercel.com/hopepoultry/service-tracker
2. Click **Settings** → **Environment Variables**
3. Add these two variables:
   - `VITE_SUPABASE_URL` = your Supabase URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
4. Click **Save**
5. Go to **Deployments** tab
6. Click the three dots (⋯) on the latest deployment
7. Click **Redeploy**

## That's It! 🎉

Your app now shares data across all devices!

### What Happens Now:
- ✅ Data is stored in Supabase (cloud database)
- ✅ All devices see the same data
- ✅ Changes sync automatically
- ✅ Works offline (falls back to localStorage)
- ✅ Free tier supports up to 500MB database

### Need Help?
- Check browser console for errors
- Verify your `.env` file has correct values
- Make sure you ran the SQL script in Supabase

