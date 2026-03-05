## Short description

GitLab BPMN Viewer renders BPMN diagrams directly in GitLab and makes reviewing process models in merge requests painless for development and business teams.

## Full description

GitLab BPMN Viewer is a browser extension that turns raw `.bpmn` XML files in GitLab into interactive BPMN diagrams.  
It is designed for teams that store business processes as BPMN files inside GitLab and want a smooth review experience without switching to external desktop tools.

### Features

- **BPMN preview in GitLab**  
  On GitLab blob pages for `.bpmn` files, the extension replaces raw XML with an interactive BPMN diagram based on `bpmn-js`.  
  Reviewers can inspect the process visually instead of reading XML.

- **BPMN diff in merge requests**  
  On GitLab merge request “Changes” pages, the extension adds a BPMN diff view for changed `.bpmn` files.  
  It loads the source and target versions and shows them side by side as diagrams, helping reviewers see exactly what changed in the process model.

- **GitLab API integration with personal access token**  
  The extension uses a GitLab personal access token configured by the user in the extension settings.  
  This token is used to call the GitLab REST API and fetch the BPMN file content for both single‑file view and diagram diff, including on self‑managed GitLab instances.

### Getting started

1. **Install the extension** from the store.  
2. **Open the extension options page** and add one or more GitLab hosts (for example, `gitlab.com` or your self‑managed instance like `git.example.com`).  
   For each host, provide a personal access token with permissions sufficient to read repository contents.  
3. **Open a GitLab project that contains `.bpmn` files**:
   - On a blob page for a `.bpmn` file, the extension will show the BPMN diagram instead of raw XML and let you switch between diagram and source.
   - On a merge request “Changes” tab, additional BPMN buttons will appear for changed `.bpmn` files to open a visual diff (old vs new version) in a modal dialog.

If the current page host is not configured in the extension options, the extension stays inactive and does not modify the GitLab UI.

### Permissions and why they are needed

- **`storage`**  
  Used to store extension settings, including the list of GitLab hosts and their access tokens configured by the user.

- **`activeTab`**  
  Allows the extension to interact with the currently active GitLab tab when the user opens BPMN views or diffs.

- **`tabs`**  
  Required to inspect the URL of open GitLab tabs to detect supported pages (blob, tree, merge requests) and decide whether BPMN functionality should be activated.

- **`webNavigation`**  
  Used to react to GitLab’s client‑side navigation (SPA‑style routing) and re‑apply BPMN integration when the user switches between pages without a full reload.

The extension also requests host permissions for GitLab URLs so it can inject content scripts on relevant GitLab pages and call the GitLab REST API to load BPMN files.

## Category and tags

- **Category**: Productivity / Developer Tools  
- **Suggested tags**: `GitLab`, `BPMN`, `Business Process`, `Code Review`, `Diagrams`, `Developer Tools`, `Productivity`

## Why host permissions are broad

The extension is explicitly designed to work not only with `gitlab.com` but also with self‑managed and on‑premise GitLab instances.  
Because of this, the exact hostnames cannot be hard‑coded in advance in the manifest: the user may want to use the extension with any internal GitLab domain (for example, `gitlab.company.local`).

To support this, the manifest declares relatively broad host patterns that technically can match many domains.  
However, **at runtime the extension is additionally restricted by its own configuration**:

- The extension activates its BPMN functionality **only on hosts that the user has explicitly added in the extension options**.  
- For any other hosts, the extension does not inject BPMN UI elements, does not call the GitLab API and effectively stays idle.

This design lets teams use the extension safely with private, self‑managed GitLab instances while still limiting real activity to the set of hosts that the user has configured manually.

