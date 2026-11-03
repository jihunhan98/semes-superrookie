"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {useParams,useRouter} from "next/navigation";
import Header from "../../../components/Header";
import ProjectSidebar from "../../../components/ProjectSidebar";
import ReviewIcon from "../../../components/ReviewIcon";
import {getProject,type ProjectDetail} from "../../../lib/api";
import {listDeliverables,type DeliverableGroup} from "../../../lib/api/v2";
import {ARTIFACT_TYPES} from "../../../lib/artifacts/document.mjs";
import {devId} from "../../../lib/identifiers";
import {getCurrentUser} from "../../../lib/session";
import "../../../components/jira/aui-9.12.0.scoped.css";
import styles from "../../../components/ArtifactsIndex.module.css";
import frame from "../../../components/ArtifactWorkspace.module.css";
type Category='all'|'issue'|'voc'|'functional'|'nonfunctional'|'detail-design';
const categories=[{type:'all',label:'전체'},{type:'issue',label:'개발 이슈'},...ARTIFACT_TYPES] as const;
const prefix:Record<string,string>={voc:'VOC',functional:'FR',nonfunctional:'NFR','detail-design':'DD'};
export default function ArtifactsPage(){
 const router=useRouter(),params=useParams<{id:string}>(),projectId=Number(params.id);
 const [project,setProject]=useState<ProjectDetail|null>(null),[rows,setRows]=useState<DeliverableGroup[]|null>(null);
 const [error,setError]=useState<string|null>(null),[sidebarOpen,setSidebarOpen]=useState(true),[retry,setRetry]=useState(0);
 const [query,setQuery]=useState(''),[status,setStatus]=useState('all'),[category,setCategory]=useState<Category>('all'),[collapsed,setCollapsed]=useState<number[]>([]),[page,setPage]=useState(0);
 useEffect(()=>{const small=window.matchMedia('(max-width:900px)');if(small.matches)setSidebarOpen(false);},[]);
 useEffect(()=>{
  const user=getCurrentUser();if(!user){router.replace('/login');return;}let active=true;const c=new AbortController();setError(null);
  Promise.all([getProject(projectId,user.id),listDeliverables(projectId,user.id,c.signal)]).then(([p,r])=>{if(active){setProject(p);setRows(r);}}).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:'산출물 목록을 불러오지 못했습니다.');});
  return()=>{active=false;c.abort();};
 },[projectId,router,retry]);
 const q=query.trim().toLowerCase();
 function stateMatches(state:string){return status==='all'||(status==='confirmed')===(state==='CONFIRMED');}
 function matching(type:Category){return (rows??[]).flatMap(group=>{
  const sourceMatch=`${group.reqKey} ${group.content}`.toLowerCase().includes(q);
  return group.issues.flatMap(issue=>{
   const issueMatch=sourceMatch||`${devId(issue.id)} ${issue.issueKey} ${issue.title}`.toLowerCase().includes(q);
   const showIssue=(type==='all'||type==='issue')&&issueMatch&&stateMatches(issue.state);
   const docs=issue.artifacts.filter(doc=>(type==='all'||type===doc.type)&&stateMatches(doc.state)&&(issueMatch||`${prefix[doc.type]}-${String(doc.id).padStart(6,'0')} ${ARTIFACT_TYPES.find(t=>t.type===doc.type)?.label??''}`.toLowerCase().includes(q)));
   return showIssue||docs.length?[{group,issue,showIssue,docs}]:[];
  });
 });}
 const visible=matching(category),count=visible.reduce((n,row)=>n+(row.showIssue?1:0)+row.docs.length,0);
 const pages=Math.max(1,Math.ceil(visible.length/25)),safePage=Math.min(page,pages-1),slice=visible.slice(safePage*25,(safePage+1)*25);
 const groups=Array.from(new Set(slice.map(row=>row.group.requirementId))).map(id=>({group:slice.find(row=>row.group.requirementId===id)!.group,rows:slice.filter(row=>row.group.requirementId===id)}));
 const go=(req:number,issue:number,type?:string)=>`/projects/${projectId}/requirements/${req}/review?issue=${issue}${type?`&artifact=${type}`:''}`;
 const clear=()=>{setQuery('');setStatus('all');setCategory('all');setPage(0);};
 return <div className={`appshell ${frame.frame}`}><Header projectName={project?.name} onToggleSidebar={()=>setSidebarOpen(value=>!value)}/><div className="body">
  {sidebarOpen&&project&&<ProjectSidebar projectId={projectId} projectName={project.name} active="artifacts"/>}
  <main className={`main jira-dc-ui ${styles.page}`}>
   <nav className={styles.breadcrumb} aria-label="현재 위치"><Link href={`/projects/${projectId}`}>{project?.name??'프로젝트'}</Link><span>/</span><span aria-current="page">산출물</span></nav>
   <header className={styles.heading}><div><h1>산출물</h1><p>요구사항별 개발 이슈와 연결된 산출물을 확인합니다. 제목이나 본문을 누르면 해당 내용을 엽니다.</p></div></header>
   {error?<div className="aui-message aui-message-error" role="alert"><p>{error}</p><button className="aui-button" onClick={()=>setRetry(v=>v+1)}>다시 불러오기</button></div>:!rows||!project?<p className={styles.empty} role="status">개발 이슈와 산출물을 불러오는 중입니다.</p>:<>
    <div className={styles.filters}><label className={styles.search}><ReviewIcon name="search" size={17}/><input aria-label="산출물 검색" value={query} onChange={event=>{setQuery(event.target.value);setPage(0);}} placeholder="REQ ID, 개발 이슈·문서 ID, 제목·본문 검색"/></label><label className={styles.status}>확정 상태 <select value={status} aria-label="산출물 상태 필터" onChange={event=>{setStatus(event.target.value);setPage(0);}}><option value="all">전체</option><option value="confirmed">확정</option><option value="draft">미확정</option></select></label><button className="aui-button aui-button-link" onClick={clear}>필터 초기화</button></div>
    <div className={styles.categories} aria-label="산출물 종류 필터">{categories.map(tab=>{const records=matching(tab.type as Category).reduce((n,row)=>n+(row.showIssue?1:0)+row.docs.length,0);return <button className={`aui-button ${category===tab.type?'aui-button-primary':''}`} type="button" aria-pressed={category===tab.type} key={tab.type} onClick={()=>{setCategory(tab.type as Category);setPage(0);setCollapsed([]);}}>{tab.label} <span className="aui-badge">{records}</span></button>;})}</div>
    <div className={styles.resultBar}><p role="status">결과 <b>{count}</b>개 기록 · 개발 이슈 {visible.length}개 · 요구사항 {new Set(visible.map(row=>row.group.requirementId)).size}개</p><div><button className="aui-button aui-button-link" onClick={()=>setCollapsed([])}>모두 펼치기</button><button className="aui-button aui-button-link" onClick={()=>setCollapsed(visible.map(row=>row.issue.id))}>모두 접기</button></div></div>
    <div className={styles.groupList}>
     {groups.map(({group,rows:issues})=><section className={styles.group} key={group.requirementId} aria-label={`${group.reqKey}의 개발 이슈`}>
      <header className={styles.sourceHeading}><Link className={styles.sourceKey} href={`/projects/${projectId}/requirements/${group.requirementId}`}>{group.reqKey}</Link><Link className={styles.sourceContent} href={`/projects/${projectId}/requirements/${group.requirementId}`}>{group.content}</Link><span className={styles.sourceVersion}>{group.version?`v${group.version}`:'초안'} · {group.workflow.label}</span></header>
      {issues.map(({issue,showIssue,docs})=>{const closed=collapsed.includes(issue.id);return <article className={styles.issue} key={issue.id}>
       <div className={styles.issueHeading}>{docs.length>0?<button type="button" className={styles.disclosure} aria-expanded={!closed} aria-controls={`docs-${issue.id}`} aria-label={`${devId(issue.id)} 산출물 ${closed?'펼치기':'접기'}`} onClick={()=>setCollapsed(ids=>closed?ids.filter(id=>id!==issue.id):[...ids,issue.id])}>{closed?'▸':'▾'}</button>:<span className={styles.disclosure}/>}
        <div className={styles.issueTitle}><Link className={styles.id} href={go(group.requirementId,issue.id)}>{devId(issue.id)}</Link><Link className={styles.title} href={go(group.requirementId,issue.id)}>{issue.title}</Link>{!showIssue&&<small>아래 산출물이 속한 개발 이슈 · 결과 수에 중복 포함하지 않음</small>}</div><span className={`aui-lozenge aui-lozenge-subtle ${issue.state==='CONFIRMED'?'aui-lozenge-success':'aui-lozenge-inprogress'}`}>{issue.state==='CONFIRMED'?'확정':'미확정'}</span><span className={styles.docCount}>문서 {issue.artifacts.length}/4</span>
       </div>
       {docs.length>0&&<ul id={`docs-${issue.id}`} className={styles.docs} hidden={closed}>{docs.map(doc=>{const type=ARTIFACT_TYPES.find(t=>t.type===doc.type);return <li key={doc.id}><span className={styles.docType}>{type?.label}</span><Link className={styles.docLink} href={go(group.requirementId,issue.id,doc.type)}><span>{prefix[doc.type]}-{String(doc.id).padStart(6,'0')}</span>{issue.title} · {type?.label}</Link><span className={`aui-lozenge aui-lozenge-subtle ${doc.state==='CONFIRMED'?'aui-lozenge-success':'aui-lozenge-inprogress'}`}>{doc.state==='CONFIRMED'?'확정':'초안'}</span><Link className="aui-button aui-button-link" href={go(group.requirementId,issue.id,doc.type)}>열기</Link></li>;})}</ul>}
      </article>;})}
     </section>)}
     {!visible.length&&<div className={styles.empty}>{rows.length?'검색 조건에 맞는 개발 이슈·산출물이 없습니다.':'아직 도출된 개발 이슈가 없습니다. 요구사항을 확정한 뒤 개발 이슈와 산출물을 생성해주세요.'}</div>}
    </div>
    {pages>1&&<nav className={styles.pagination} aria-label="개발 이슈 목록 페이지"><button className="aui-button" disabled={safePage===0} onClick={()=>setPage(safePage-1)}>이전</button><span>{safePage+1} / {pages} · 페이지당 개발 이슈 25개</span><button className="aui-button" disabled={safePage===pages-1} onClick={()=>setPage(safePage+1)}>다음</button></nav>}
   </>}
  </main>
 </div></div>;
}
