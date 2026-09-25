import { http } from "../http";
import type { JobProgress, WorkBundle } from "../types/workflow";
export const getCurrentBundle=(projectId:number,requirementId:number,userId:number,signal?:AbortSignal)=>http<WorkBundle>(`/api/v2/projects/${projectId}/requirements/${requirementId}/bundle?userId=${userId}`,{},signal);
export const confirmBundle=(projectId:number,requirementId:number,userId:number,expectedRevision:number,idempotencyKey:string)=>http<WorkBundle>(`/api/v2/projects/${projectId}/requirements/${requirementId}/bundle/confirm`,{method:"POST",body:JSON.stringify({userId,expectedRevision,idempotencyKey})});
export const getJob=(id:number,signal?:AbortSignal)=>http<JobProgress>(`/api/v2/jobs/${id}`,{},signal);
