# Accounts, backup and sharing: Supabase setup

The app works without any of this. Accounts, cloud backup and sharing switch on
when the build has a Supabase URL and anon key.

## 1. Create the project

1. Create a free project at <https://supabase.com/dashboard>. Pick a region close to
   your users (EU for Europe).
2. In **SQL Editor**, run `supabase/migrations/20261014000000_accounts_and_sharing.sql`
   in full. It creates the tables, the access rules, the invite and hand-over
   functions, and the private `photos` storage bucket.
   (With the Supabase CLI instead: `supabase link` then `supabase db push`.)

## 2. Sign-in

**Email code**

1. **Authentication > Providers > Email**: keep Email enabled.
2. **Authentication > Email Templates**: the app signs in with a 6-digit code,
   so both the **Magic Link** template (existing accounts) and the **Confirm
   signup** template (first sign-in) must show it. Replace each body with
   something like:

   ```html
   <h2>Your YearBook sign-in code</h2>
   <p>Enter this code in the app: <strong>{{ .Token }}</strong></p>
   ```

3. The built-in email sender is rate-limited and meant for testing. Before
   real users, set up custom SMTP under **Project Settings > Authentication**.

**Google**

1. In Google Cloud Console, create an OAuth client of type **Web application**.
   Add `https://<project-ref>.supabase.co/auth/v1/callback` as an authorized redirect URI.
2. **Authentication > Providers > Google**: enable it and paste the client ID and secret.
3. **Authentication > URL Configuration > Redirect URLs**: add
   `yearbookapp://auth-callback` and `yearbookapp-dev://auth-callback`.

## 3. Connect the app

1. Copy `.env.example` to `.env.local` and fill in **Project Settings > API**:
   the project URL and the `anon` public key. Never use the `service_role` key in
   the app or the repo.
2. Restart Metro (`npm run start -- --clear`) so Expo picks the values up.
3. For EAS builds, add the same two values as EAS environment variables
   (`eas env:create`) for the `preview` and `production` environments.
4. This adds the `expo-web-browser` native module, so the dev client needs one
   rebuild (`npm run android`).

## 4. How it works

- **Roles.** Owner: everything. Contributor: sees the book, adds photos to any
  memory, makes new memories, and edits the pages of memories it controls.
  Viewer: sees the book.
- **Per-memory control.** One person edits a memory's pages at a time. A memory
  the owner made is the owner's; a memory a contributor made is that
  contributor's. Contributors can ask to edit; the owner or the current editor
  hands over (`transfer_memory_control`). The owner can always take a memory back.
- **Backup.** The owner turns it on per project from the Share screen. Memories,
  pages and photo records upload, plus a print-quality copy of each photo (3000
  px long side, JPEG 0.9, re-encoded so EXIF and GPS are dropped). Exact
  locations stay on the phone; each memory shares only its date range and an
  area rounded to about 1 km, for future suggestion matching.
- **Sync.** Every record is a row with its JSON in `data`. Phones pull rows
  changed since their last pull (server `updated_at`), then push their own
  changes. When both sides changed a record, the phone that pushes last wins.
  Edits a role doesn't allow are put back from the cloud copy. Deletions are
  soft (`deleted_at`) so they reach every phone.
- **Invites.** The owner creates a code (stored hashed, 7 days, 20 uses) and
  sends it through the share sheet as `yearbookapp://join?code=...` plus the
  code itself, which can be typed in under Account.
- **Account deletion.** Account > Delete account removes the user's photo
  files, its owned projects, its memberships, and blanks the photos it added to
  other people's projects (Google Play requires in-app account deletion).

## 5. Tests

- `bash supabase/tests/run.sh` runs the migration on a throwaway local Postgres
  with stand-ins for Supabase's `auth` and `storage` schemas, then checks the
  access rules as owner, contributor, viewer and outsider. CI runs it too.
- `src/cloud/syncEngine.test.ts` runs the sync engine against an in-memory cloud
  with several phones.

## Not done yet

- Live updates while a project is open (sync runs on open, every 2 minutes,
  and shortly after each edit).
- Notifications ("Sam added 6 photos").
- Contributors' suggestions matching their photos to shared memories by date and area.
- Read-only guards on every owner-only control in the project screen; edits
  that slip through are undone by the next sync.
- An https invite link that opens the Play Store when the app isn't installed.
