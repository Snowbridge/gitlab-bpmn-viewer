# Privacy Policy — GitLab BPMN Viewer

**Last updated:** February 2026

## Overview

GitLab BPMN Viewer is a browser extension that adds BPMN diagram visualization to GitLab (blob view, merge request diffs, and context menus). This policy describes what data the extension handles and where it is stored or sent.

## Data the extension stores

- **GitLab host names** and **GitLab API tokens (Private Token)** that you enter in the extension options. These are stored **only in your browser’s local extension storage** (`storage.local`). They are not sent to the developer’s servers or any third party.

## Data the extension sends

- **API requests** are made **only to the GitLab hosts you have configured**. Your token is sent only in the `PRIVATE-TOKEN` header to those GitLab instances (e.g. `gitlab.com` or your self‑hosted GitLab) to load repository file contents (e.g. `.bpmn` files) and merge request metadata. No data is sent to the extension author or to any server other than the GitLab host(s) you added.

## What we do not do

- We do **not** collect, store, or transmit your data on our own servers.
- We do **not** use analytics or tracking.
- We do **not** sell or share your data with third parties.

## Your control

- You can add or remove hosts and tokens at any time in the extension options. Removing a host stops any further requests to that host.
- Uninstalling the extension removes all data stored in the extension’s local storage.

## Contact

If you have questions about this privacy policy, open an issue in the [project repository](https://github.com/leo-sadovsky/gitlab-bpmn-viewer) or contact the developer at the support channel indicated in the extension’s store listing.
