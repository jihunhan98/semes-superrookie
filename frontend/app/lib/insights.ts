import { BACKEND } from './api';
export function devId(id: number) { return `DEV-${String(id).padStart(6, '0')}`; }
export type Impact = { id:number; requirementId:number; status:string; read:boolean; error?:string; summary?:string; input:{reqKey:string; before:string; after:string; proposed:boolean; requirements:{id:number;reqKey:string;content:string}[]}; decisions?:{reqKey:string; judgment:'IMPACT'|'NONE'|'UNKNOWN';targetQuote:string;beforeValue:string;afterValue:string;reason:string;suggestion:string}[]; analyzedAt?:string };
export type CodeSnapshot = {snapshotId?:number;version?:string;warnings?:string[];symbols?:{id:string;name:string;qualifiedName:string;file:string;line:number;methods:{id:string;name:string;signature:string}[]}[]};
export type Coverage = {stale?:boolean;approved?:boolean;checkedAt?:string;concerns?:string[];atoms?:{quote:string;kind:string;issueIds:number[];artifacts:{issueId:number;type:string;field:string;quote:string}[];reason:string}[]};
export async function insight<T>(project:number, user:number, path:string, method='GET', body?:unknown):Promise<T> {
 const response=await fetch(`${BACKEND}/api/projects/${project}/insights/${path}?userId=${user}`,{method,headers:{'Content-Type':'application/json'},...(body!==undefined?{body:JSON.stringify(body)}:{})});
 if(!response.ok){const err=await response.json().catch(()=>null);throw new Error(err?.message??err?.detail??'요청을 처리하지 못했습니다.');}
 const text=await response.text();return text?JSON.parse(text):undefined;
}
