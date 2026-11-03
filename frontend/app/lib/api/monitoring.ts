import {http} from "../http";
export type Comparison={reqKey:string;relation:"CONFLICT"|"DEPENDENCY_REVIEW"|"NEEDS_REVIEW"|"NONE"|"UNREVIEWED";sourceQuote:string;targetQuote:string;sameCondition:string;reason:string;reviewQuestion:string};
export type ImpactTarget={id:number|null;reqKey:string;content:string;state:string;version:string|null;comparison:Comparison};
export type ImpactEvent={id:number;requirementId:number;createdAt:string;stale:boolean;data:{reqKey:string;sourceContent:string;sourceVersion:string|null;kind:string;status:"COMPLETE"|"PARTIAL"|"FAILED";reviewedCount:number;totalCount:number;targets:ImpactTarget[]}};
export const listImpactEvents=(project:number,user:number,requirement?:number,includeRead=false,signal?:AbortSignal)=>http<ImpactEvent[]>(`/api/v2/projects/${project}/impact-events?userId=${user}${requirement?`&requirementId=${requirement}`:''}&includeRead=${includeRead}`,{},signal);
export const readImpactEvent=(project:number,event:number,user:number)=>http<void>(`/api/v2/projects/${project}/impact-events/${event}/read`,{method:"POST",body:JSON.stringify({userId:user})});
