"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {useParams,useRouter} from "next/navigation";
import Header from "../../../components/Header";
import ProjectSidebar from "../../../components/ProjectSidebar";
import AutoGrowTextarea from "../../../components/AutoGrowTextarea";
import {getGlossary,getProject,reviewGlossaryTerm,type GlossaryView,type ProjectTerm,type ProjectDetail} from "../../../lib/api";
import {getCurrentUser} from "../../../lib/session";

const LABEL={PENDING:"확인 필요",CONFIRMED:"확정된 정의",DISMISSED:"사용하지 않음"};
export default function GlossaryPage(){
 const params=useParams<{id:string}>(),router=useRouter(),projectId=Number(params.id);
 const [project,setProject]=useState<ProjectDetail|null>(null);const [data,setData]=useState<GlossaryView|null>(null);
 const [selected,setSelected]=useState<number>();const [draft,setDraft]=useState<ProjectTerm|null>(null);
 const [filter,setFilter]=useState("PENDING"),[query,setQuery]=useState("");const [sidebarOpen,setSidebarOpen]=useState(true);
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 useEffect(()=>{const user=getCurrentUser();if(!user){router.replace('/login');return;}if(window.innerWidth<=760)setSidebarOpen(false);
 Promise.all([getProject(projectId,user.id),getGlossary(projectId,user.id)]).then(([p,g])=>{setProject(p);setData(g);setSelected(g.terms.find(t=>t.status==='PENDING')?.id??g.terms[0]?.id);}).catch(e=>setError(e instanceof Error?e.message:"용어사전을 불러오지 못했습니다."));},[projectId,router]);
 useEffect(()=>{setDraft(data?.terms.find(t=>t.id===selected)??null);},[data,selected]);
 async function save(status:ProjectTerm['status']){const user=getCurrentUser();if(!user||!draft)return;setBusy(true);setError("");setNotice("");try{const updated=await reviewGlossaryTerm(projectId,{...draft,status},user.id);setData(updated);window.dispatchEvent(new Event('reqops:glossary-updated'));setNotice(status==='CONFIRMED'?"용어 정의를 확정했습니다. 이후 분석부터 이 정의를 우선 참고합니다.":status==='DISMISSED'?"AI 분석에 사용하지 않는 용어로 남겼습니다.":"수정한 내용을 저장했습니다. 아직 확인이 필요한 정의입니다.");}catch(e){setError(e instanceof Error?e.message:"저장하지 못했습니다.");}finally{setBusy(false);}}
 const visible=data?.terms.filter(t=>(filter==='ALL'||t.status===filter)&&(t.name+' '+t.definition).toLowerCase().includes(query.toLowerCase()))??[];
 return <div className="appshell"><Header projectName={project?.name} onToggleSidebar={()=>setSidebarOpen(v=>!v)}/><div className="body">{project&&sidebarOpen&&<ProjectSidebar projectId={projectId} projectName={project.name} active="glossary"/>}<main className="main glossary-page">
 <div className="crumb"><Link href={`/projects/${projectId}`}>프로젝트</Link> / 용어사전</div><section className="stage-heading"><div><span className="section-kicker">프로젝트 용어사전</span><h1>AI가 정리한 용어를 확인해주세요</h1><p>요구사항에서 발견한 용어와 추정한 의미입니다. 확인하고 수정한 정의를 앞으로의 분석에 사용합니다.</p></div><span className="glossary-pending-count">확인 필요 {data?.pendingCount??0}개</span></section>
 {(data?.pendingCount??0)>0&&<div className="glossary-alert"><b>새로 등록되었거나 확인이 필요한 용어가 있습니다.</b><span>AI가 추정한 뜻은 확실하지 않을 수 있습니다. 원문을 참고해 수정하거나 정의를 확정해주세요.</span></div>}
 <div className="glossary-layout"><aside className="glossary-list"><input aria-label="용어 검색" placeholder="용어·내용 검색" value={query} onChange={e=>setQuery(e.target.value)}/><div className="glossary-filters">{[['PENDING','확인 필요'],['CONFIRMED','확정'],['DISMISSED','미사용'],['ALL','전체']].map(([k,v])=><button className={filter===k?'on':''} key={k} onClick={()=>setFilter(k)}>{v}</button>)}</div>
 {visible.map(t=><button key={t.id} className={selected===t.id?'on':''} onClick={()=>setSelected(t.id)}><b>{t.name}</b><span>{LABEL[t.status]} · 요구사항 {t.usages.length}개</span></button>)}{data&&visible.length===0&&<p>이 조건의 용어가 없습니다.</p>}{!data&&!error&&<p>용어사전을 불러오는 중…</p>}</aside>
 <section className="glossary-detail">{draft?<><div className="glossary-detail-heading"><span className={`term-status ${draft.status.toLowerCase()}`}>{LABEL[draft.status]}</span><small>사용자 확정 전에는 AI 추정으로 구분합니다.</small></div><label className="glossary-field"><span>용어 이름</span><input disabled={busy} maxLength={100} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label><label className="glossary-field"><span>내용 · 의미와 적용 범위</span><AutoGrowTextarea disabled={busy} maxLength={30000} rows={7} value={draft.definition} onChange={definition=>setDraft({...draft,definition})}/></label>
 <details className="glossary-ai-original"><summary>AI가 처음 추정한 내용 보기</summary><p>{draft.aiDefinition}</p></details>
 <section className="glossary-usages"><h2>어디에 쓰이나요?</h2>{draft.usages.map(u=><article key={u.requirementId}><Link href={`/projects/${projectId}/requirements/${u.requirementId}/edit`}>{u.reqKey} → 요구사항 열기</Link><blockquote>{u.quote}</blockquote></article>)}{!draft.usages.length&&<p>현재 작성 중인 요구사항에서 사용 구절을 찾지 못했습니다.</p>}</section>
 <footer className="glossary-actions"><button className="btn prim" disabled={busy||!draft.name.trim()||!draft.definition.trim()} onClick={()=>save('CONFIRMED')}>이 정의로 확정</button><button className="btn" disabled={busy||!draft.name.trim()||!draft.definition.trim()} onClick={()=>save('PENDING')}>수정 내용 저장</button><button className="btn" disabled={busy} onClick={()=>save('DISMISSED')}>사용하지 않음</button></footer></>:<div className="question-empty">용어를 선택하면 AI가 추정한 내용과 사용된 요구사항을 확인할 수 있습니다.</div>}</section></div>
 {error&&<p className="lmsg err" role="alert">{error}</p>}{notice&&<p className="lmsg ok" role="status">{notice}</p>}
 </main></div></div>;
}
