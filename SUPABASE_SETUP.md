# Field Tracker Supabase setup

The project URL and client-side publishable key are in `src/app/data/supabase.ts`. Supabase Auth handles email and password sign-in; `/rest/v1/trips` handles trip saves and history. The app does not need a database password or service-role key.

1. Open [Strava Project SQL Editor](https://supabase.com/dashboard/project/agvadccmdkfdclstamkg/sql/new).
2. Open [`supabase/migrations/20261107032544_create_trip_history.sql`](supabase/migrations/20261107032544_create_trip_history.sql). Copy the entire file into a new SQL query and click **Run** once. It creates the `public.trips` table, an index for history order, and owner-only row-level security policies. If `public.trips` already exists, the transaction stops without modifying it.
3. In [Authentication → Sign In / Providers](https://supabase.com/dashboard/project/agvadccmdkfdclstamkg/auth/providers), leave **Allow new users to sign up** and the **Email** provider enabled. Keep **Confirm email** off if accounts should register without receiving an email. An email you cannot receive cannot be used for password recovery, so remember the email and password you choose.
4. Open the app, create an account, record and finish a trip, then open the history clock. The history row shows **Saved to your account** when Supabase has accepted the trip. If it says **On device · waiting to sync**, use **Refresh trips** after checking your connection and the SQL setup.

The migration grants only signed-in users access to the table, and each rule checks that the trip's `user_id` is the signed-in user's ID. Supabase receives the trip timestamps, distance in meters, elapsed time, unit, GPS route, and preset background number. It does not receive camera photos or exported PNGs.

## Photos and export

The first backdrop is the supplied black-and-white starting-line photograph. **Take a photo** uses the native camera, keeps the selected photo on the device for that trip, and requests a gallery copy. In a browser, the camera button can open the device's capture or file picker. A camera background is available only on the device that took it. Your three built-in background choices can follow the trip across devices.

**Save trip image** writes a PNG to the native app's Documents folder or triggers a browser download. In iOS, look in **Files → On My iPhone → Field Tracker**. On Android, check **Files → Documents**. **Share image** opens the device share sheet where available. Sharing is optional and starts only when tapped.

## Read the code

- `src/app/data/supabase.ts` sends the REST requests and passes the publishable key.
- `src/app/data/auth.service.ts` signs in and refreshes the session token used for private REST requests.
- `src/app/home/home.page.ts` calls the trip store from Finish. GPS and distance calculations still live in the existing tracker code.
- `src/app/history/trip-store.service.ts` keeps a device copy before syncing and retries using the same trip ID.
- `src/app/history/trip-poster.ts` draws the route and readings on the selected background.
- `src/app/history/trip-photo.ts` handles device photos and file export separately from the REST client.

Build a fresh Android APK or iOS build after adding the camera and filesystem plugins. Reopening an older native build cannot add those plugins.
