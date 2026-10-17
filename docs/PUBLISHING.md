# Publishing to Google Play

The app ships as a Capacitor Android wrapper around the web build. Store text and graphics are in [`docs/store/`](store/LISTING.md); the privacy policy is [`public/privacy.html`](../public/privacy.html) and is bundled at `/privacy.html`.

## One-time setup

1. **Upload key.** In `android/`:

   ```sh
   keytool -genkeypair -v -keystore snatchy-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
   ```

   Back up the `.jks` file and passwords outside the repository; losing them means asking Google to reset the upload key.

2. **Release properties.** Copy `android/release.properties.example` to `android/release.properties` (git-ignored) and fill in the keystore fields and your AdMob **app ID** (`ca-app-pub-…~…`).

3. **AdMob banner unit.** Create `.env.production.local` (git-ignored) in the project root:

   ```sh
   VITE_ADMOB_BANNER_ID=ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY
   ```

   Without a valid unit ID the app serves Google **test** ads and labels them as such, so development builds can never request live ads.

4. **Consent message.** In AdMob → Privacy & messaging, create and publish a GDPR consent message (and a US-states message if you serve the US). The app shows it through Google's consent SDK before requesting any ad, and offers _Settings → Ad privacy choices_ when Google requires it. Ads are always requested as non-personalised (`npa`).

## Each release

1. Bump `version` in `package.json` (semver). Android derives `versionName` from it and `versionCode` as `major × 10000 + minor × 100 + patch`, so every bump uploads cleanly. Update `src/version.ts` to the same version (a unit test checks they match).
2. `npm run check:all`
3. `npm run build && npx cap sync android`
4. Build the bundle with a JDK 17–21 (Android Studio's bundled JBR works):

   ```sh
   cd android && ./gradlew bundleRelease
   ```

   Output: `android/app/build/outputs/bundle/release/app-release.aab`, signed with the upload key from `release.properties`.

5. Upload to a Play Console testing track first and install from the store on a real device before promoting.

## Before the first public release

- Test on two or three physical phones, including a mid-range one: time a 10 s and a 30 s analysis, check memory with 1080p video, recording through the camera, gallery import of large files, rotation, back button and dark mode.
- New personal developer accounts must run a closed test with at least 12 testers for 14 consecutive days before applying for production access.
- Data safety form: no data collected or shared by Snatchy itself; the AdMob SDK collects device or other IDs (advertising ID), approximate location, app interactions and diagnostics for advertising, fraud prevention and analytics; data in transit is encrypted; users can delete data by removing recordings or uninstalling.
- Declare "Contains ads", complete the content rating questionnaire, set the target audience to 13+ (or 18+), and do not target children.
- Host `privacy.html` at a public URL (for example GitHub Pages or the web deployment of this app) and enter that URL in the Play Console.
- Publish `app-ads.txt` on the developer website listed in the Play Console.
