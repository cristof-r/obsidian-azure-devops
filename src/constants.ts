export const SYNC_START_MARKER = "<!-- DEVOPS-SYNC:START — do not edit between these markers -->";
export const SYNC_END_MARKER = "<!-- DEVOPS-SYNC:END -->";

export const NOTES_SECTION_HEADER = "\n---\n\n## Notes\n";

export const DEFAULT_STATUS_MAPPING: Record<string, string> = {
	"New": "1 - open",
	"Active": "2 - in-progress",
	"Committed": "2 - in-progress",
	"ReadyForTesting": "3 - done",
	"Resolved": "3 - done",
	"Closed": "3 - done",
	"Done": "3 - done",
	"Removed": "3 - done",
};

export const DEVOPS_PRIORITY_TO_TASKNOTES: Record<number, string> = {
	1: "high",
	2: "high",
	3: "normal",
	4: "low",
	5: "low",
	6: "none",
};

export const DEFAULT_PRIORITY_MAPPING: Record<string, string> = {
	"1": "high",
	"3": "normal",
	"5": "low",
	"6": "none",
};

export const WORK_ITEM_FIELDS = [
	"System.Id",
	"System.Title",
	"System.WorkItemType",
	"System.State",
	"System.AreaPath",
	"System.IterationPath",
	"System.AssignedTo",
	"System.CreatedDate",
	"System.ChangedDate",
	"Microsoft.VSTS.Common.Priority",
	"System.Description",
	"Microsoft.VSTS.Common.AcceptanceCriteria",
	"Microsoft.VSTS.TCM.ReproSteps",
	"System.Tags",
].join(",");
