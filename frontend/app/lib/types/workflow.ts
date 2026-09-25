export type ArtifactSummary = { id: number; type: "voc"|"functional"|"nonfunctional"|"detail-design"; state: "DRAFT"|"CONFIRMED"; schemaVersion: number; revision: number };
export type BundleIssue = { id:number; issueKey:string; title:string; quote:string|null; state:string; revision:number; artifacts:ArtifactSummary[] };
export type WorkBundle = { id:number; requirementId:number; revisionNo:number; state:"PLANNING"|"ISSUES_READY"|"GENERATING"|"REVIEW"|"CONFIRMED"|"SUPERSEDED"; revision:number; issues:BundleIssue[]; manifestJson:string|null };
export type JobProgress = { id:number; kind:string; status:string; total:number; succeeded:number; failed:number; pending:number };
