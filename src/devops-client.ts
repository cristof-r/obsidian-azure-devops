import { requestUrl } from "obsidian";
import type { WorkItem, ChildRelation } from "./types";

export class DevOpsClient {
	private headers: Record<string, string>;
	private baseUrl: string;
	private debug: boolean;

	constructor(pat: string, private org: string, private project: string, debug = false) {
		const base64Auth = btoa(":" + pat);
		this.headers = {
			Authorization: "Basic " + base64Auth,
			"Content-Type": "application/json",
		};
		this.baseUrl = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_apis/wit`;
		this.debug = debug;
	}

	private log(msg: string, ...args: unknown[]): void {
		if (this.debug) console.log(`[DevOps Sync] ${msg}`, ...args);
	}

	private logError(msg: string, ...args: unknown[]): void {
		console.error(`[DevOps Sync] ${msg}`, ...args);
	}

	async getWorkItem(id: number): Promise<WorkItem> {
		const url = `${this.baseUrl}/workitems/${id}?$expand=relations&api-version=7.1`;
		this.log("GET", url);

		try {
			const res = await requestUrl({
				url,
				method: "GET",
				headers: this.headers,
			});
			this.log("Response for item", id, res.json);

			const item = this.parseWorkItem(res.json);

			const childIds = this.extractChildIds(res.json.relations || []);
			this.log("Child IDs for", id, childIds);
			if (childIds.length > 0) {
				item.children = await this.getWorkItems(childIds);
			}

			return item;
		} catch (e) {
			this.logError("getWorkItem failed", { id, url, error: e });
			throw e;
		}
	}

	async getWorkItems(ids: number[]): Promise<WorkItem[]> {
		const results: WorkItem[] = [];

		// API limit: 200 IDs per request
		for (let i = 0; i < ids.length; i += 200) {
			const batch = ids.slice(i, i + 200);
			const url = `${this.baseUrl}/workitems?ids=${batch.join(",")}&api-version=7.1`;
			this.log("GET batch", url);

			try {
				const res = await requestUrl({
					url,
					method: "GET",
					headers: this.headers,
				});
				this.log("Batch response", res.json);

				for (const raw of res.json.value) {
					results.push(this.parseWorkItem(raw));
				}
			} catch (e) {
				this.logError("getWorkItems batch failed", { ids: batch, url, error: e });
				throw e;
			}
		}

		return results;
	}

	async getWorkItemsByIteration(iterationPath: string, assignedTo: string): Promise<WorkItem[]> {
		const userClause = assignedTo
			? `[System.AssignedTo] = '${assignedTo.replace(/'/g, "''")}'`
			: "[System.AssignedTo] = @Me";

		const wiql = {
			query: `SELECT [System.Id] FROM WorkItems
				WHERE ${userClause}
				AND [System.IterationPath] = '${iterationPath.replace(/'/g, "''")}'
				AND [System.State] NOT IN ('Removed')
				ORDER BY [Microsoft.VSTS.Common.Priority] ASC, [System.CreatedDate] DESC`
		};

		const url = `${this.baseUrl}/wiql?api-version=7.1`;
		this.log("POST WIQL", url, wiql);

		try {
			const res = await requestUrl({
				url,
				method: "POST",
				headers: this.headers,
				body: JSON.stringify(wiql),
			});
			this.log("WIQL response", res.json);

			const ids = (res.json.workItems || []).map((w: { id: number }) => w.id);
			if (ids.length === 0) return [];

			// Fetch full details for each item (with relations)
			const items: WorkItem[] = [];
			for (const id of ids) {
				const item = await this.getWorkItem(id);
				items.push(item);
			}
			return items;
		} catch (e) {
			this.logError("getWorkItemsByIteration failed", { iterationPath, assignedTo, error: e });
			throw e;
		}
	}

	private parseWorkItem(raw: Record<string, unknown>): WorkItem {
		const f = raw.fields as Record<string, unknown>;
		const assignedTo = f["System.AssignedTo"] as Record<string, string> | null;
		const id = raw.id as number;

		// Extract parent ID from relations
		const relations = (raw.relations || []) as ChildRelation[];
		let parentId: number | null = null;
		for (const rel of relations) {
			if (rel.rel === "System.LinkTypes.Hierarchy-Reverse") {
				const match = rel.url.match(/\/workItems\/(\d+)$/);
				if (match) parentId = parseInt(match[1]);
			}
		}

		return {
			id,
			title: (f["System.Title"] as string) || "",
			type: (f["System.WorkItemType"] as string) || "",
			state: (f["System.State"] as string) || "",
			areaPath: (f["System.AreaPath"] as string) || "",
			iterationPath: (f["System.IterationPath"] as string) || "",
			assignedTo: assignedTo?.displayName || "",
			createdDate: (f["System.CreatedDate"] as string) || "",
			changedDate: (f["System.ChangedDate"] as string) || "",
			priority: (f["Microsoft.VSTS.Common.Priority"] as number) || 0,
			storyPoints: (f["Microsoft.VSTS.Scheduling.StoryPoints"] as number) ?? null,
			modules: (f["Custom.Picklist_Modules"] as string) || "",
			description: (f["System.Description"] as string) || "",
			acceptanceCriteria: (f["Microsoft.VSTS.Common.AcceptanceCriteria"] as string) || "",
			reproSteps: (f["Microsoft.VSTS.TCM.ReproSteps"] as string) || "",
			tags: (f["System.Tags"] as string) || "",
			url: `https://dev.azure.com/${encodeURIComponent(this.org)}/${encodeURIComponent(this.project)}/_workitems/edit/${id}`,
			parentId,
			children: [],
		};
	}

	private extractChildIds(relations: ChildRelation[]): number[] {
		const ids: number[] = [];
		for (const rel of relations) {
			if (rel.rel === "System.LinkTypes.Hierarchy-Forward") {
				const match = rel.url.match(/\/workItems\/(\d+)$/);
				if (match) ids.push(parseInt(match[1]));
			}
		}
		return ids;
	}
}
