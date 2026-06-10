# Gopeed Extension: FuckingFast

Resolve FuckingFast file pages into direct download tasks in Gopeed.

## Install

1. Open Gopeed.
2. Go to Extensions.
3. Click Manual Install.
4. Paste:

`https://github.com/Tonikkl/gopeed-extension-fuckingfast`

5. Click the install/download button.

## Usage

Create a Gopeed task with a `fuckingfast.co` file page URL.

The extension handles both Gopeed paths:

- `onResolve` returns the direct `dl.fuckingfast.co` file for preview and resolution.
- `onStart` rewrites direct-created tasks before the HTTP downloader starts, so Gopeed downloads the file instead of the HTML page.

## Settings

- `Cookie`: optional site cookie for pages that require a browser session.
- `User-Agent`: optional browser user agent for resolving pages.

## Troubleshooting

If Gopeed still saves a tiny HTML file, remove the old task and create a fresh task after reinstalling or updating the extension. Check `storage/logs/extension.log` for `fuckingfast start rewrite`.

## Release Notes

- `0.3.0`: add `onStart` rewrite for direct-created Gopeed tasks.
