<div align="center">

# Azure DevOps Sync for Obsidian

**Bring your Azure DevOps work items into your Obsidian vault as richly formatted, sync-able notes.**

[![Version](https://img.shields.io/badge/version-0.0.1-blue?style=flat-square)](./manifest.json)
[![Obsidian](https://img.shields.io/badge/Obsidian-1.0%2B-7c3aed?style=flat-square&logo=obsidian&logoColor=white)](https://obsidian.md)
[![Platform](https://img.shields.io/badge/platform-desktop-lightgrey?style=flat-square)]()
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](./LICENSE)

</div>

---

## Features

| | |
|---|---|
| **Create** | Generate a note from any work item by ID |
| **Sync** | Refresh an open note with the latest data from DevOps |
| **Import** | Bulk-import every work item from a sprint/iteration |
| **Sync All** | Re-sync all existing iteration notes in your vault at once |

Notes are organized by year and ISO week (`{folder}/2026/W22/`) and use YAML frontmatter so Obsidian's metadata cache can query them. A fenced sync block inside each note is updated on every sync while preserving any personal notes you've added outside it.

## Commands

All commands are available via the Command Palette (`Ctrl/Cmd+P`):

| Command | Description |
|---|---|
| `Create Work Item Note` | Prompt for an ID and create a new note |
| `Sync Current Work Item` | Sync the note currently open in the editor |
| `Import All Work Items from Iteration` | Prompt for an iteration path and import all items |
| `Sync All Work Items from Iteration (existing notes)` | Re-sync notes that already exist in the vault |

A ribbon icon (cloud download) is also added for quick one-click syncing.

## Configuration

Go to **Settings → Azure DevOps Sync** and fill in the following:

| Setting | Description |
|---|---|
| Personal Access Token | A DevOps PAT with **Work Items (Read)** scope |
| Organization | Your Azure DevOps organization name (e.g. `my-org`) |
| Project | The project to query work items from |
| Assigned To User | Filter imported items by assignee (optional) |
| Save Folder | Vault folder where notes will be saved |

> **Tip:** Generate a PAT at `https://dev.azure.com/{org}/_usersSettings/tokens`. Only the **Work Items (Read)** scope is required.

## Building

### Prerequisites

- [Node.js](https://nodejs.org) 18+
- PowerShell 7+ (Windows deploy script only)

### Development

```powershell
npm install
npm run dev
```

### Deploy to a vault

Pass the vault root (the folder that contains `.obsidian`) to the deploy script for your platform. The script installs dependencies, produces a production build, and copies `main.js` and `manifest.json` into the correct plugin subfolder.

**Windows (PowerShell)**

```powershell
.\build.ps1 -VaultDir "C:\path\to\vault"
```

**Linux / macOS**

```bash
chmod +x build.sh
./build.sh "/path/to/vault"
```

After deploying, reload Obsidian or toggle the plugin off and back on under **Settings → Community plugins**.

## Note Structure

Each generated note contains:

- **YAML frontmatter** — `devops_id`, `title`, `state`, `type`, `priority`, `assigned_to`, `area_path`, `iteration_path`, `tags`
- **DevOps Info section** — a fenced sync block that is fully replaced on each sync
- **Personal Notes section** — a free-form area that is never touched by the plugin

## License

[MIT](LICENSE) © Cristof Rojas