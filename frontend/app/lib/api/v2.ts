import { http } from "../http";
import type { JobProgress, WorkBundle } from "../types/workflow";
export const getCurrentBundle=(projectId:number,requirementId:number,userId:number,signal?:AbortSignal)=>http<WorkBundle>(`/api/v2/projects/${projectId}/requirements/${requirementId}/bundle?userId=${userId}`,{},signal);
export const confirmBundle=(projectId:number,requirementId:number,userId:number,expectedRevision:number,idempotencyKey:string)=>http<WorkBundle>(`/api/v2/projects/${projectId}/requirements/${requirementId}/bundle/confirm`,{method:"POST",body:JSON.stringify({userId,expectedRevision,idempotencyKey})});
export const getJob=(id:number,signal?:AbortSignal)=>http<JobProgress>(`/api/v2/jobs/${id}`,{},signal);
export const retryJob=(id:number,userId:number)=>http<JobProgress>(`/api/v2/jobs/${id}/retry`,{method:"POST",body:JSON.stringify({userId})});

export type DeliverableGroup={requirementId:number;reqKey:string;content:string;version:string|null;state:string;workflow:import("../api").WorkflowProgress;issues:{id:number;issueKey:string;title:string;state:string;artifacts:import("../types/workflow").ArtifactSummary[]}[]};
export const listDeliverables=(projectId:number,userId:number,signal?:AbortSignal)=>http<DeliverableGroup[]>(`/api/v2/projects/${projectId}/deliverables?userId=${userId}`,{},signal);
