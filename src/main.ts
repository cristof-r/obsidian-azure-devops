import { Plugin, Notice, TFile, MarkdownView } from "obsidian";
import { DevOpsSyncSettingTab, DEFAULT_SETTINGS } from "./settings";
import type { DevOpsSyncSettings } from "./settings";
import { DevOpsClient } from "./devops-client";
import {
	generateWorkItemNote,
	syncWorkItemNote,
	buildFilePath,
	findExistingNote,
} from "./work-item-note";

export default class DevOpsSyncPlugin extends Plugin {
	settings: DevOpsSyncSettings = DEFAULT_SETTINGS;

	async onload() {
		await this.loadSettings();

		// Command: Create work item note
		this.addCommand({
			id: "create-work-item-note",
			name: "Create Work Item Note",
			callback: () => this.createWorkItemNote(),
		});

		// Command: Sync current work item
		this.addCommand({
			id: "sync-current-work-item",
			name: "Sync Current Work Item",
			callback: () => this.syncCurrentWorkItem(),
		});

		// Command: Import iteration work items
		this.addCommand({
			id: "import-iteration-work-items",
			name: "Import All Work Items from Iteration",
			callback: () => this.importIterationWorkItems(),
		});

		// Command: Sync all iteration work items in vault
		this.addCommand({
			id: "sync-iteration-work-items",
			name: "Sync All Work Items from Iteration (existing notes)",
			callback: () => this.syncIterationWorkItems(),
		});

		// Ribbon icon
		this.addRibbonIcon("cloud-download", "Sync DevOps Work Item", () =>
			this.syncCurrentWorkItem()
		);

		// Settings tab
		this.addSettingTab(new DevOpsSyncSettingTab(this.app, this));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private getClient(): DevOpsClient | null {
		const { pat, organization, project } = this.settings;
		if (!pat || !organization || !project) {
			new Notice("Configure PAT, organization, and project in DevOps Sync settings first.");
			return null;
		}
		return new DevOpsClient(pat, organization, project, this.settings.debugLogging);
	}

	private async createWorkItemNote() {
		const client = this.getClient();
		if (!client) return;

		// Prompt for work item ID
		const input = await this.promptForId();
		if (input === null) return;

		const id = parseInt(input);
		if (isNaN(id) || id <= 0) {
			new Notice("Invalid work item ID.");
			return;
		}

		// Check if note already exists
		const existing = await findExistingNote(this.app, id);
		if (existing) {
			await this.openOrLinkFile(existing, `Work item #${id} note already exists — opened it.`);
			return;
		}

		try {
			new Notice(`Fetching work item #${id}...`);
			const item = await client.getWorkItem(id);

			const filePath = buildFilePath(item, this.settings);
			const content = generateWorkItemNote(item, this.settings);

			// Ensure folder exists
			const folder = filePath.substring(0, filePath.lastIndexOf("/"));
			await this.ensureFolderExists(folder);

			const file = await this.app.vault.create(filePath, content);
			await this.openOrLinkFile(file, `Created note for ${item.type} #${item.id}`);
		} catch (e) {
			console.error("[DevOps Sync] createWorkItemNote failed", e);
			new Notice(`Failed to fetch work item #${id}: ${(e as Error).message}`);
		}
	}

	private async syncCurrentWorkItem() {
		const client = this.getClient();
		if (!client) return;

		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice("No active file.");
			return;
		}

		const cache = this.app.metadataCache.getFileCache(activeFile);
		const devopsId = cache?.frontmatter?.devops_id;
		if (!devopsId || typeof devopsId !== "number") {
			new Notice("This note is not linked to a DevOps work item (no devops_id in frontmatter).");
			return;
		}

		try {
			new Notice(`Syncing work item #${devopsId}...`);
			const item = await client.getWorkItem(devopsId);
			await syncWorkItemNote(this.app, activeFile, item, this.settings);
			new Notice(`Synced: ${item.type} #${item.id} — ${item.state}`);
		} catch (e) {
			console.error("[DevOps Sync] syncCurrentWorkItem failed", e);
			new Notice(`Sync failed: ${(e as Error).message}`);
		}
	}

	private async openOrLinkFile(file: TFile, noticeText: string): Promise<void> {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (activeView) {
			const editor = activeView.editor;
			const cursor = editor.getCursor();
			editor.replaceRange(`[[${file.basename}]]`, cursor);
			new Notice(`${noticeText} — linked at cursor.`);
		} else {
			await this.app.workspace.getLeaf('tab').openFile(file);
			new Notice(noticeText);
		}
	}

