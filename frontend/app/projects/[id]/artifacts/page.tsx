"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {useParams,useRouter} from "next/navigation";
import Header from "../../../components/Header";
import ProjectSidebar from "../../../components/ProjectSidebar";
import ReviewIcon from "../../../components/ReviewIcon";
import {getProject,listRequirements,type ProjectDetail,type RequirementSummary} from "../../../lib/api";
import {getCurrentUser} from "../../../lib/session";
import "../../../components/jira/aui-9.12.0.scoped.css";
import styles from "../../../components/ArtifactsIndex.module.css";

export default function ArtifactsPage(){
 const router=useRouter(),params=useParams<{id:string}>(),projectId=Number(params.id);
 const [project,setProject]=useState<ProjectDetail|null>(null),[rows,setRows]=useState<RequirementSummary[]|null>(null);
 const [error,setError]=useState<string|null>(null),[sidebarOpen,setSidebarOpen]=useState(true);
 const [query,setQuery]=useState(''),[status,setStatus]=useState('all');
 useEffect(()=>{
  let active=true;const user=getCurrentUser();if(!user){router.replace('/login');return;}
  Promise.all([getProject(projectId,user.id),listRequirements(projectId,user.id)]).then(([p,r])=>{if(active){setProject(p);setRows(r);}}).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:'산출물 목록을 불러오지 못했습니다.');});
  return()=>{active=false;};
 },[projectId,router]);
 const visible=(rows??[]).filter(row=>(status==='all'||(status==='confirmed')===(row.state==='CONFIRMED'))&&`${row.reqKey} ${row.content} ${row.assigneeName??''}`.toLowerCase().includes(query.trim().toLowerCase()));
 return <div className="appshell"><Header projectName={project?.name} onToggleSidebar={()=>setSidebarOpen(value=>!value)}/><div className="body">
  {sidebarOpen&&project&&<ProjectSidebar projectId={projectId} projectName={project.name} active="artifacts"/>}
  <main className={`main jira-dc-ui ${styles.page}`}>
   <nav className={styles.breadcrumb} aria-label="현재 위치"><Link href={`/projects/${projectId}`}>{project?.name??'프로젝트'}</Link><span>/</span><span aria-current="page">산출물</span></nav>
   <header className={styles.heading}><div><h1>산출물</h1><p>요구사항을 선택해 개발 이슈와 SWVOC·기능·비기능·상세 설계를 확인합니다.</p></div>{rows&&<span className="aui-badge">{rows.length}개 요구사항</span>}</header>
   {error?<p className="aui-message aui-message-error" role="alert">{error}</p>:!rows||!project?<p className={styles.empty} role="status">산출물 목록을 불러오는 중입니다.</p>:<>
    <div className={styles.filters}><label className={styles.search}><ReviewIcon name="search" size={17}/><input aria-label="산출물 검색" value={query} onChange={event=>setQuery(event.target.value)} placeholder="요구사항 ID, 내용, 담당자 검색"/></label><label className={styles.status}>요구사항 상태 <select value={status} aria-label="요구사항 상태 필터" onChange={event=>setStatus(event.target.value)}><option value="all">전체</option><option value="confirmed">확정</option><option value="pending">미확정</option></select></label><span className={styles.resultCount}>{visible.length}개 표시</span></div>
    <div className={styles.tableScroll}><table className={`aui ${styles.table}`}><thead><tr><th scope="col">요구사항</th><th scope="col">내용</th><th scope="col">상태</th><th scope="col">버전</th><th scope="col">담당자</th><th scope="col">수정일</th><th scope="col">산출물</th></tr></thead><tbody>
     {visible.map(row=><tr key={row.id}><td><Link href={`/projects/${projectId}/requirements/${row.id}`}>{row.reqKey}</Link></td><td className={styles.content}><p>{row.content}</p></td><td><span className={`aui-lozenge aui-lozenge-subtle ${row.state==='CONFIRMED'?'aui-lozenge-success':'aui-lozenge-inprogress'}`}>{row.stateLabel}</span></td><td>{row.version??'—'}</td><td>{row.assigneeName??'미지정'}</td><td>{row.updatedAt?.replace('T',' ').slice(0,16)??'—'}</td><td>{row.state==='CONFIRMED'?<Link className="aui-button" href={`/projects/${projectId}/artifacts/${row.id}`}>열기</Link>:<span className={styles.pending}>요구사항 확정 후 가능</span>}</td></tr>)}
     {!visible.length&&<tr><td colSpan={7} className={styles.empty}>{rows.length?'검색 조건에 맞는 요구사항이 없습니다.':'아직 등록된 요구사항이 없습니다.'}</td></tr>}
    </tbody></table></div>
   </>}
  </main>
 </div></div>;
}
