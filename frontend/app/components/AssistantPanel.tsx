"use client";
import {useEffect,useRef,useState} from "react";
import {usePathname} from "next/navigation";
import {http} from "../lib/http";
import {getCurrentUser} from "../lib/session";
type Message={role:"user"|"assistant";content:string};
export function openAssistant(){window.dispatchEvent(new Event("reqops:assistant-open"));}
export default function AssistantPanel(){const path=usePathname();return <Conversation key={path} path={path}/>;}
function Conversation({path}:{path:string}){
 const match=path.match(/^\/projects\/(\d+)(?:\/requirements\/(\d+))?/),projectId=Number(match?.[1]),requirementId=match?.[2]?Number(match[2]):undefined;
 const page=path.endsWith('/edit')?'edit':path.includes('/artifacts')||path.includes('/issues')||path.includes('/review')?'artifacts':path.includes('/requirements')?'requirements':'project';
 const [open,setOpen]=useState(false),[messages,setMessages]=useState<Message[]>([]),[input,setInput]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");const active=useRef(true);const end=useRef<HTMLDivElement>(null);
 useEffect(()=>{active.current=true;const show=()=>setOpen(true);window.addEventListener('reqops:assistant-open',show);return()=>{active.current=false;window.removeEventListener('reqops:assistant-open',show);};},[]);
 useEffect(()=>{end.current?.scrollIntoView({block:'nearest'});},[messages,busy]);
 async function send(){const user=getCurrentUser();if(!user||busy||!input.trim())return;const text=input.trim();setBusy(true);setError("");const history=messages.slice(-10);setMessages([...messages,{role:'user',content:text}]);
 try{let draft:string|undefined;if(page==='edit'){const event=new CustomEvent('reqops:assistant-context',{detail:{draft:undefined as string|undefined}});window.dispatchEvent(event);draft=event.detail.draft;}
 const result=await http<{answer:string}>(`/api/projects/${projectId}/assistant`,{method:'POST',body:JSON.stringify({userId:user.id,page,requirementId,draft,message:text,history})});if(active.current){setMessages(current=>[...current,{role:'assistant',content:result.answer}]);setInput("");}}
 catch(e){if(active.current){setError(e instanceof Error?e.message:'AI 응답을 받지 못했습니다.');setMessages(messages);}}finally{if(active.current)setBusy(false);}}
 if(!projectId)return null;
 return <><button className="assistant-launch btn prim" onClick={()=>setOpen(!open)} aria-expanded={open} aria-controls="assistant-panel">AI 도우미</button>{open&&<aside id="assistant-panel" className="assistant-panel" aria-label="현재 화면 AI 도우미"><header><div><b>AI 도우미</b><small>{requirementId?`요구사항 #${requirementId}`:`프로젝트 #${projectId}`} · {page==='edit'?'편집 중 본문':page==='artifacts'?'산출물 검토':page==='requirements'?'요구사항 흐름':'프로젝트'}</small></div><button className="btn sm" onClick={()=>setOpen(false)} aria-label="AI 도우미 닫기">닫기</button></header><div className="assistant-messages" aria-live="polite">{!messages.length&&<p>현재 화면에 대해 질문하거나 검토할 내용을 적어주세요. 본문 반영과 확정은 화면에서 직접 진행합니다.</p>}{messages.map((m,i)=><article key={i} className={m.role}><b>{m.role==='user'?'나':'AI'}</b><p>{m.content}</p></article>)}{busy&&<p role="status">현재 화면과 요청을 확인하고 있습니다…</p>}<div ref={end}/></div><form onSubmit={e=>{e.preventDefault();send();}}><label htmlFor="assistant-message">검토 요청</label><textarea id="assistant-message" rows={3} maxLength={4000} value={input} disabled={busy} onChange={e=>setInput(e.target.value)} placeholder="예: 이 검출 항목이 왜 문제인지 설명해줘"/>{error&&<p role="alert" className="lmsg err">{error}</p>}<button className="btn prim" disabled={busy||!input.trim()}>{busy?'답변 대기 중…':'보내기'}</button>{page==='edit'&&<button type="button" className="btn" disabled={busy} onClick={()=>window.dispatchEvent(new CustomEvent('reqops:assistant-review',{detail:{message:input}}))}>현재 본문으로 정식 재검토</button>}</form></aside>}</>;
}
