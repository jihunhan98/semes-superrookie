"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {useParams,useRouter} from "next/navigation";
import Header from "../../../components/Header";
import ProjectSidebar from "../../../components/ProjectSidebar";
import {getProject,listRequirements,listDevIssues,type ProjectDetail,type RequirementSummary,type DevIssue} from "../../../lib/api";
import {getCurrentUser} from "../../../lib/session";
type Group={requirement:RequirementSummary;issues:DevIssue[];error?:string};
export default function ArtifactsPage(){const {id}=useParams<{id:string}>(),router=useRouter(),projectId=Number(id);const [project,setProject]=useState<ProjectDetail|null>(null),[groups,setGroups]=useState<Group[]|null>(null),[error,setError]=useState("");
useEffect(()=>{let active=true;const user=getCurrentUser();if(!user){router.replace('/login');return;}Promise.all([getProject(projectId,user.id),listRequirements(projectId,user.id)]).then(async([p,rs])=>{const rows=await Promise.all(rs.map(async requirement=>{try{return {requirement,issues:await listDevIssues(projectId,requirement.id,user.id)};}catch(e){return {requirement,issues:[],error:e instanceof Error?e.message:'이슈 조회 실패'};}}));if(active){setProject(p);setGroups(rows);}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[projectId,router]);
return <div className="appshell"><Header projectName={project?.name}/><div className="body">{project&&<ProjectSidebar projectId={projectId} projectName={project.name} active="artifacts"/>}<main className="main"><h1>산출물 · 개발 이슈 {groups?.reduce((n,g)=>n+g.issues.length,0)??''}</h1><p>요구사항에서 도출한 개발 이슈와 연결된 이슈를 확인합니다.</p>{error&&<p role="alert">{error}</p>}{!groups&&!error&&<p>불러오는 중…</p>}{groups?.map(({requirement:r,issues,error})=><section className="setcard" key={r.id} style={{padding:20,marginBottom:16}}><p>원본: <Link href={`/projects/${projectId}/requirements/${r.id}`}>{r.reqKey}</Link> · 요구사항 상태: {r.stateLabel}</p>{error?<p className="lmsg err">{error}</p>:issues.length?<><Link className="btn" href={`/projects/${projectId}/requirements/${r.id}/review`}>검토·확정 현황 보기 →</Link>{issues.map(issue=><p key={issue.id}><Link href={`/projects/${projectId}/requirements/${r.id}/issues/${issue.id}`}>{issue.issueKey} · {issue.title} →</Link></p>)}</>:<><p>아직 도출된 개발 이슈가 없습니다.</p><Link className="btn" href={`/projects/${projectId}/requirements/${r.id}/${r.state==='CONFIRMED'?'issues':'edit'}`}>{r.state==='CONFIRMED'?'개발 이슈 도출':'요구사항 검토·확정하기'} →</Link></>}</section>)}</main></div></div>;
}
