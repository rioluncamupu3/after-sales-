# Fix Vercel Environment Variables

## Problem
The app is trying to connect to a Neon database instead of Supabase. This means the environment variables in Vercel are incorrect.

## Solution: Update Vercel Environment Variables

### Step 1: Go to Vercel Dashboard
1. Visit: https://vercel.com/dashboard
2. Select your project: **service-tracker**
3. Go to **Settings** → **Environment Variables**

### Step 2: Check Current Variables
Look for these variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Step 3: Update/Add Correct Values

**VITE_SUPABASE_URL:**
```
https://wagavfmdwxlxmdhxsnwq.supabase.co
```

**VITE_SUPABASE_ANON_KEY:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhZ2F2Zm1kd3hseG1kaHhzbndxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3NzYzMDksImV4cCI6MjA3OTM1MjMwOX0.sWwAMVYlJ_wm2NqG-LdzkvwKyHMFOZky_shsAVgDBBw
```

### Step 4: Set for All Environments
Make sure both variables are set for:
- ✅ Production
- ✅ Preview
- ✅ Development

### Step 5: Redeploy
After updating the variables:
1. Go to **Deployments** tab
2. Click the **⋯** (three dots) on the latest deployment
3. Click **Redeploy**

Or use CLI:
```bash
vercel --prod
```

## Verify Environment Variables via CLI

You can also check/update via CLI:

```bash
# List current environment variables
vercel env ls

# Remove incorrect variable (if needed)
vercel env rm VITE_SUPABASE_URL production

# Add correct variable
echo "https://wagavfmdwxlxmdhxsnwq.supabase.co" | vercel env add VITE_SUPABASE_URL production

# Add anon key
echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhZ2F2Zm1kd3hseG1kaHhzbndxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3NzYzMDksImV4cCI6MjA3OTM1MjMwOX0.sWwAMVYlJ_wm2NqG-LdzkvwKyHMFOZky_shsAVgDBBw" | vercel env add VITE_SUPABASE_ANON_KEY production
```

## Important Notes

1. **URL Format**: Supabase URLs must contain `.supabase.co`
2. **JWT Format**: The anon key must be a valid JWT (starts with `eyJ`)
3. **No Trailing Slash**: Don't add `/` at the end of the URL
4. **Case Sensitive**: Variable names are case-sensitive

## After Fixing

Once you've updated the environment variables and redeployed:
1. Clear your browser cache
2. Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)
3. Check the browser console - you should see Supabase connecting correctly
4. The error should be gone!

