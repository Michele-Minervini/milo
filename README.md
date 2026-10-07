# Milo

A tiny personal web app for strength training, named after Milo of Croton —
the wrestler who carried a calf every day until it was a bull. It tracks gym
days and six bodyweight skill ladders (Pushups, Squats, Pullups, Leg Raises,
Bridges and Handstand Pushups, ten progressively harder steps each), and
counts both in hard sets for six muscle groups: chest, back, shoulders, arms,
abs and legs.

**Live app:** https://michele-minervini.github.io/milo/

(It used to live at `…/calisthenics-tracker/`; see
[Moving from the old address](#moving-from-the-old-address).)

## What it does

Four tabs along the bottom, with **＋ Log** in the middle of them:

- **Today.** Today's session (from your weekly routine), one tip about the
  muscle group that needs it most, and the week at a glance: which days you
  trained (a dot per muscle group) and six bars of hard sets per group against
  their weekly targets.
- **Body.** This week's hard sets for chest, back, shoulders, arms, abs and legs
  — Monday to Sunday, against a target of 10–20 sets (20–40 for arms and legs,
  which are several muscles each; change it in Settings) — with where an even
  pace would put you by today, how you compare with this point last week, and a
  balance radar. Skill sessions count too: a set of push-ups is one set for
  chest and half a set for arms and shoulders. Tap a group for what counted,
  its last 8 weeks and the skills that train it. The ⓘ explains the counting.
- **Skills.** The six-axis radar, ten rings deep — your current step in every
  ladder — and a card per ladder with what's next. Tap an area (chart or card)
  for its ten steps; tap a dot to jump straight to your current exercise. Every
  step shows short instructions, Beginner / Intermediate / Progression rep
  goals, tips for when it's too hard, and a demo-video link.
- **History.** Workouts this week, your week streak (weeks in a row with 2 or
  more workouts) and your total; a month calendar with a dot per muscle group
  trained; and every workout by day (All / Gym / Bodyweight) with the steps you
  reached. Tap an entry to change or delete it.
- **＋ Log.** Today's session moves in one tap, any other skill, a **gym
  exercise**, or a **quick gym log** (just the working sets per muscle group,
  when you don't want to log exercises).
- **Gym exercises.** About 55 exercises (barbell, dumbbells, machines, cables,
  push-ups, pull-ups, dips, abs work…) plus your own. Log each set as reps × kg and tick it:
  every tick is saved at once, and starts the rest timer. Milo shows what you
  did last time and suggests the next step — add weight when you hit the top of
  the rep range on every set, otherwise one more rep, and lighter after a long
  break. Every set counts toward the weekly bars unless you tap its number to
  make it **W**, a warm-up: it stays in the log but isn't counted (sessions
  logged with a build older than milo-v23 keep the old automatic guess until
  you open one and change it). The suggestion for next time is planned from
  your sets near the top weight only, so lighter build-up sets count on the
  bars without turning into "four sets at the top weight". A new session
  opens as a copy of last time's rows — warm-ups marked, each set at its own
  weight, the reps to aim for in grey — and only the top sets move with the
  suggestion, so a pyramid doesn't have to be typed again.
  Each exercise has its own rep range, weight step and setup note ("seat 4"),
  which you can change.
- **Logging a skill session.** Enter your sets and reps (or hold time) and
  save. The app checks the result against the goals and marks the standard you
  met automatically; when you hit the Progression goal it offers to move you up
  a step.
- **Rest timer.** One-tap presets (from 50 seconds to 5 minutes) start a
  floating countdown that keeps running while you browse other exercises; tap
  it for +30 s or Skip. Gym sets use their own rest (Settings), and Milo can keep
  the screen on during a workout. When the rest ends the pill turns green and
  pulses, and it beeps — but an iPhone gives web apps no vibration and mutes
  the beep on silent, so Settings also offers **a notification when the rest
  ends**: the only thing that can buzz there, and whether it does is up to the
  iPhone's own notification settings (Settings has a test button). It only
  fires while Milo is open on screen — nothing runs once the phone locks or
  another app is in front — so with the option on Milo keeps the screen on
  during the rest.
  Each exercise also shows a top-set sparkline over time.
- **It tells you what to do.** Every movement comes with a prescription — the
  exercise, the sets and reps, and which standard you're chasing — worked out
  from where you are right now. Move up a step and the next screen already asks
  for the new exercise's numbers; there is no plan to regenerate.
- **Guided sessions.** "Start session" walks you through the workout one
  movement at a time: warm-up, prescription, form cues, log it, rest, next.
  Close the app mid-workout and it resumes where you left off.
- **Swaps.** Each step offers alternatives that fit it — negatives, paused and
  tempo reps, grip changes, holds. Easier ones are marked *practice*: they get
  logged, but they can't award a standard you didn't earn.
- **Exercise library.** Every area's ten steps in one list, each with what it
  trains and the reps and sets for all three standards.
- **Week plan** (the link on Today's session). The whole rotation at a
  glance, plus what each area needs next and the rungs beyond it.
- **Ghost radar.** Toggle "Show where I started" to see your past shape behind
  today's. Settings can re-zero that line to today — handy at the start of a new
  training block — without touching your sessions or your steps.
- Everything is saved automatically in the browser (`localStorage`) — no
  account, no server, no cost. Settings gives you a quick progress **link**
  (progress only, also as a scannable **QR code**) and a full **backup file**
  (progress + history) to move between devices.
- **Optional cloud sync.** Turn it on once and your phone and laptop keep each
  other up to date by themselves — see [Cloud sync setup](#cloud-sync-setup).
- Works offline and can be installed on the iPhone home screen: in Safari open
  https://michele-minervini.github.io/milo/ → **•••** (or Share) → **Share** →
  **Add to Home Screen** (turn **Open as Web App** on if it's shown) → **Add**.

## Files — what is what

| File | Role |
|------|------|
| `index.html` | The page skeleton |
| `style.css` | All styling (light + dark theme) |
| `data.js` | The content: 60 exercises with rep goals, 38 variations, warm-ups, and which muscle groups each one works |
| `app.js` | The logic: navigation, logging, stats, saving/loading — and what the radar shows |
| `model.js` | The data rules: what a saved state looks like, how it's cleaned on load, how two devices merge |
| `training.js` | The training rules: weeks, hard sets per muscle group, weekly targets |
| `radar.js` | Draws the radar charts (the Skills ladders and the Body muscle groups) |
| `qrcode.js` | Self-contained QR-code generator (no dependencies) |
| `sync.js` | Optional cloud sync: talks to your database |
| `tests/` | Automated checks — run with `sh tests/run.sh` (see below) |
| `tools/set-build.sh` | Sets the release number everywhere it must match |
| `sw.js` | Service worker — makes the app work offline |
| `manifest.webmanifest` + `icons/` | App name/icon for "Add to Home Screen" |

No frameworks, no build step: edit a file, reload the page, that's it.

## Run it locally

Browsers restrict some features on files opened directly, so serve the folder:

```bash
cd ~/Documents/Projects/calisthenics-tracker
python3 -m http.server 8642
```

Then open http://localhost:8642 in your browser.

## Cloud sync setup

Optional, and off until you do this. It stays free: the app uses Firebase's
no-cost Spark plan, which needs no credit card, and this app's data is a few
tens of kilobytes against a 1 GB allowance.

**Do this once, on a computer.**

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and
   sign in with your Google account. Click **Create a project**, give it any
   name (`bigsix` is fine), and turn Google Analytics **off** when it offers —
   you don't need it.
2. In the left sidebar open **Build → Realtime Database**, then
   **Create Database**. Pick the location closest to you (`europe-west1`) and
   choose **Start in locked mode** — the next step opens exactly the door you
   need and nothing more.
3. Open the **Rules** tab, replace everything with the block below, and click
   **Publish**:

   ```json
   {
     "rules": {
       "u": {
         "$code": {
           ".read": "$code.length >= 20",
           ".write": "$code.length >= 20",
           "blob": { ".validate": "newData.isString() && newData.val().length <= 1000000" },
           "updatedAt": { ".validate": "newData.isNumber()" },
           "$other": { ".validate": false }
         }
       }
     }
   }
   ```

   (The editor checks the syntax when you publish, so you'll know straight away
   if a character went missing in the copy.)

4. Go back to the **Data** tab. The line at the top, next to the 🔗 icon, *is*
   the database URL — copy that whole line. It ends in either of two ways
   depending on the region you picked, and both work:

   ```text
   https://bigsix-abbe9-default-rtdb.firebaseio.com
   https://bigsix-1234-default-rtdb.europe-west1.firebasedatabase.app
   ```

   (A trailing `/` is fine — the app trims it.)

**Then, in the app.** Open Settings → *Sync across your devices*, paste that URL
and press **Turn on**. The app invents a long random sync code and starts
syncing. To add another device, tap **Connect another device** on the first
one. A laptop or an Android phone can scan the QR code it shows. **iPhone: don't
scan** — the camera opens Safari, whose saved data is separate from the Milo
icon on your home screen. Tap **Copy** instead and get the link onto the iPhone
without opening it: paste it into Notes, or just paste on the iPhone (the
clipboard is shared between devices on the same Apple ID). AirDrop and tapping
the link in a message both open it in Safari, so don't use those; in a message,
long-press the link and choose Copy. Then paste it in Milo → Settings → *Sync
across your devices* → **Connect**. Both devices then keep themselves up to
date.

### What to know about it

- **The sync code is the password.** Those rules let anyone who knows the code
  read and write that one path — and nobody who doesn't. Guessing it is not
  realistic (24 random characters), but don't post the QR anywhere public. To
  revoke it, turn sync off on both devices and turn it back on: you get a new
  code, and the old data can be deleted from the Firebase console. There are
  two entries per code under `u`: `<code>m5` is the current one, and `<code>`
  (without the suffix) holds the data from before the September 2026 update,
  kept read-only while older copies of the app catch up.
- **Your devices are never overwritten, they're merged.** Sessions logged on two
  devices are combined, an edit beats an older copy, a deleted session stays
  deleted instead of coming back from the other device, and each setting syncs
  on its own (changing the rest timer on the phone won't undo a routine chosen
  on the laptop). Removing things is the one exception: with sync on, "reset"
  and "replace from backup" only clear this device, because the others still
  have the sessions and merge them back.
- **A device that falls behind stops instead of damaging anything.** If the
  cloud holds data from a newer version of the app, an older copy pauses
  syncing and asks to be reloaded rather than write over it; the same goes for
  a cloud copy it can't read (Settings then offers to replace it).
- **Offline is unchanged.** `localStorage` is still the real store. Without a
  network the app behaves exactly as before and catches up when it reconnects.
- **It costs nothing to leave on.** A day of training is a handful of requests
  against an allowance of 10 GB of downloads a month.

## Check your changes

```bash
sh tests/run.sh
```

It runs every check twice (Italian and US time, because date bugs hide in the
daylight-saving weeks) and ends with "All tests passed." The checks cover what
gets stored on load, how two devices merge, that every file the page needs is
available offline, and that a release is ready to ship. They need Node.js —
this Mac has it; on another computer, if `node --version` prints nothing,
install it from nodejs.org.

## Update the live site

Every release gets a new build number: one higher than the current one (the
`VERSION` at the top of `sw.js`; the tests tell you the right number if you
forget). Four steps:

```bash
sh tools/set-build.sh milo-v20
```

```bash
git add -A
```

```bash
sh tests/run.sh
```

```bash
git commit -m "describe what changed" && git push
```

`git push` sends it to [Michele-Minervini/milo](https://github.com/Michele-Minervini/milo),
and the site updates itself in about a minute. An installed copy takes **two
opens** to switch: the first open, online, downloads the new release in the
background while still showing the old one; the next open shows it. On an
iPhone: open the app, wait a few seconds, swipe it away in the app switcher,
open it again. Settings → More shows which build a device is running.
**Skipping the build number means phones never update**, because the app is
served from an offline copy that only changes when the number does — the tests
catch that before you push.

## Moving from the old address

Until September 2026 the app lived at
`https://michele-minervini.github.io/calisthenics-tracker/`. Once the move is
finished, that address is served by a separate, tiny repository,
[Michele-Minervini/calisthenics-tracker](https://github.com/Michele-Minervini/calisthenics-tracker)
(the local folder is `~/Documents/Projects/calisthenics-tracker-redirect`).
Never push Milo there.

- **In a browser tab** the old address forwards here, sync links included.
  Browser tabs share their saved data with the new address (same site), so
  nothing needs moving: just update the bookmark.
- **An app installed from the old address** (the iPhone home-screen icon, a Mac
  Dock app) keeps its own saved data, separate from everything else. It shows a
  "Milo has moved" page with what it still holds, a backup button, its sync
  link and these steps:
  1. In the old app: save a backup file (on the iPhone, Save to Files).
  2. In Safari, open https://michele-minervini.github.io/milo/ → **•••** (or
     Share) → **Share** → **Add to Home Screen** (turn **Open as Web App** on if
     it's shown) → **Add**.
  3. Back in the old app, copy the sync link. Open the new icon; on the Today
     tab, tap **Connect sync**, paste the link and tap **Connect**.
  4. If the old app said some changes may not have reached the cloud (or sync
     was off there), also open ⚙️ Settings → **Restore from file** in the new
     icon, pick the backup and tap **OK** to merge it.
  5. Check that your workouts and skill steps are there. Put the phone in
     Airplane Mode, swipe Milo away and open it again: it must still load.
  6. **Only then** delete the old icon — deleting it deletes the data saved in it.
- **A Chrome-installed app** shares its data with Chrome, so the new address
  already has it. When uninstalling the old one, leave **Remove this app's data
  from Chrome** unticked: it would delete the data of the whole site, the new
  Milo included.

## Ideas for later (v3+)

- Progress history charts (a timeline of when you climbed each step; a "ghost"
  radar of where you were months ago).
- Weekly routine templates with per-day checklists and a "Today" view.
- Consistency calendar / streaks; QR code for device transfer; reminders.
