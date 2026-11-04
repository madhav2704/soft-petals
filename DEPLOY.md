# Deploying the website (browser only, about 10 minutes)

## 1. Put the files on GitHub
1. Unzip `soft-petals-site.zip` on your computer.
2. Open https://github.com/madhav2704/soft-petals and click **uploading an existing file**
   (or **Add file → Upload files**).
3. Open the unzipped folder, select **everything inside it** (`api`, `lib`, `photos`, `index.html`,
   `package.json`, `package-lock.json`, `vercel.json`, `README.md`, `DEPLOY.md`, `.gitignore`)
   and drag it all onto the GitHub page. The `api`, `lib` and `photos` folders must stay as folders.
4. Click **Commit changes**.

## 2. Create the website on Vercel
1. Go to https://vercel.com/new and sign in.
2. Find **soft-petals** in the list and click **Import**.
   (If it isn't listed, click **Adjust GitHub App Permissions** and give Vercel access to the repo.)
3. Leave Framework Preset as **Other**, open **Environment Variables** and add:
   - Name: `AIRBNB_ICAL_URL`
   - Value: your Airbnb calendar link (the one ending in `.ics?t=...`)
4. Click **Deploy**. Your site will be at **https://soft-petals.vercel.app**
   (Vercel adds a few letters if that name is taken).

## 3. Turn on booking storage
1. In the project, open the **Storage** tab → **Create Database** → **Blob** → name it `soft-petals-bookings` → **Create**.
2. Make sure it is connected to the **soft-petals** project (all environments) → **Connect**.
3. Go to **Deployments**, click **⋯** on the latest one → **Redeploy**.

## 4. Check it works
Open `https://<your-site>/api/availability`. You should see
`"airbnbConfigured":true,"airbnbError":false` and your Airbnb booked dates in `"booked"`.
If `airbnbError` is `true`, the Airbnb link was copied wrongly: fix it in
**Settings → Environment Variables**, then redeploy.

## 5. Connect the website calendar to Airbnb
1. In Airbnb: **Calendar → Availability → Connect calendars → Connect to another website**.
2. Paste `https://<your-site>/calendar.ics`, name it **Website bookings**, and save.

Airbnb then blocks website bookings automatically (it checks every 3 hours).
After each website booking, tap **Refresh** next to this calendar in Airbnb to block the dates at once.
