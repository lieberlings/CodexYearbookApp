# Accounts and sharing

Status: phases 1 (accounts, backup) and 2 (sharing) implemented, not yet run against a live Supabase project (2026-10-14).

## Goal

Make a yearbook something several people can build together. One person, the
**owner**, has full control: pages, layout, cover, finalize and export, and who is
in the project. Everyone else is a **contributor**: they can see the project and its
memories, and add photos to memories. Nothing else.

Accounts stay optional. A local-only project keeps working exactly as it does
today. You need an account only to back up or to share.

## Why the role split keeps this simple

Contributors only ever *add* photos, and only the owner edits layout. So two people
never edit the same record. That means we don't need merge logic for simultaneous
edits, which is the hardest part of collaborative apps. A contributor's photo arrives
in the memory unplaced ("New from Sam"), and the owner places it on a page, the same
way imported photos are placed today.

## Today

- `src/storage.ts` keeps all app data as one JSON blob in AsyncStorage
  (`yearbook-app-data-v1`). That data is projects, memories, page sections, photos
  and suggestions.
- `AppContext` loads that blob once and saves the whole thing after every change.
- Photos are local file or content URIs. There is no user, owner or server concept.

## Backend: Supabase

| Need | Supabase piece |
| --- | --- |
| Accounts | Auth: Google sign-in, plus an email magic link |
| Shared project data | Postgres tables with row-level security |
| Photo files | Storage: private `photos` bucket with signed URLs |
| Invites (phase 2) | `invites` table plus a deep link `yearbookapp://invite/<token>` |
| "Sam added photos" (phase 3) | Database webhook → Expo push notification |

The data is relational (project → members → memories → photos), and the access
rules are per project. Postgres row-level security expresses that directly, which
is why Supabase fits better than Firebase here.

## Data model

See `supabase/migrations/20261013000000_accounts_backup.sql`.

- Each synced table stores the app's own record in a `data` jsonb column. It keeps
  only the columns that access rules and sync need: `id`, `project_id`, `memory_id`,
  `added_by`, `storage_path`, `updated_at` and `deleted_at`. The TypeScript types
  change often, and this way they can change without a server migration.
- Record ids are the app's existing local ids. Nothing has to be renumbered on the
  first upload.
- `deleted_at` is a tombstone, so deletions reach other devices.
- `updated_at` is set by the server on every write. A device pulls the rows changed
  since its last sync.
- `project_members` exists from phase 1, holding just the owner. That way phase 2
  adds contributors without rewriting the access rules.
- Suggestions are **not** synced. Their candidate photos point at one device's
  MediaLibrary.
- Photo files live at `photos/<project_id>/<photo_id>.<ext>`. Uploads are
  print-quality, not thumbnails, because the owner's PDF export needs them.

## Sync (phase 1)

Phase 1 is one person on one or more devices. Rules:

1. A project is either **local** or **backed up**. "Back up this project" uploads
   the project, its memories, its page sections and its photo rows, then the photo
   files in the background.
2. After that, local changes are queued and pushed by record id. The server keeps
   the last write (`updated_at`), which is fine while only the owner writes.
3. On launch, and when the app returns to the foreground, the device pulls rows with
   `updated_at` after its last sync. It then downloads missing photo files lazily,
   when a page or thumbnail needs them.
4. Offline is normal. The queue survives restarts and drains when the network is
   back.

The local blob stays the app's working copy in phase 1. Sync works through the same
`AppData` records, so the screens don't change.

## Phases

0. **Groundwork (optional, recommended before phase 2).** Move local storage from
   the single AsyncStorage blob to SQLite. The blob already needs the Android
   CursorWindow workaround in `storage.ts`. Also put a small data layer between
   `AppContext` and storage.
1. **Accounts and cloud backup:**
   - Sign in and sign out (Settings → Account).
   - Back up a project.
   - Restore your projects on a new device.
   - In-app account deletion. The Play Store requires it as soon as accounts exist.
2. **Sharing:**
   - Invite links.
   - The contributor role (a policy that lets contributors insert photos into
     memories of their projects, and delete only their own).
   - A simplified contributor view: project → memories → Add photos.
   - "New photos" badges for the owner.
   - Remove a member.
