# Supabase Multi-Device Setup Instructions

## ✅ Step 1: Create Environment Variables File

**You need to create a `.env` file manually** (it's in .gitignore for security).

### Option 1: Use the setup script
See `SETUP_ENV.md` for commands to create the `.env` file.

### Option 2: Create manually
1. Create a new file named `.env` in the project root (same folder as `package.json`)
2. Add these two lines:

```env
VITE_SUPABASE_URL=https://wagavfmdwxlxmdhxsnwq.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhZ2F2Zm1kd3hseG1kaHhzbndxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3NzYzMDksImV4cCI6MjA3OTM1MjMwOX0.sWwAMVYlJ_wm2NqG-LdzkvwKyHMFOZky_shsAVgDBBw
```

3. Save the file

## 📋 Step 2: Set Up Database Tables

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/wagavfmdwxlxmdhxsnwq
2. Click on **SQL Editor** in the left sidebar
3. Click **New Query**
4. Open the file `supabase-setup.sql` in this project
5. Copy the entire contents of that file
6. Paste it into the SQL Editor
7. Click **Run** (or press Ctrl+Enter / Cmd+Enter)
8. You should see "Success. No rows returned"

## 🔍 Step 3: Verify Tables Were Created

1. In Supabase Dashboard, click **Table Editor** in the left sidebar
2. You should see these tables:
   - `users`
   - `raw_data`
   - `maintenance_cases`
   - `spare_parts`
   - `spare_part_assignments`
   - `spare_part_usage`

## 🚀 Step 4: Restart Your Development Server

1. Stop your current dev server (if running) - Press `Ctrl+C`
2. Start it again:
   ```bash
   npm run dev
   ```

## ✅ Step 5: Test Multi-Device Sync

1. **On Device 1:**
   - Open the app in your browser
   - Create a new maintenance case
   - Add a spare part to inventory

2. **On Device 2:**
   - Open the app in a different browser or device
   - You should see the case and spare part you created on Device 1!

## 🌐 Step 6: Deploy to Production (Vercel)

If you're deploying to Vercel, add these environment variables:

1. Go to your Vercel project settings
2. Navigate to **Environment Variables**
3. Add these two variables:
   - **Name:** `VITE_SUPABASE_URL`
     **Value:** `https://wagavfmdwxlxmdhxsnwq.supabase.co`
   - **Name:** `VITE_SUPABASE_ANON_KEY`
     **Value:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhZ2F2Zm1kd3hseG1kaHhzbndxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3NzYzMDksImV4cCI6MjA3OTM1MjMwOX0.sWwAMVYlJ_wm2NqG-LdzkvwKyHMFOZky_shsAVgDBBw`
4. Click **Save**
5. Redeploy your application

## 🔒 Security Note

⚠️ **Important:** The `service_role` key you provided should **NEVER** be used in the frontend code. It's only for backend/server operations. The app uses the `anon` key which is safe for client-side use.

## 🐛 Troubleshooting

### Data not syncing?
- Check browser console for errors (F12 → Console)
- Verify `.env` file exists and has correct values
- Make sure you ran the SQL script in Supabase
- Check that tables exist in Supabase Table Editor

### Can't connect to Supabase?
- Verify your internet connection
- Check that Supabase project is active (not paused)
- Verify the URL and key in `.env` file

### Tables not found?
- Make sure you ran the complete SQL script
- Check Supabase Table Editor to see which tables exist
- Re-run the SQL script if needed

## 📱 How It Works

- **Local First:** Data is saved to localStorage immediately for fast UI updates
- **Cloud Sync:** Data is then synced to Supabase in the background
- **Multi-Device:** All devices read from Supabase, so everyone sees the same data
- **Offline Support:** If Supabase is unavailable, the app falls back to localStorage

## ✨ You're All Set!

Your app is now configured for multi-device sync! All data will be shared across all devices that use the app.

