"use client";

import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {useParams,useRouter} from "next/navigation";
import Header from "../../../components/Header";
import ProjectSidebar from "../../../components/ProjectSidebar";
import ReviewIcon from "../../../components/ReviewIcon";
import {getProject,type ProjectDetail} from "../../../lib/api";
import {listDeliverables,type DeliverableGroup} from "../../../lib/api/v2";
import {devId} from "../../../lib/identifiers";
import {getCurrentUser} from "../../../lib/session";
import "../../../components/jira/aui-9.12.0.scoped.css";
import styles from "../../../components/ArtifactsIndex.module.css";
import frame from "../../../components/ArtifactWorkspace.module.css";

type IssueRow={requirementId:number;reqKey:string;id:number;issueKey:string;title:string;state:string};
const PAGE_SIZE=25;

export default function ArtifactsPage(){
 const router=useRouter(),params=useParams<{id:string}>(),projectId=Number(params.id);
 const [project,setProject]=useState<ProjectDetail|null>(null),[rows,setRows]=useState<DeliverableGroup[]|null>(null);
 const [error,setError]=useState<string|null>(null),[sidebarOpen,setSidebarOpen]=useState(true),[retry,setRetry]=useState(0);
 const [query,setQuery]=useState(''),[status,setStatus]=useState('all'),[page,setPage]=useState(0);
 const [recentlyConfirmed,setRecentlyConfirmed]=useState<number|null>(null);

 useEffect(()=>{const small=window.matchMedia('(max-width:900px)');if(small.matches)setSidebarOpen(false);},[]);
 useEffect(()=>{
  const user=getCurrentUser();if(!user){router.replace('/login');return;}
  let active=true;const controller=new AbortController();setError(null);
  Promise.all([getProject(projectId,user.id),listDeliverables(projectId,user.id,controller.signal)])
   .then(([p,result])=>{if(!active)return;setProject(p);setRows(result);
    const confirmedId=Number(new URLSearchParams(window.location.search).get('confirmedReq'));
    const index=result.flatMap(group=>group.issues.map(()=>group.requirementId)).findIndex(id=>id===confirmedId);
    if(Number.isSafeInteger(confirmedId)&&confirmedId>0&&index>=0){
     setRecentlyConfirmed(confirmedId);setPage(Math.floor(index/PAGE_SIZE));
    }
   }).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:'개발 이슈 목록을 불러오지 못했습니다.');});
  return()=>{active=false;controller.abort();};
 },[projectId,router,retry]);

 const issues=useMemo<IssueRow[]>(()=>rows?.flatMap(group=>group.issues.map(issue=>({
  requirementId:group.requirementId,reqKey:group.reqKey,id:issue.id,issueKey:issue.issueKey,
  title:issue.title,state:issue.state,
 })))??[],[rows]);
 const visible=useMemo(()=>issues.filter(issue=>{
  if(status!=='all'&&(status==='confirmed')!==(issue.state==='CONFIRMED'))return false;
  const term=query.trim().toLowerCase();
  return !term||[devId(issue.id),issue.issueKey,issue.title,issue.reqKey].join(' ').toLowerCase().includes(term);
 }),[issues,query,status]);
 const pages=Math.max(1,Math.ceil(visible.length/PAGE_SIZE)),currentPage=Math.min(page,pages-1);
 const selected=visible.slice(currentPage*PAGE_SIZE,(currentPage+1)*PAGE_SIZE);
 const issueLink=(issue:IssueRow)=>`/projects/${projectId}/requirements/${issue.requirementId}/review?issue=${issue.id}`;
 const confirmedGroup=rows?.find(group=>group.requirementId===recentlyConfirmed);

 return <div className={`appshell ${frame.frame}`}><Header projectName={project?.name} onToggleSidebar={()=>setSidebarOpen(value=>!value)}/><div className="body">
  {sidebarOpen&&project&&<ProjectSidebar projectId={projectId} projectName={project.name} active="artifacts"/>}
  <main className={`main jira-dc-ui ${styles.page}`}>
   <nav className={styles.breadcrumb} aria-label="현재 위치"><Link href={`/projects/${projectId}`}>{project?.name??'프로젝트'}</Link><span>/</span><span aria-current="page">개발 이슈</span></nav>
   <header className={styles.heading}><div><h1>개발 이슈</h1><p>이슈 제목을 선택하면 상세 내용과 연결된 산출물을 볼 수 있습니다.</p></div></header>
   {confirmedGroup&&<div className="aui-message aui-message-success" role="status"><p><strong>{confirmedGroup.reqKey}</strong>의 개발 이슈와 산출물을 확정했습니다.</p>{confirmedGroup.issues[0]&&<Link href={`/projects/${projectId}/requirements/${confirmedGroup.requirementId}/review?issue=${confirmedGroup.issues[0].id}`}>확정한 이슈 상세 보기</Link>}</div>}
   {error?<div className="aui-message aui-message-error" role="alert"><p>{error}</p><button className="aui-button" onClick={()=>setRetry(value=>value+1)}>다시 불러오기</button></div>:!rows||!project?<p className={styles.empty} role="status">개발 이슈를 불러오는 중입니다.</p>:<>
    <div className={styles.filters}>
     <label className={styles.search}><ReviewIcon name="search" size={17}/><input aria-label="개발 이슈 검색" value={query} onChange={event=>{setQuery(event.target.value);setPage(0);}} placeholder="이슈 제목 또는 ID 검색"/></label>
     <label className={styles.status}>상태 <select value={status} aria-label="개발 이슈 상태 필터" onChange={event=>{setStatus(event.target.value);setPage(0);}}><option value="all">전체</option><option value="confirmed">확정</option><option value="draft">검토 중</option></select></label>
     <button className="aui-button aui-button-link" onClick={()=>{setQuery('');setStatus('all');setPage(0);}}>필터 초기화</button>
    </div>
    <div className={styles.resultBar} role="status">개발 이슈 <strong>{visible.length}</strong>개</div>
    <div className={styles.list} role="list" aria-label="개발 이슈 목록">
     {selected.map(issue=><div role="listitem" className={`${styles.row} ${issue.requirementId===recentlyConfirmed?styles.recentRow:''}`} key={issue.id}>
      <div className={styles.issueIcon} aria-hidden="true"><ReviewIcon name="file" size={17}/></div>
      <div className={styles.issueIdentity}><Link className={styles.title} href={issueLink(issue)}>{issue.title}</Link><div className={styles.metadata}><span>{devId(issue.id)}</span><span aria-hidden="true">·</span><span>{issue.reqKey}</span></div></div>
      <span className={`aui-lozenge aui-lozenge-subtle ${issue.state==='CONFIRMED'?'aui-lozenge-success':'aui-lozenge-inprogress'}`}>{issue.state==='CONFIRMED'?'확정':'검토 중'}</span>
      <span className={styles.chevron} aria-hidden="true">›</span>
     </div>)}
     {!visible.length&&<p className={styles.empty}>{issues.length?'검색 조건에 맞는 개발 이슈가 없습니다.':'아직 개발 이슈가 없습니다. 요구사항을 확정하고 이슈를 도출해주세요.'}</p>}
    </div>
    {pages>1&&<nav className={styles.pagination} aria-label="개발 이슈 페이지"><button className="aui-button" disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>이전</button><span>{currentPage+1} / {pages}</span><button className="aui-button" disabled={currentPage===pages-1} onClick={()=>setPage(currentPage+1)}>다음</button></nav>}
   </>}
  </main>
 </div></div>;
}
