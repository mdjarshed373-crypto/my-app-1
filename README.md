# TX TOUR BD — Free Fire Esports Tournament Platform

A competitive Free Fire tournament management platform with Firebase Cloud Firestore persistence, real-time room credentials, automated placement + kill point calculation, team management, and bKash/Nagad/Rocket wallet verification.

---

## 🌐 Live Public Application

- **Live URL**: [https://ais-pre-xqluoj7ufqf3547m4ybkp7-104523512966.asia-northeast1.run.app](https://ais-pre-xqluoj7ufqf3547m4ybkp7-104523512966.asia-northeast1.run.app)
- **Dev URL**: [https://ais-dev-xqluoj7ufqf3547m4ybkp7-104523512966.asia-northeast1.run.app](https://ais-dev-xqluoj7ufqf3547m4ybkp7-104523512966.asia-northeast1.run.app)

---

## 🚀 How to Host on Vercel

1. **Extract or Upload the Code**:
   - Use the generated `txtourbd-vercel.zip` archive or clone this repository.
   - Push the files to a repository on GitHub, GitLab, or Bitbucket.

2. **Import to Vercel**:
   - Go to [vercel.com](https://vercel.com) and log in.
   - Click **"Add New Project"** and import your repository.

3. **Configure Build Settings**:
   - **Framework Preset**: Vite
   - **Root Directory**: `./`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

4. **Single-Page Application Routing**:
   - The included `vercel.json` already contains the SPA rewrite rule:
     ```json
     {
       "rewrites": [
         {
           "source": "/(.*)",
           "destination": "/index.html"
         }
       ]
     }
     ```

5. **Deploy**:
   - Click **"Deploy"**. Vercel will build the frontend assets and host your app with global edge CDN, automatic HTTPS, and custom domain capability.

---

## 🛡️ Admin Account Access

- Super Admin access is configured for: **`mdjarshed373@gmail.com`**.
- When logged in with this account via Google Sign-In or Email, select **"এডমিন প্যানেল" (Admin Panel)** from the user menu to access:
  - Tournament Creation & Editing
  - Match Custom Room ID & Password Release
  - Manual Deposit (TrxID) Approvals & Rejections
  - Withdrawal Payout Processing
  - Match Result Entry & Automated Cash Prize Distribution
  - Support Ticket Responses
  - Payment Numbers Configuration (bKash / Nagad / Rocket)

---

## 🛠️ Local Development

```bash
# 1. Install dependencies
npm install

# 2. Run local development server
npm run dev

# 3. Build for production
npm run build
```
