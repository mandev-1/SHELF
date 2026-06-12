# Releasing a new version

Releases are tag-driven. Pushing a git tag `v<version>` makes GitHub Actions
(`.github/workflows/release.yml`) rebuild the extension from source and publish a
GitHub Release with the `.zip` and `.tar.gz` attached:
https://github.com/mandev-1/SHELF/releases

## Cutting a release

1. **Bump + build locally**

   ```sh
   npm run release:new
   ```

   This bumps the patch version in `package.json` and `public/manifest.json`, runs the
   build, copies the bundle into `releases/<version>/`, and creates
   `releases/<version>.zip` / `.tar.gz`.

   For a minor/major bump instead of a patch, pass the version explicitly:

   ```sh
   RELEASE_VERSION=1.1.0 npm run release:new
   ```

2. **Commit** the version bump and the new `releases/<version>/` folder:

   ```sh
   git add -A && git commit -m "release 1.0.13"
   ```

3. **Tag and push.** The tag must be exactly `v` + the version now in `package.json`:

   ```sh
   git tag v1.0.13
   git push && git push origin v1.0.13
   ```

CI takes it from there — it verifies the tag, runs `npm ci`, rebuilds the same version
with `npm run release:rebuild`, and attaches the archives to the GitHub Release.

## Guard rails

- The workflow **fails fast if the tag doesn't match `package.json`'s version** — this
  catches typos like tagging `v1.12.0` when the version is `1.0.12`.
- `npm run release:rebuild` re-packages the current version without bumping, if you
  ever need to rebuild locally.
- Keep `package.json`, `public/manifest.json`, and the `releases/<version>/` folder in
  sync by always going through `npm run release:new` rather than hand-editing versions.
