# Installing and updating TreeTracker on your Android phones

TreeTracker is not in the Google Play Store. GitHub builds it for you, and you install the file (an `.apk`) straight onto each phone. Do these steps once on each of the two phones.

## What you need

- An Android phone running Android 7 or newer.
- A web browser on the phone (these steps use Chrome).
- Your GitHub sign-in, if the repository is private.

## 1. Download the app

1. On the phone, open Chrome.
2. Go to **github.com/nuttynootka/Treetracker**. If GitHub asks you to sign in, sign in.
3. Find **Releases**.
   - On a phone, scroll down past the file list and the "About" box. There is a **Releases** heading with **TreeTracker (latest build)** under it. Tap that.
   - If you see a desktop-style page, **Releases** is in the right-hand column.
4. On the release page, scroll to **Assets**. Tap the file whose name starts with **TreeTracker-1.0.** and ends with **.apk**. Do not tap "Source code".
5. Chrome may warn that "this type of file can harm your device". Tap **Download anyway**.

## 2. Allow the install (first time only)

Android blocks apps that don't come from the Play Store until you allow the app you downloaded with (here, Chrome).

1. When the download finishes, tap **Open** in the bar at the bottom of Chrome. You can also open it from Chrome's menu (⋮) → **Downloads**.
2. If Android says your phone "is not allowed to install unknown apps from this source", tap **Settings**. Turn on **Allow from this source**, then press the back button.
3. If that message doesn't appear and nothing installs, set it by hand:
   - Most phones: **Settings → Apps** (or **Apps & notifications**) **→ Special app access → Install unknown apps → Chrome →** turn on **Allow from this source**.
   - Samsung phones: **Settings → Security and privacy → More security settings → Install unknown apps → Chrome →** turn it on.
   - Menu names differ a little between phone makers. If you can't find it, search the Settings app for **unknown apps**.

## 3. Install and open

1. Tap **Install**.
2. Google Play Protect may say it doesn't recognise the app. That happens because the app isn't from the Play Store. Choose the option to install anyway. On some phones that option is under **More details**.
3. Tap **Open**. The main screen shows **Next 3 trees to cut**.
4. Tap **Settings** at the bottom of the main screen. In **This phone's name**, type a name such as "Jess's phone", then tap **Save settings**. The name is used in the sync files, so you can tell which phone a file came from.

Do sections 1 to 3 on the second phone as well.

## 4. Keep the two phones in step (sync)

Each phone works on its own, with no signal needed. To make both phones show the same trees and logs:

1. On phone A, tap **Sync → Export sync file**. Android's share menu opens. Send the file to phone B any way you like: a text message, email, Google Drive, Bluetooth or Quick Share.
2. On phone B, save or download the file you received. Then tap **Sync → Import sync file** and choose that file. You'll see a line like "Imported: 3 added, 1 updated, 0 deleted".
3. Now do the same the other way: export on phone B and import on phone A.

If the same entry was changed on both phones, the newer change wins. Deletions also travel across. Importing the same file twice changes nothing.

## 5. Updating to a newer build

Every time new code is pushed to GitHub, a fresh APK is built and replaces the **TreeTracker (latest build)** release. To update:

1. **First make a backup:** on the phone, tap **Sync → Export sync file** and send the file somewhere safe, such as your email or Drive.
2. Download the new `.apk` exactly as in section 1, and tap **Install**. Android installs it over the old app.
3. Your trees and logs stay, because every build is signed with the same key. That key is stored in this repository on purpose.

## What erases your data

TreeTracker keeps everything on the phone itself. These actions erase it:

- Uninstalling the app.
- **Settings → Apps → TreeTracker → Storage → Clear storage** (or **Clear data**).

If either happens, reinstall the app and import your latest sync file, or import a file exported by the other phone.

## If the GitHub build fails

1. Open the repository on GitHub and tap the **Actions** tab. On a phone, you may need the ⋯ menu or "View all" to see it.
2. Each build shows a green ✓ (worked) or a red ✗ (failed). Tap a failed build to see which step went wrong.
3. To try again, open the failed run and tap **Re-run jobs** → **Re-run all jobs**. If it fails again, tell Claude which step failed.
