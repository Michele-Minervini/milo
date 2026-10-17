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

- **Today.** Today's plan (from your weekly plan: a gym split or a skills
  routine), one tip about the muscle group that needs it most, and the week
  at a glance: which days you trained (a dot per muscle group) and six bars of
  hard sets per group against their weekly targets.
- **A weekly plan for the gym.** In Settings → Weekly plan, pick a split:
  **5 days** (legs · back + shoulders · chest · arms · abs), **6 days**
  (shoulders · chest · back · arms · legs · abs) or **Push / Pull / Legs**
  (each twice a week). Today then shows the day you are on, its exercises —
  each with its sets, its rep range and the weight to use — and about how
  long it takes. Nothing about the plan is stored except the split's name:
  Milo works out which day each training date was from what you logged, so
  the next day is simply the one after the last you trained (skip a day or
  train out of order and it carries on from there), and each day lists what
  you did the last two times you trained it, so changing an exercise changes
  the plan. Before a day has a history it starts from a short list.
  **Different day** picks another day for today; **＋ Another exercise** adds
  one. In a gym exercise, **Save →** goes to the plan's next exercise that
  still has sets to do — round after round if you do one set of each, which
  is how a circuit is logged.
- **Gym or Bodyweight.** Today's plan has a switch for when you are away from
  a gym. **Bodyweight** keeps the split and the day you are on, and lists what
  needs no equipment: the skills whose main muscle group is one of the day's,
  at the step you are on (the guided session walks you through them), then
  bodyweight exercises — the ones you did on that day's last two sessions
  without equipment, or a starting list (push-ups, pull-ups, dips, pike
  push-ups, lunges, calf raises, a wall sit…). A session that used equipment
  belongs to gym mode and one that used none to bodyweight mode, so each
  keeps its own list and your gym exercises are there when you switch back.
  Which day a date was is the same in both modes — skill sessions count for
  the day they train — so switching never moves the day. The mode is saved
  and synced.
- **Body.** This week's hard sets for chest, back, shoulders, arms, abs and legs
  — Monday to Sunday, against a target of 10–20 sets (20–40 for arms and legs,
  which are several muscles each; change it in Settings) — with where an even
  pace would put you by today, how you compare with this point last week, and a
  balance radar. Skill sessions count too: a set of push-ups is one set for
  chest and half a set for arms and shoulders. Each group's card names the gym
  exercise you train it with most and its latest top set. Tap a group for what
  counted, its last 8 weeks, its gym exercises and the skills that train it.
  The ⓘ explains the counting. At the top, a **Body weight** card (see
  Weigh-ins below).
- **Progress, group by group.** Hard sets say how much you did; progress says
  whether it got harder. Each group's card on Body shows how many of its gym
  exercises went **up on last time** this week: a heavier top weight, or the
  same weight with more reps on the same sets (each exercise's latest session
  this week against its last one before this week; after more than 6 weeks
  off there is nothing to compare). The group's sheet lists them, shows the
  **kilos lifted** (kg × reps over the weighted sets — a number to look at,
  not a target: it can't be compared between exercises, and lighter sets of
  more reps raise it without being harder) and a **strength line** over 8
  weeks: the average change of the exercises you repeated, each against
  itself, starting at 100.
- **Skills.** The six-axis radar, ten rings deep — your current step in every
  ladder — and a card per ladder with what's next. Tap an area (chart or card)
  for its ten steps; tap a dot to jump straight to your current exercise. Every
  step shows short instructions, Beginner / Intermediate / Progression rep
  goals, tips for when it's too hard, and a demo-video link.
- **History.** Workouts this week, your week streak (weeks in a row with 2 or
  more workouts) and your total; a month calendar with a dot per muscle group
  trained; your **records** of the last 30 days (tap for the whole list, with
  the skill milestones); and every workout by day (All / Gym / Bodyweight),
  with a 🏆 on the set that was a record. Tap an entry to change or delete it.
