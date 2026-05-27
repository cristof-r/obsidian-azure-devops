export interface WorkItem {
	id: number;
	title: string;
	type: string;
	state: string;
	areaPath: string;
	iterationPath: string;
	assignedTo: string;
	createdDate: string;
	changedDate: string;
	priority: number;
	storyPoints: number | null;
	modules: string;
	description: string;
	acceptanceCriteria: string;
	reproSteps: string;
	tags: string;
	url: string;
	parentId: number | null;
	children: WorkItem[];
}

export interface ChildRelation {
	rel: string;
	url: string;
	attributes: Record<string, unknown>;
}
