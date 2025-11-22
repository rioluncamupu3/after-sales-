# Supabase Setup Guide for Shared Data

## Step 1: Create a Supabase Account

1. Go to https://supabase.com
2. Click "Start your project"
3. Sign up with GitHub, Google, or email
4. Create a new project
   - Choose a name (e.g., "service-tracker")
   - Choose a database password (save this!)
   - Select a region closest to you
   - Wait for project to be created (2-3 minutes)

## Step 2: Get Your API Keys

1. In your Supabase project dashboard, go to **Settings** → **API**
2. Copy these two values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon/public key** (long string starting with `eyJ...`)

## Step 3: Create Environment Variables

1. Create a file named `.env` in your project root (same folder as `package.json`)
2. Add these lines (replace with your actual values):

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Important:** Never commit `.env` to Git! It's already in `.gitignore`

## Step 4: Create Database Tables

1. In Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Copy and paste this SQL script:

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

-- Enable Row Level Security (RLS) - Allow all operations for now
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE spare_parts ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations (you can restrict later)
CREATE POLICY "Allow all operations on users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on raw_data" ON raw_data FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on maintenance_cases" ON maintenance_cases FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on spare_parts" ON spare_parts FOR ALL USING (true) WITH CHECK (true);
```

4. Click **Run** to execute the script
5. Verify tables were created by going to **Table Editor**

## Step 5: Update Your App

The code has already been updated to use Supabase. Just:

1. Add your `.env` file with the credentials
2. Restart your dev server: `npm run dev`
3. The app will automatically use Supabase when credentials are found

## Step 6: Deploy to Vercel with Environment Variables

1. Go to your Vercel project: https://vercel.com/hopepoultry/service-tracker
2. Go to **Settings** → **Environment Variables**
3. Add these variables:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
4. Redeploy: `vercel --prod`

## Testing

1. Create a case on one device
2. Check on another device - it should appear!
3. All data is now shared across all devices

## Troubleshooting

- **Data not syncing?** Check browser console for errors
- **Can't connect?** Verify your API keys in `.env`
- **Tables not found?** Make sure you ran the SQL script in Supabase

## Security Note

The current setup allows all operations. For production, you should:
1. Set up proper authentication
2. Create more restrictive RLS policies
3. Use service role key for admin operations (server-side only)

