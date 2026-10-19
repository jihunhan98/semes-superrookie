import { http } from "./http";
export type Coverage = {stale?:boolean;approved?:boolean;checkedAt?:string;concerns?:string[];atoms?:{quote:string;kind:string;issueIds:number[];artifacts:{issueId:number;type:string;field:string;quote:string}[];reason:string}[]};
export function artifactReviewRequest<T>(project: number, user: number, path: string, method = "GET") {
  return http<T>(`/api/projects/${project}/artifact-review/${path}?userId=${user}`, { method });
}
