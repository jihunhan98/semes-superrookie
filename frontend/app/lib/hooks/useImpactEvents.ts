"use client";
import {useCallback,useEffect,useState} from "react";
import {listImpactEvents,readImpactEvent,type ImpactEvent} from "../api/monitoring";
import {getCurrentUser} from "../session";
const CHANGED="reqops:impact-read";
export function useImpactEvents(projectId:number,requirementId?:number,includeRead=false){
 const [events,setEvents]=useState<ImpactEvent[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 const reload=useCallback(async(signal?:AbortSignal)=>{const user=getCurrentUser();if(!user||!Number.isFinite(projectId)||projectId<=0){setLoading(false);return;}
  try{const rows=await listImpactEvents(projectId,user.id,requirementId,includeRead,signal);if(!signal?.aborted){setEvents(rows);setError('');}}
  catch(e){if(!signal?.aborted)setError(e instanceof Error?e.message:'알림을 불러오지 못했습니다.');}finally{if(!signal?.aborted)setLoading(false);}
 },[projectId,requirementId,includeRead]);
 useEffect(()=>{const c=new AbortController();reload(c.signal);const refresh=()=>reload(c.signal);const timer=setInterval(()=>{if(!document.hidden)refresh();},5000);window.addEventListener(CHANGED,refresh);window.addEventListener('focus',refresh);return()=>{c.abort();clearInterval(timer);window.removeEventListener(CHANGED,refresh);window.removeEventListener('focus',refresh);};},[reload]);
 const markRead=async(event:ImpactEvent)=>{const user=getCurrentUser();if(!user)throw new Error('다시 로그인해주세요.');await readImpactEvent(projectId,event.id,user.id);if(!includeRead)setEvents(rows=>rows.filter(row=>row.id!==event.id));window.dispatchEvent(new Event(CHANGED));};
 return {events,error,loading,reload,markRead};
}
