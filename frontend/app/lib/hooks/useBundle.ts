"use client";
import { useCallback,useEffect,useState } from "react"; import { getCurrentBundle } from "../api/v2"; import type { WorkBundle } from "../types/workflow";
export function useBundle(projectId:number,requirementId:number,userId:number|undefined){
  const [data,setData]=useState<WorkBundle|null>(null),[error,setError]=useState<string|null>(null);
  const reload=useCallback((signal?:AbortSignal)=>{if(!userId)return Promise.resolve();setError(null);return getCurrentBundle(projectId,requirementId,userId,signal).then(setData).catch(e=>{if(e.name!=="AbortError")setError(e.message);});},[projectId,requirementId,userId]);
  useEffect(()=>{const c=new AbortController();reload(c.signal);return()=>c.abort();},[reload]);
  useEffect(()=>{const running=data?.generation&&["QUEUED","RUNNING","RETRY_WAIT"].includes(data.generation.status);if(!data||(!running&&data.state!=="GENERATING"))return;const timer=window.setInterval(()=>reload(),2000);return()=>window.clearInterval(timer);},[data,reload]);
  return{data,error,reload};
}
