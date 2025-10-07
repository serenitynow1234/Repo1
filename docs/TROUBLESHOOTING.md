# Troubleshooting PR creation errors

## "Binary files are not supported" when creating a PR

The automated review tools that receive pull requests from this repository reject commits that contain binary blobs. The original version of the extension tracked the PNG icon files directly under `assets/`, so attempting to open a pull request triggered the "binary files are not supported" validation error.

### Fix

The PNG icons are now generated locally from embedded Base64 payloads instead of being checked in as binary assets. Run:

```bash
node scripts/generate-icons.js
```

before loading the unpacked extension so the icons exist on disk but remain untracked. This keeps the repository PR-friendly while still producing the assets Chrome requires.