3. **Polish:**
   - Push notifications.
   - An activity list.
   - A view-only role.
   - Transfer ownership.

## What's built (2026-10-14)

Phases 1 and 2 are implemented and unit-tested against an in-memory server that
enforces the same access rules. They haven't run against a real Supabase project
yet; that's the next step once the project exists (see Setup).

- **Accounts:** Account screen (home → Account).
  - Sign in with a 6-digit email code. There's no password and no redirect link,
    so there's no Google or redirect-URL setup.
  - Sign out keeps every project on the phone.
  - Delete account removes the photo files through the Storage API, then calls
    `delete_my_account()`.
- **Backup and restore:**
  - Project menu → Back up to cloud.
  - Changes sync about 8 s after edits, when the app returns to the foreground, and
    on Sync now.
  - Signing in on another phone pulls every backed-up project; photo files download
    in the background.
- **Sharing:**
  - Project menu → People & sharing → Share an invite. This sends a link plus a
    plain code, valid 14 days.
  - The invitee opens the link (`app/invite/[token]`) or pastes the code under
    Account → Join a shared project.
  - Contributors get `app/shared/[id]`: memories, photos and Add photos. There are
    no editing tools there, and the full editor redirects them to it.
  - The owner can remove people. A contributor can leave. A removed contributor's
    phone drops the project on its next sync.
- **Code:**
  - `src/cloud/sync/model.ts`: pure rules for rows, fingerprints, push plan, pull
    merge and roles.
  - `src/cloud/sync/engine.ts`: one sync round behind the `CloudApi` interface.
  - `src/cloud/sync/supabaseApi.ts`: the real `CloudApi`. Photos stream from disk
    through signed URLs.
  - `src/cloud/CloudContext.tsx`: session, scheduling and sharing actions.
  - `AppContext.applyCloudPatch` applies pulled changes without overwriting edits
    made meanwhile.
- **Not built yet:**
  - "New from Sam" badges for the owner. Contributors' photos arrive unplaced in
    the memory's photo strip.
  - Project thumbnails in the cloud.
  - Push notifications.
  - A view-only role.
  - Transfer ownership.
  - Contributors seeing the designed pages.

## Setup (one time, about 15 minutes)

1. Create a project at supabase.com (the free tier is enough to start).
2. SQL editor: run `supabase/migrations/20261013000000_accounts_backup.sql`, then
   `supabase/migrations/20261014000000_sharing.sql`. Or run `supabase db push` with
   the Supabase CLI.
3. Authentication → Sign In / Providers → Email: keep it enabled.
4. Authentication → Emails: edit both the "Confirm signup" template (first sign-in
   of a new email) and the "Magic Link" template (later sign-ins) to include the
   code, for example `Your sign-in code is {{ .Token }}`. Without `{{ .Token }}`
   the email only contains a link, and the app needs the 6-digit code.
5. Project Settings → API: copy the Project URL and the anon public key into a local
   `.env` (see `.env.example`). Never use the service_role key in the app.
6. For EAS builds, add the same two values as EAS environment variables
   (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`).
7. Supabase's built-in email sender is rate-limited (a few emails per hour). Set up
   custom SMTP (Authentication → Emails → SMTP) before inviting real people.

With no values set, the app builds and runs exactly as before. The Account screen
then says accounts aren't set up.

## Decisions taken

- Sign-in uses email codes only for now. Google sign-in can be added later; it needs
  `expo-auth-session`, OAuth clients and redirect URLs.
- Contributors can change and remove only the photos they added.
- Invites are reusable links for one project that expire after 14 days.
- Photos sync without the on-device face and label analysis, which can be
  recomputed. Photo metadata from `importMetadata` (dates, location) does sync.
- Suggestions and project thumbnails stay on the device.

## Open questions

1. Should contributors see the designed pages read-only, or only memories and
   photos?
2. May contributors delete or replace the photos they added? Proposed: yes, their
   own only.
3. Should location and EXIF data from contributors' photos be kept (dates and
   suggestions work) or stripped (privacy)?
4. Must contributors install the app, or is a web upload page needed for people who
   won't?
5. Is there a storage budget? Print-quality photos are the main cost.
