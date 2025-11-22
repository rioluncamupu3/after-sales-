# Deployment Guide for Service Tracker Application

## Option 1: Quick Local Network Access (For Testing)

Make your dev server accessible on your local network:

1. **Update vite.config.ts** - Already configured to accept connections from any IP
2. **Find your computer's IP address:**
   - Windows: Open Command Prompt and run `ipconfig`
   - Look for "IPv4 Address" (e.g., 192.168.1.100)
3. **Start the dev server:**
   ```bash
   npm run dev
   ```
4. **Access from other devices:**
   - On other devices on the same network, open browser and go to:
   - `http://YOUR_IP_ADDRESS:8080` (e.g., `http://192.168.1.100:8080`)

**Note:** This only works while your computer is running and on the same network.

---

## Option 2: Build and Deploy to Production

### Step 1: Build the Application

```bash
npm run build
```

This creates a `dist` folder with optimized production files.

### Step 2: Deploy Options

#### A. Deploy to Vercel (Recommended - Free & Easy)

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Deploy:**
   ```bash
   vercel
   ```
   - Follow the prompts
   - Your app will be live at `https://your-app-name.vercel.app`

3. **Or use Vercel Dashboard:**
   - Go to https://vercel.com
   - Sign up/login
   - Click "New Project"
   - Import your Git repository (if using Git)
   - Or drag and drop the `dist` folder

#### B. Deploy to Netlify (Free & Easy)

1. **Install Netlify CLI:**
   ```bash
   npm install -g netlify-cli
   ```

2. **Deploy:**
   ```bash
   npm run build
   netlify deploy --prod --dir=dist
   ```
   - Follow the prompts
   - Your app will be live at `https://your-app-name.netlify.app`

3. **Or use Netlify Dashboard:**
   - Go to https://netlify.com
   - Sign up/login
   - Drag and drop the `dist` folder

#### C. Deploy to GitHub Pages

1. **Install gh-pages:**
   ```bash
   npm install --save-dev gh-pages
   ```

2. **Add to package.json scripts:**
   ```json
   "deploy": "npm run build && gh-pages -d dist"
   ```

3. **Deploy:**
   ```bash
   npm run deploy
   ```

#### D. Self-Hosted Server (VPS/Cloud Server)

1. **Build the app:**
   ```bash
   npm run build
   ```

2. **Upload `dist` folder to your server**

3. **Install a web server (nginx example):**
   ```bash
   # Install nginx
   sudo apt-get install nginx

   # Copy files
   sudo cp -r dist/* /var/www/html/

   # Configure nginx (if needed)
   sudo nano /etc/nginx/sites-available/default
   ```

4. **Or use a simple Node.js server:**
   ```bash
   npm install -g serve
   serve -s dist -l 3000
   ```

---

## Option 3: Serve Locally with Production Build

For testing the production build locally:

1. **Build:**
   ```bash
   npm run build
   ```

2. **Preview:**
   ```bash
   npm run preview
   ```

3. **To make it accessible on network, update vite.config.ts:**
   ```typescript
   preview: {
     host: "::",
     port: 4173,
   }
   ```

---

## Important Notes:

### ⚠️ Data Storage Warning
Your app uses **localStorage** which means:
- Data is stored in each user's browser
- Data is NOT shared between devices/users
- Data is lost if browser cache is cleared

### For Multi-User/Shared Data:
You'll need to:
1. Set up a backend API (Node.js, Python, etc.)
2. Use a database (PostgreSQL, MongoDB, etc.)
3. Replace localStorage with API calls

### Recommended Next Steps:
1. **For now:** Use Option 1 or 2 for deployment
2. **For production:** Consider adding a backend API for data persistence
3. **For scalability:** Move to a proper database solution

---

## Quick Start Commands:

```bash
# Development (local network access)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Deploy to Vercel
vercel

# Deploy to Netlify
netlify deploy --prod --dir=dist
```

