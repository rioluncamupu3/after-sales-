# Quick Setup: Create .env File

## Step 1: Create .env File

Create a file named `.env` in the root directory of your project (same folder as `package.json`) with the following content:

```env
VITE_SUPABASE_URL=https://wagavfmdwxlxmdhxsnwq.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhZ2F2Zm1kd3hseG1kaHhzbndxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3NzYzMDksImV4cCI6MjA3OTM1MjMwOX0.sWwAMVYlJ_wm2NqG-LdzkvwKyHMFOZky_shsAVgDBBw
```

### Windows (PowerShell):
```powershell
@"
VITE_SUPABASE_URL=https://wagavfmdwxlxmdhxsnwq.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhZ2F2Zm1kd3hseG1kaHhzbndxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3NzYzMDksImV4cCI6MjA3OTM1MjMwOX0.sWwAMVYlJ_wm2NqG-LdzkvwKyHMFOZky_shsAVgDBBw
"@ | Out-File -FilePath .env -Encoding utf8
```

### Windows (Command Prompt):
```cmd
echo VITE_SUPABASE_URL=https://wagavfmdwxlxmdhxsnwq.supabase.co > .env
echo VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhZ2F2Zm1kd3hseG1kaHhzbndxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3NzYzMDksImV4cCI6MjA3OTM1MjMwOX0.sWwAMVYlJ_wm2NqG-LdzkvwKyHMFOZky_shsAVgDBBw >> .env
```

### Mac/Linux:
```bash
cat > .env << EOF
VITE_SUPABASE_URL=https://wagavfmdwxlxmdhxsnwq.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhZ2F2Zm1kd3hseG1kaHhzbndxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3NzYzMDksImV4cCI6MjA3OTM1MjMwOX0.sWwAMVYlJ_wm2NqG-LdzkvwKyHMFOZky_shsAVgDBBw
EOF
```

## Step 2: Run SQL Setup Script

1. Go to https://supabase.com/dashboard/project/wagavfmdwxlxmdhxsnwq
2. Click **SQL Editor** → **New Query**
3. Open `supabase-setup.sql` file and copy all contents
4. Paste into SQL Editor and click **Run**

## Step 3: Restart Dev Server

```bash
npm run dev
```

## Done! 🎉

Your app is now configured for multi-device sync!

