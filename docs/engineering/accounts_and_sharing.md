# Accounts and sharing

Status: design, phase 1 in progress (2026-10-13).

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

## What phase 1 needs before it can run

- A Supabase project (Alex). Then:
  1. Apply the migration (`supabase db push`, or paste it into the SQL editor).
  2. Enable Google and email sign-in.
  3. Add redirect URLs for `yearbookapp://` and `yearbookapp-dev://`.
- The project URL and the anon key, provided as `EXPO_PUBLIC_SUPABASE_URL` and
  `EXPO_PUBLIC_SUPABASE_ANON_KEY` in a local `.env` (never committed) and as EAS
  environment variables. The anon key is designed to ship in apps; row-level
  security is what protects the data.
- A Google OAuth client for Android (package `com.lieber.yearbookapp` and the
  `.dev` variant, plus their signing SHA-1s) and a web client for Supabase.
- New dependencies, which need approval per `AGENTS.md`:
  - `@supabase/supabase-js` (JS only).
  - `react-native-url-polyfill` (JS only).
  - `expo-web-browser` and `expo-auth-session` for the sign-in redirect. These are
    Expo modules and need a native rebuild.

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
