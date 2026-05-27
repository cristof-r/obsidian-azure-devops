import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import type DevOpsSyncPlugin from "./main";
import { DEFAULT_STATUS_MAPPING, DEFAULT_PRIORITY_MAPPING } from "./constants";
import { requestUrl } from "obsidian";

export interface DevOpsSyncSettings {
	pat: string;
	organization: string;
	project: string;
	assignedToUser: string;
	saveFolder: string;
	integrateWithTaskNotes: boolean;
	statusMapping: Record<string, string>;
	priorityMapping: Record<string, string>;
	defaultPriority: string;
	debugLogging: boolean;
}

export const DEFAULT_SETTINGS: DevOpsSyncSettings = {
	pat: "",
	organization: "",
	project: "",
	assignedToUser: "",
	saveFolder: "1 Engineering Book/Tasks",
	integrateWithTaskNotes: true,
	statusMapping: { ...DEFAULT_STATUS_MAPPING },
	priorityMapping: { ...DEFAULT_PRIORITY_MAPPING },
	defaultPriority: "normal",
	debugLogging: false,
};

export class DevOpsSyncSettingTab extends PluginSettingTab {
	plugin: DevOpsSyncPlugin;

	constructor(app: App, plugin: DevOpsSyncPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Azure DevOps Sync" });

		// --- Connection ---
		containerEl.createEl("h3", { text: "Connection" });

		new Setting(containerEl)
			.setName("Personal Access Token")
			.setDesc("PAT with Work Items (Read) scope. Stored locally in vault.")
			.addText((text) =>
				text
					.setPlaceholder("Enter PAT")
					.setValue(this.plugin.settings.pat)
					.then((t) => { t.inputEl.type = "password"; })
					.onChange(async (value) => {
						this.plugin.settings.pat = value.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Organization")
			.setDesc("Azure DevOps organization name (e.g. casablancahotelsoftware)")
			.addText((text) =>
				text
					.setPlaceholder("myorg")
					.setValue(this.plugin.settings.organization)
					.onChange(async (value) => {
						this.plugin.settings.organization = value.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Project")
			.setDesc("Azure DevOps project name (e.g. Casablanca)")
			.addText((text) =>
				text
					.setPlaceholder("MyProject")
					.setValue(this.plugin.settings.project)
					.onChange(async (value) => {
						this.plugin.settings.project = value.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Assigned To User")
			.setDesc("Display name or email for filtering work items (e.g. 'Cristof Rojas'). Leave empty to use @Me.")
			.addText((text) =>
				text
					.setPlaceholder("@Me")
					.setValue(this.plugin.settings.assignedToUser)
					.onChange(async (value) => {
						this.plugin.settings.assignedToUser = value.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Test Connection")
			.setDesc("Verify PAT and project settings")
			.addButton((btn) =>
				btn.setButtonText("Test").onClick(async () => {
					const { pat, organization, project } = this.plugin.settings;
					if (!pat || !organization || !project) {
						new Notice("Fill in PAT, organization, and project first.");
						return;
					}
					try {
						const base64Auth = btoa(":" + pat);
						await requestUrl({
							url: `https://dev.azure.com/${encodeURIComponent(organization)}/_apis/projects/${encodeURIComponent(project)}?api-version=7.1`,
							method: "GET",
							headers: { Authorization: "Basic " + base64Auth },
						});
						new Notice("Connection successful!");
					} catch (e) {
						new Notice("Connection failed: " + (e as Error).message);
					}
				})
			);

		// --- Notes ---
		containerEl.createEl("h3", { text: "Notes" });

		new Setting(containerEl)
			.setName("Save Folder")
			.setDesc("Base folder for work item notes. Plugin appends /{year}/W{week}/")
			.addText((text) =>
				text
					.setPlaceholder("1 Engineering Book/Tasks")
					.setValue(this.plugin.settings.saveFolder)
					.onChange(async (value) => {
						this.plugin.settings.saveFolder = value.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Integrate with TaskNotes")
			.setDesc("When on, work item notes get tags: [task, devops] and appear in TaskNotes views. When off, only tags: [devops].")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.integrateWithTaskNotes)
					.onChange(async (value) => {
						this.plugin.settings.integrateWithTaskNotes = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Default Priority")
			.setDesc("TaskNotes priority for new work item notes")
			.addDropdown((dd) =>
				dd
					.addOptions({ none: "None", low: "Low", normal: "Normal", high: "High" })
					.setValue(this.plugin.settings.defaultPriority)
					.onChange(async (value) => {
						this.plugin.settings.defaultPriority = value;
						await this.plugin.saveSettings();
					})
			);

		// --- Status Mapping ---
		containerEl.createEl("h3", { text: "Status Mapping" });
		containerEl.createEl("p", {
			text: "Map DevOps states to TaskNotes statuses. Add/remove rows as needed.",
			cls: "setting-item-description",
		});

		const mappingContainer = containerEl.createDiv();
		this.renderStatusMapping(mappingContainer);

		// --- Priority Mapping ---
		containerEl.createEl("h3", { text: "Priority Mapping" });
		containerEl.createEl("p", {
			text: "Map DevOps priority numbers (1-4) to TaskNotes priorities.",
			cls: "setting-item-description",
		});

		const priorityContainer = containerEl.createDiv();
		this.renderPriorityMapping(priorityContainer);

		// --- Advanced ---
		containerEl.createEl("h3", { text: "Advanced" });

		new Setting(containerEl)
			.setName("Debug Logging")
			.setDesc("Log API requests, responses, and errors to the developer console (Ctrl+Shift+I).")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.debugLogging)
					.onChange(async (value) => {
						this.plugin.settings.debugLogging = value;
						await this.plugin.saveSettings();
					})
			);
	}

	private renderPriorityMapping(container: HTMLElement): void {
		container.empty();
		const mapping = this.plugin.settings.priorityMapping;

		const labels: Record<string, string> = {
			"1": "1 — Critical",
			"2": "2 — High",
			"3": "3 — Medium",
			"4": "4 — Low",
		};

		for (const devopsPriority of Object.keys(mapping)) {
			new Setting(container)
				.setName(labels[devopsPriority] || `Priority ${devopsPriority}`)
				.addDropdown((dd) =>
					dd
						.addOptions({
							none: "none",
							low: "low",
							normal: "normal",
							high: "high",
						})
						.setValue(mapping[devopsPriority])
						.onChange(async (value) => {
							this.plugin.settings.priorityMapping[devopsPriority] = value;
							await this.plugin.saveSettings();
						})
				);
		}
	}

	private renderStatusMapping(container: HTMLElement): void {
		container.empty();
		const mapping = this.plugin.settings.statusMapping;

		for (const devopsState of Object.keys(mapping)) {
			new Setting(container)
				.setName(devopsState)
				.addDropdown((dd) =>
					dd
						.addOptions({
							"0 - not planned": "0 - not planned",
							"1 - open": "1 - open",
							"2 - in-progress": "2 - in-progress",
							"3 - done": "3 - done",
						})
						.setValue(mapping[devopsState])
						.onChange(async (value) => {
							this.plugin.settings.statusMapping[devopsState] = value;
							await this.plugin.saveSettings();
						})
				)
				.addExtraButton((btn) =>
					btn.setIcon("trash").setTooltip("Remove").onClick(async () => {
						delete this.plugin.settings.statusMapping[devopsState];
						await this.plugin.saveSettings();
						this.renderStatusMapping(container);
					})
				);
		}

		new Setting(container)
			.setName("Add mapping")
			.addText((text) => text.setPlaceholder("DevOps state name"))
			.addButton((btn) =>
				btn.setButtonText("Add").onClick(async () => {
					const input = container.querySelector<HTMLInputElement>(
						".setting-item:last-child input"
					);
					const val = input?.value?.trim();
					if (val && !(val in mapping)) {
						this.plugin.settings.statusMapping[val] = "1 - open";
						await this.plugin.saveSettings();
						this.renderStatusMapping(container);
					}
				})
			);
	}
}