	private async promptForId(): Promise<string | null> {
		return this.promptForText("Enter Work Item ID", "e.g. 19943", "Create Note");
	}

	private async promptForText(title: string, placeholder: string, buttonText: string): Promise<string | null> {
		return new Promise((resolve) => {
			const modal = new (class extends (require("obsidian") as typeof import("obsidian")).Modal {
				result: string | null = null;

				onOpen() {
					const { contentEl } = this;
					contentEl.createEl("h3", { text: title });

					const input = contentEl.createEl("input", {
						type: "text",
						placeholder,
					});
					input.style.width = "100%";
					input.style.marginBottom = "1em";
					input.focus();

					input.addEventListener("keydown", (e: KeyboardEvent) => {
						if (e.key === "Enter") {
							this.result = input.value.trim();
							this.close();
						}
						if (e.key === "Escape") {
							this.close();
						}
					});

					const btnContainer = contentEl.createDiv({ cls: "modal-button-container" });
					const btn = btnContainer.createEl("button", { text: buttonText, cls: "mod-cta" });
					btn.addEventListener("click", () => {
						this.result = input.value.trim();
						this.close();
					});
				}

				onClose() {
					resolve(this.result);
				}
			})(this.app);

			modal.open();
		});
	}

	private async importIterationWorkItems() {
		const client = this.getClient();
		if (!client) return;

		const iterationPath = await this.promptForText(
			"Enter Iteration Path",
			"e.g. Casablanca\\Frontend\\Sprint 133",
			"Import"
		);
		if (!iterationPath) return;

		const assignedTo = this.settings.assignedToUser;

		try {
			new Notice(`Fetching work items from ${iterationPath}...`);
			const items = await client.getWorkItemsByIteration(iterationPath, assignedTo);

			if (items.length === 0) {
				new Notice("No work items found for this iteration.");
				return;
			}

			let created = 0;
			let skipped = 0;

			for (const item of items) {
				const existing = await findExistingNote(this.app, item.id);
				if (existing) {
					skipped++;
					continue;
				}

				const filePath = buildFilePath(item, this.settings);
				const content = generateWorkItemNote(item, this.settings);

				const folder = filePath.substring(0, filePath.lastIndexOf("/"));
				await this.ensureFolderExists(folder);
				await this.app.vault.create(filePath, content);
				created++;
			}

			new Notice(`Imported ${created} work items, ${skipped} already existed.`);
		} catch (e) {
			console.error("[DevOps Sync] importIterationWorkItems failed", e);
			new Notice(`Import failed: ${(e as Error).message}`);
		}
	}

	private async syncIterationWorkItems() {
		const client = this.getClient();
		if (!client) return;

		const iterationPath = await this.promptForText(
			"Enter Iteration Path to Sync",
			"e.g. Casablanca\\Frontend\\Sprint 133",
			"Sync All"
		);
		if (!iterationPath) return;

		// Find all notes in vault with matching devops_iteration
		const files = this.app.vault.getMarkdownFiles();
		const matchingFiles: TFile[] = [];
		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			const fm = cache?.frontmatter;
			if (fm?.devops_id && fm?.devops_iteration === iterationPath) {
				matchingFiles.push(file);
			}
		}

		if (matchingFiles.length === 0) {
			new Notice(`No work item notes found for iteration: ${iterationPath}`);
			return;
		}

		new Notice(`Syncing ${matchingFiles.length} work item notes...`);
		let synced = 0;
		let failed = 0;

		for (const file of matchingFiles) {
			const devopsId = this.app.metadataCache.getFileCache(file)?.frontmatter?.devops_id;
			try {
				const item = await client.getWorkItem(devopsId);
				await syncWorkItemNote(this.app, file, item, this.settings);
				synced++;
			} catch (e) {
				console.error(`[DevOps Sync] Failed to sync #${devopsId}`, e);
				failed++;
			}
		}

		new Notice(`Synced ${synced} work items${failed > 0 ? `, ${failed} failed` : ""}.`);
	}

	private async ensureFolderExists(path: string): Promise<void> {
		const parts = path.split("/");
		let current = "";
		for (const part of parts) {
			current = current ? `${current}/${part}` : part;
			if (!this.app.vault.getAbstractFileByPath(current)) {
				await this.app.vault.createFolder(current);
			}
		}
	}
}
