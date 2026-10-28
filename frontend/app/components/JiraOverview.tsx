"use client";
import {useEffect,useState} from "react";
import {listJiraTargets,type JiraTarget} from "../lib/api";
import {getCurrentUser} from "../lib/session";
export default function JiraOverview({projectId}:{projectId:number}) {
 const [targets,setTargets]=useState<JiraTarget[]|null>(null),[error,setError]=useState("");
 useEffect(()=>{let active=true;const user=getCurrentUser();if(user)listJiraTargets(projectId,user.id).then(v=>{if(active)setTargets(v);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[projectId]);
 return <div className="frow"><span className="k">Jira</span><div>{error||(!targets?"불러오는 중…":targets.length?targets.map(t=><div key={t.id}><a href={`${t.baseUrl}/projects/${encodeURIComponent(t.jiraProjectKey)}`} target="_blank" rel="noopener noreferrer">{t.displayName} ({t.jiraProjectKey}) ↗</a></div>):"연결된 Jira 프로젝트가 없습니다.")}</div></div>;
}
