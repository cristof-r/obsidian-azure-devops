import { App, TFile, htmlToMarkdown, moment, Notice } from "obsidian";
import type { WorkItem } from "./types";
import type { DevOpsSyncSettings } from "./settings";
import {
	SYNC_START_MARKER,
	SYNC_END_MARKER,
	NOTES_SECTION_HEADER,
} from "./constants";

/**
 * Build the file path for a work item note.
 * Pattern: {saveFolder}/{year}/W{week}/{Type} #{ID} - {Title}.md
 */
export function buildFilePath(item: WorkItem, settings: DevOpsSyncSettings): string {
	const now = moment();
	const year = now.format("YYYY");
	const week = now.format("ww");
	const sanitizedTitle = sanitizeFilename(item.title);
	const fileName = `${item.type} ${item.id} - ${sanitizedTitle}.md`;
	return `${settings.saveFolder}/${year}/W${week}/${fileName}`;
}

/**
 * Find existing note for a work item by devops_id in frontmatter.
 */
export async function findExistingNote(
	app: App,
	devopsId: number
): Promise<TFile | null> {
	const files = app.vault.getMarkdownFiles();
	for (const file of files) {
		const cache = app.metadataCache.getFileCache(file);
		if (cache?.frontmatter?.devops_id === devopsId) {
			return file;
		}
	}
	return null;
}

/**
 * Generate full markdown content for a new work item note.
 */
export function generateWorkItemNote(
	item: WorkItem,
	settings: DevOpsSyncSettings
): string {
	const frontmatter = buildFrontmatter(item, settings);
	const heading = `# ${item.type} ${item.id} - ${item.title}`;
	const syncSection = buildSyncSection(item);

	return [
		"---",
		frontmatter,
		"---",
		"",
		heading,
		"",
		"## DevOps Info",
		SYNC_START_MARKER,
		syncSection,
		SYNC_END_MARKER,
		NOTES_SECTION_HEADER,
	].join("\n");
}

/**
 * Sync an existing note: update frontmatter + DevOps Info section, preserve everything else.
 */
export async function syncWorkItemNote(
	app: App,
	file: TFile,
	item: WorkItem,
	settings: DevOpsSyncSettings
): Promise<void> {
	// Update frontmatter
	await app.fileManager.processFrontMatter(file, (fm) => {
		fm.devops_id = item.id;
		fm.devops_type = item.type;
		fm.devops_url = item.url;
		fm.devops_state = item.state;
		fm.devops_area = item.areaPath;
		fm.devops_iteration = item.iterationPath;
		fm.devops_assigned_to = item.assignedTo;
		fm.devops_priority = item.priority;
		fm.devops_story_points = item.storyPoints;
		fm.devops_modules = item.modules || undefined;
		fm.devops_tags = item.tags;
		fm.devops_created = formatDate(item.createdDate);
		fm.devops_last_synced = moment().format();
		fm.title = `${item.type} ${item.id} - ${item.title}`;

		// Map status
		const mappedStatus = settings.statusMapping[item.state];
		if (mappedStatus) {
			fm.status = mappedStatus;
			fm.completedDate = mappedStatus === "3 - done" ? moment().format("YYYY-MM-DD") : undefined;
		}

		// Map priority
		const mappedPriority = settings.priorityMapping[String(item.priority)];
		if (mappedPriority) fm.priority = mappedPriority;

		fm.dateModified = moment().format();

		// Tags
		const tags: string[] = ["devops", item.type.toLowerCase().replace(/\s+/g, "-")];
		if (settings.integrateWithTaskNotes) tags.unshift("task");
		if (item.modules) {
			for (const mod of item.modules.split(";").map(m => m.trim().toLowerCase()).filter(Boolean)) {
				if (!tags.includes(mod)) tags.push(mod);
			}
		}
		fm.tags = tags;
	});

	// Update sync section in body
	const content = await app.vault.read(file);
	const startIdx = content.indexOf(SYNC_START_MARKER);
	const endIdx = content.indexOf(SYNC_END_MARKER);

	if (startIdx !== -1 && endIdx !== -1) {
		const before = content.substring(0, startIdx);
		const after = content.substring(endIdx + SYNC_END_MARKER.length);
		const newSyncSection = buildSyncSection(item);
		const newContent = before + SYNC_START_MARKER + "\n" + newSyncSection + "\n" + SYNC_END_MARKER + after;
		await app.vault.modify(file, newContent);
	} else {
		new Notice("Sync markers not found — only frontmatter was updated.");
	}

	// Rename file if title/type changed
	const expectedName = `${item.type} ${item.id} - ${sanitizeFilename(item.title)}.md`;
	if (file.name !== expectedName) {
		const newPath = file.parent ? `${file.parent.path}/${expectedName}` : expectedName;
		await app.fileManager.renameFile(file, newPath);
	}
}

// --- Private helpers ---

