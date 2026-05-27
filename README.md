# obsidian-azure-devops

An [Obsidian](https://obsidian.md) plugin that syncs Azure DevOps work items as notes in your vault. You can create notes from individual work items, sync updates back from DevOps, or bulk-import all work items from a sprint/iteration.

## Features

- Create a note from any Azure DevOps work item by ID
- Sync an existing work item note with the latest data from DevOps
- Import all work items from a given iteration into your vault
- Sync all existing work item notes in the vault for an iteration
- Configurable folder path, status/priority mappings, and PAT-based authentication

## Configuration

In Obsidian, go to **Settings → Azure DevOps Sync** and fill in:

| Setting | Description |
|---|---|
| Personal Access Token | A DevOps PAT with **Work Items (Read)** scope |
| Organization | Your Azure DevOps organization name |
| Project | The project to query work items from |
| Assigned To User | Filter work items by assigned user (optional) |
| Save Folder | Vault folder where notes will be saved |

## Building

### Prerequisites

- [Node.js](https://nodejs.org) 18+
- PowerShell 7+ (for the deploy script)

### Development build

```powershell
npm install
npm run dev
```

### Production deploy to a vault

Pass the vault root (the folder that contains `.obsidian`) to the appropriate script for your OS.

**Windows (PowerShell)**
```powershell
.\build.ps1 -VaultDir "C:\path\to\vault"
```

**Linux / macOS**
```bash
chmod +x build.sh
./build.sh "/path/to/vault"
```

Both scripts install dependencies, run a production build, and copy `main.js`, `manifest.json`, and `styles.css` into the correct plugin subfolder. Reload Obsidian (or toggle the plugin off/on) after running.