- **＋ Log.** Today's session moves in one tap, any other skill, a **gym
  exercise**, a **quick gym log** (just the working sets per muscle group,
  when you don't want to log exercises), or a **weigh-in**.
- **Gym exercises.** About 60 exercises (barbell, dumbbells, machines, cables,
  push-ups, pull-ups, dips, abs work — including a timed floor circuit that
  rests 20 seconds instead of the usual gym rest…) plus your own. Log each set as reps × kg and tick it:
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
- **Records.** When a set beats everything you did before in that exercise,
  Milo says so as you tick it and marks it with a 🏆. With weights a record is
  *a heavier weight than ever, in a proper set*: no more than two reps short
  of the bottom of the exercise's range (at least 6 for an 8–12 exercise), so
  a heavy single doesn't count, and more reps at the same weight isn't one
  either. While you log, the sheet says what there is to beat. Without
  weight it is more reps in one set than ever, or — for a hold — reaching the
  next 5 seconds. Warm-ups never count, and the first day of an exercise only
  sets the mark to beat. Records are worked out from the log every time and
  never stored, so logging a forgotten session for an earlier day, or changing
  an exercise's rep range, can move them — and every device agrees.
- **A chart for every exercise.** The ⓘ next to an exercise's name opens its
  sheet: your numbers, a line chart of the last 20 sessions and your records.
  For weights the line is the **estimated 1-rep max** of the day's best set
  (Epley: kg × (1 + reps ÷ 30), reps counted up to 20) — it rises with more
  weight *or* more reps, and often dips on the day you go up in weight. For
  ranges above 15 reps it is the top weight instead; for added weight
  (pull-ups, dips) the top added weight; for an assisted machine the least
  help; for bodyweight exercises the most reps; for holds the longest one.
- **Weigh-ins.** Body weight in kg, and your waist in cm if you like, about
  once a week (＋ Log → Weigh-in, or the Body weight card). Body shows the
  latest weight and the change since the one before; its sheet adds the change
  over about a month, a 7-day average when you weigh in three or more days a
  week, your waist, a chart of up to 12 weeks, and your 12 latest weigh-ins
  to edit (older ones are in History, under All). A
  week after the last one, Today offers the next (for two weeks, then it stops
  asking). Changes are plain signed numbers, never green or red: neither
  direction is good or bad by itself. One weigh-in per day on a device:
  saving again for a day changes that day's (two devices that each save one
  before syncing keep both, and the later one is the day's value).
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
  Each skill step also shows a top-set sparkline over time.
- **A countdown for timed sets.** A gym exercise logged in seconds has a **▶**
  on each set of today's sheet: 5 seconds to get ready, then the seconds in
  the box count down on a big clock (once for each side, with 3 seconds to
  switch, for the two "each side" exercises). At zero the set is ticked and
  saved and the rest starts. **Stop** puts the seconds you got to in the box
  without logging them; **Pause** holds the clock. With **Hands-free** ticked
  (it is, until you untick it in the sheet) Milo counts the rest too and
  carries on by itself: round the six-exercise abs circuit, one set of each
  and then round again until each has as many sets as last time (3 the first
  time), or the next set of any other timed exercise. Every step beeps and,
  with the rest notification on, sends the banner that makes an iPhone buzz.
  It runs only while Milo is on screen, so the screen is kept on; if the app
  goes to the background the clock pauses and waits for Resume. A reload ends
  it (the sets it ticked are already saved).
  **Hold till failure** counts up instead: after the 5 seconds the clock runs
  from 0 with no end, beeps (and, with the notification on, buzzes) when you
  pass the number in the box, and the big button is **Done ✓** — tap it when
  you can't hold any longer and the seconds you held are logged, then the rest
  and hands-free go on as for any set. Which exercises count up is a list in
  data.js (`GYM_TO_FAILURE`).
- **Week in review.** From Monday, Today offers last week at a glance (and
  History has it any time, stepping back week by week): training days, hard
  sets, records and body weight against the average of the four weeks before;
  up to four notes for next week (groups under or past their target, an
  exercise with no step up in three sessions, a group not trained for over 10
  days, a weigh-in overdue); hard sets per group against the target, a 12-week
  grid of every group, which gym exercises went up, each group's strength over
  12 weeks, the main lifts' charts, training days a week over 26 weeks, when
  you train (weekday by part of the day), and body weight. All worked out on
  the phone from the log (`TRAINING.weekReport`); nothing is stored.
- **Body weight in pull-ups, chin-ups and dips.** Once you have weighed in,
  their chart is the estimated 1-rep max with your body in — your weight that
  day plus what you added — so sets with and without added weight sit on one
  line, and the back and chest strength lines compare them the same way.
- **Set times.** A timed exercise whose range is one number is done for
  exactly that long, and Milo never raises it by itself: the six of the abs
  circuit come that way (40 seconds, 20 a side). Its sheet has **Seconds per
  set** with − and + (5 seconds at a time, or type any number from 5 to 600),
  and **The circuit** (in any timed exercise) shows the exercises hands-free
  goes round: change their order, take one out, add any timed exercise, set
  each one's seconds and the rest between sets. A time is that exercise's own
  range, saved and synced like any change to an exercise; the circuit and its
  rest are settings (data v7), synced too. Give a timed exercise two different numbers (ⓘ → Fewest and
  Most) and Milo builds its time up again, 5 seconds a session.
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
- **Week plan** (the link on Today's card). The whole rotation at a glance.
  For a gym split: each day with its exercises and when it was last trained,
  and "Do this today" to switch. For a skills routine: what each area needs
  next and the rungs beyond it.
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