function buildFrontmatter(item: WorkItem, settings: DevOpsSyncSettings): string {
	const mappedStatus = settings.statusMapping[item.state] || "0 - not planned";
	const mappedPriority = settings.priorityMapping[String(item.priority)] || settings.defaultPriority;
	const now = moment().format();
	const tags: string[] = ["devops", item.type.toLowerCase().replace(/\s+/g, "-")];
	if (settings.integrateWithTaskNotes) tags.unshift("task");

	const lines: string[] = [];
	lines.push(`title: "${item.type} ${item.id} - ${escapeYaml(item.title)}"`);
	lines.push(`devops_id: ${item.id}`);
	lines.push(`devops_type: ${item.type}`);
	lines.push(`devops_url: "${item.url}"`);
	lines.push(`devops_state: ${item.state}`);
	lines.push(`devops_area: "${escapeYaml(item.areaPath)}"`);
	lines.push(`devops_iteration: "${escapeYaml(item.iterationPath)}"`);
	lines.push(`devops_assigned_to: "${escapeYaml(item.assignedTo)}"`);
	lines.push(`devops_priority: ${item.priority}`);
	if (item.storyPoints !== null) {
		lines.push(`devops_story_points: ${item.storyPoints}`);
	}
	if (item.modules) {
		lines.push(`devops_modules: "${escapeYaml(item.modules)}"`);
	}
	lines.push(`devops_tags: "${escapeYaml(item.tags)}"`);
	lines.push(`devops_created: ${formatDate(item.createdDate)}`);
	lines.push(`devops_last_synced: ${now}`);
	lines.push(`status: ${mappedStatus}`);
	lines.push(`priority: ${mappedPriority}`);
	lines.push(`scheduled: ${moment().format("YYYY-MM-DD")}`);
	lines.push(`dateCreated: ${now}`);
	lines.push(`dateModified: ${now}`);
	lines.push("tags:");
	for (const tag of tags) {
		lines.push(`  - ${tag}`);
	}
	if (item.modules) {
		for (const mod of item.modules.split(";").map(m => m.trim().toLowerCase()).filter(Boolean)) {
			if (!tags.includes(mod)) lines.push(`  - ${mod}`);
		}
	}
	if (mappedStatus === "3 - done") {
		lines.push(`completedDate: ${moment().format("YYYY-MM-DD")}`);
	}

	return lines.join("\n");
}

function buildSyncSection(item: WorkItem): string {
	const lines: string[] = [];

	// Info table
	lines.push("");
	lines.push("| Field | Value |");
	lines.push("|---|---|");
	lines.push(`| **Type** | ${item.type} |`);
	lines.push(`| **State** | ${item.state} |`);
	lines.push(`| **Area** | ${item.areaPath} |`);
	lines.push(`| **Iteration** | ${item.iterationPath} |`);
	lines.push(`| **Assigned To** | ${item.assignedTo} |`);
	lines.push(`| **Priority** | ${item.priority} |`);
	if (item.storyPoints !== null) {
		lines.push(`| **Story Points** | ${item.storyPoints} |`);
	}
	if (item.modules) {
		lines.push(`| **Modules** | ${item.modules} |`);
	}
	lines.push(`| **Created** | ${formatDate(item.createdDate)} |`);
	if (item.tags) {
		lines.push(`| **Tags** | ${item.tags.replace(/;/g, ", ")} |`);
	}
	lines.push(`| **Link** | [Open in DevOps](${item.url}) |`);

	// Description
	lines.push("");
	lines.push("### Description");
	lines.push(item.description ? convertHtml(item.description) : "*No description*");

	// Acceptance Criteria
	lines.push("");
	lines.push("### Acceptance Criteria");
	lines.push(item.acceptanceCriteria ? convertHtml(item.acceptanceCriteria) : "*No acceptance criteria*");

	// Repro Steps (Bugs)
	if (item.type === "Bug") {
		lines.push("");
		lines.push("### Repro Steps");
		lines.push(item.reproSteps ? convertHtml(item.reproSteps) : "*No repro steps*");
	}

	// Child items
	if (item.children.length > 0) {
		lines.push("");
		lines.push("### Child Items");
		for (const child of item.children) {
			const done = child.state === "Closed" || child.state === "Done" || child.state === "Resolved";
			const checkbox = done ? "[x]" : "[ ]";
			lines.push(`- ${checkbox} **${child.type}** [#${child.id} — ${child.title}](${child.url}) · _${child.state}_`);
		}
	}

	return lines.join("\n");
}

function sanitizeFilename(name: string): string {
	return name.replace(/[\\/:*?"<>|#^\[\]]/g, "").replace(/\s+/g, " ").trim();
}

function escapeYaml(value: string): string {
	return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function formatDate(isoDate: string): string {
	if (!isoDate) return "";
	return moment(isoDate).format("YYYY-MM-DD");
}

function convertHtml(html: string): string {
	try {
		return htmlToMarkdown(html);
	} catch {
		// Fallback: strip tags
		return html.replace(/<[^>]*>/g, "").trim();
	}
}
