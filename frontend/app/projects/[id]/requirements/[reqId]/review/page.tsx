"use client";
import Link from "next/link";
import {useEffect,useRef,useState} from "react";
import {useParams,useRouter,useSearchParams} from "next/navigation";
import Header from "../../../../../components/Header";
import ProjectSidebar from "../../../../../components/ProjectSidebar";
import WorkflowStepper from "../../../../../components/WorkflowStepper";
import ReviewIcon from "../../../../../components/ReviewIcon";
import ArtifactDocument from "../../../../../components/ArtifactDocument";
import ArtifactRichText from "../../../../../components/ArtifactRichText";
import {ARTIFACT_TYPES} from "../../../../../lib/artifacts/document.mjs";
import {devId} from "../../../../../lib/identifiers";
import {confirmBundle,retryJob} from "../../../../../lib/api/v2";
import {getArtifact,getProject,getRequirement,type ArtifactDetail,type ArtifactTypeSlug,type ProjectDetail,type RequirementDetail,type User} from "../../../../../lib/api";
import {useBundle} from "../../../../../lib/hooks/useBundle";
import {getCurrentUser} from "../../../../../lib/session";
import styles from "../../../../../components/ArtifactReviewPage.module.css";
type Tab='issue'|ArtifactTypeSlug;
function validTab(value:string|null):Tab{return ARTIFACT_TYPES.some(item=>item.type===value)?value as ArtifactTypeSlug:'issue';}
function date(value:string|null|undefined){return value?value.replace('T',' ').slice(0,16):'—';}
export default function ReviewPage(){
 const params=useParams<{id:string;reqId:string}>(),router=useRouter(),search=useSearchParams();
 const projectId=Number(params.id),requirementId=Number(params.reqId),query=search.toString();
 const [user,setUser]=useState<User|null>(null),[project,setProject]=useState<ProjectDetail|null>(null),[requirement,setRequirement]=useState<RequirementDetail|null>(null);
 const [sidebarOpen,setSidebarOpen]=useState(true),[selectedIssue,setSelectedIssue]=useState<number|null>(null),[activeTab,setActiveTab]=useState<Tab>(validTab(search.get('artifact'))),[filter,setFilter]=useState('');
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState<{error:boolean;text:string}|null>(null),[retry,setRetry]=useState(0);
 const [loaded,setLoaded]=useState<{key:string;document:ArtifactDetail|null;error:string|null}|null>(null);
 const cache=useRef(new Map<string,ArtifactDetail>()),pending=useRef(false);
 const {data,error,reload}=useBundle(projectId,requirementId,user?.id);
 const requested=data?.issues.find(item=>String(item.id)===search.get('issue')||item.issueKey===search.get('issueKey'));
 const issue=data?.issues.find(item=>item.id===selectedIssue)??requested??data?.issues[0];
 const summary=issue?.artifacts.find(item=>item.type===activeTab);
 const documentKey=issue&&summary&&activeTab!=='issue'?`${projectId}:${requirementId}:${issue.id}:${summary.id}:${activeTab}:${summary.revision}`:'';
 const doc=loaded?.key===documentKey?loaded:null;
 useEffect(()=>{setSelectedIssue(null);setActiveTab(validTab(new URLSearchParams(query).get('artifact')));},[projectId,requirementId,query]);
 useEffect(()=>{const media=window.matchMedia('(max-width:900px)');const sync=()=>setSidebarOpen(!media.matches);sync();media.addEventListener('change',sync);return()=>media.removeEventListener('change',sync);},[]);
 useEffect(()=>{let active=true;const current=getCurrentUser();if(!current){router.replace('/login');return;}setUser(current);Promise.all([getProject(projectId,current.id),getRequirement(projectId,requirementId,current.id)]).then(([p,r])=>{if(active){setProject(p);setRequirement(r);}}).catch(cause=>{if(active)setNotice({error:true,text:cause.message});});return()=>{active=false;};},[projectId,requirementId,router]);
 useEffect(()=>{
  if(!documentKey||!issue||!user||activeTab==='issue')return;let active=true;const saved=cache.current.get(documentKey);
  if(saved){setLoaded({key:documentKey,document:saved,error:null});return;}
  setLoaded({key:documentKey,document:null,error:null});
  getArtifact(projectId,requirementId,issue.issueKey,activeTab,user.id).then(document=>{cache.current.set(documentKey,document);if(active)setLoaded({key:documentKey,document,error:null});}).catch(cause=>{if(active)setLoaded({key:documentKey,document:null,error:cause instanceof Error?cause.message:'산출물을 불러오지 못했습니다.'});});
  return()=>{active=false;};
 },[documentKey,projectId,requirementId,issue?.issueKey,user?.id,activeTab,retry]);
 async function finish(){if(!data||!user||pending.current)return;pending.current=true;setBusy(true);setNotice(null);try{await confirmBundle(projectId,requirementId,user.id,data.revision,crypto.randomUUID());await reload();setNotice({error:false,text:'개발 이슈와 산출물을 전체 확정했습니다.'});}catch(cause){setNotice({error:true,text:cause instanceof Error?cause.message:'전체 확정하지 못했습니다.'});}finally{pending.current=false;setBusy(false);}}
 async function retryGeneration(){if(!data?.generation||!user||pending.current)return;pending.current=true;setBusy(true);setNotice(null);try{await retryJob(data.generation.id,user.id);await reload();setNotice({error:false,text:'실패한 산출물을 다시 생성합니다.'});}catch(cause){setNotice({error:true,text:cause instanceof Error?cause.message:'재시도하지 못했습니다.'});}finally{pending.current=false;setBusy(false);}}
 const count=data?.issues.reduce((n,item)=>n+ARTIFACT_TYPES.filter(type=>item.artifacts.some(doc=>doc.type===type.type)).length,0)??0;
 const expected=(data?.issues.length??0)*4,confirmed=data?.state==='CONFIRMED';
 const incomplete=data?.state==='GENERATING'||Boolean(data?.generation&&(data.generation.failed>0||data.generation.pending>0))||count<expected;
 const visible=data?.issues.filter(item=>`${devId(item.id)} ${item.title}`.toLowerCase().includes(filter.toLowerCase()))??[];
 const position=data?.issues.findIndex(item=>item.id===issue?.id)??0;
 const activeLabel=ARTIFACT_TYPES.find(type=>type.type===activeTab);
 function chooseIssue(id:number){setSelectedIssue(id);setActiveTab('issue');}
 return <div className="appshell"><Header projectName={project?.name} onToggleSidebar={()=>setSidebarOpen(v=>!v)}/><div className="body">{sidebarOpen&&project&&<ProjectSidebar projectId={projectId} projectName={project.name} active="artifacts"/>}<main className={`main ${styles.page}`}>
 <WorkflowStepper step={4}/><nav className={styles.breadcrumb} aria-label="현재 위치"><Link href={`/projects/${projectId}/requirements`}>요구사항</Link><span>/</span><Link href={`/projects/${projectId}/requirements/${requirementId}`}>{requirement?.reqKey??'요구사항'}</Link><span>/</span><b>산출물 검토</b></nav>
 <header className={styles.heading}><div><div className={styles.eyebrow}><ReviewIcon name="file" size={13}/><span>REVIEW & CONFIRM</span><i/>{requirement?.reqKey??'—'}{requirement?.version&&<span>v{requirement.version}</span>}</div><h1>산출물 검토</h1><p>개발 이슈별 문서와 설계 흐름을 확인하고, 최종 산출물을 확정합니다.</p></div><span className={`${styles.status} ${incomplete?styles.pending:''}`}><ReviewIcon name={incomplete?'clock':'check'} size={14}/>{!data?'불러오는 중':confirmed?'전체 확정 완료':incomplete?'산출물 생성 확인 필요':'검토 준비 완료'}</span></header>
 {!data||!project||!requirement?<div className={styles.loading} role={error||notice?.error?'alert':'status'}>{error??notice?.text??'산출물과 개발 이슈를 불러오는 중입니다.'}</div>:<>
 <section className={styles.metrics} aria-label="산출물 현황"><div><span className={styles.metricIcon}><ReviewIcon name="file" size={21}/></span><div><span>개발 이슈</span><b>{data.issues.length}<small>개</small></b></div></div><div><span className={`${styles.metricIcon} ${styles.blue}`}><ReviewIcon name="diagram" size={21}/></span><div><span>생성된 산출물</span><b>{count}<small>/ {expected}개</small></b></div></div><div><span className={`${styles.metricIcon} ${styles.green}`}><ReviewIcon name={confirmed?'check':'edit'} size={21}/></span><div><span>현재 단계</span><b className={styles.metricText}>{confirmed?'확정 완료':incomplete?'생성 확인':'내용 검토'}<small>{confirmed?'확정본':'4종 문서'}</small></b></div></div></section>
 {incomplete&&<div className={styles.generation} role="status"><ReviewIcon name={data.generation?.failed?'alert':'clock'} size={18}/><div><b>{data.generation?.failed?'일부 산출물 생성에 실패했습니다.':data.state==='GENERATING'?'산출물을 준비하고 있습니다.':'아직 생성되지 않은 산출물이 있습니다.'}</b><p>생성된 문서는 아래에서 확인할 수 있습니다.{data.generation?` 생성 ${data.generation.succeeded} · 대기 ${data.generation.pending} · 실패 ${data.generation.failed}`:''}</p></div>{Boolean(data.generation?.failed)&&<button className={styles.secondary} disabled={busy} onClick={retryGeneration}><ReviewIcon name="refresh" size={14}/>실패만 재시도</button>}</div>}
 <div className={styles.workspace}><aside className={styles.navigator} aria-label="개발 이슈 목록"><div className={styles.navHeading}><div><ReviewIcon name="file" size={15}/><h2>개발 이슈</h2><span>{data.issues.length}</span></div><p>이슈를 선택해 산출물을 확인하세요.</p></div><label className={styles.search}><ReviewIcon name="search" size={15}/><input value={filter} onChange={e=>setFilter(e.target.value)} aria-label="개발 이슈 검색" placeholder="이슈 제목 또는 ID 검색"/></label><div className={styles.issueList}>
 {visible.map(item=>{const ready=ARTIFACT_TYPES.filter(type=>item.artifacts.some(doc=>doc.type===type.type)).length;return <button key={item.id} type="button" className={`${styles.issueItem} ${issue?.id===item.id?styles.selected:''}`} aria-current={issue?.id===item.id?'true':undefined} onClick={()=>chooseIssue(item.id)}><div className={styles.issueMeta}><span>{devId(item.id)}</span><small>{ready}/4 생성</small></div><h3>{item.title}</h3><div className={styles.docDots}>{ARTIFACT_TYPES.map(type=><span key={type.type} className={item.artifacts.some(doc=>doc.type===type.type)?styles.dotReady:''}><i/>{type.short}</span>)}</div><ReviewIcon name="chevron" size={15}/></button>;})}
 {!visible.length&&<p className={styles.navEmpty}>{data.issues.length?'검색 결과가 없습니다.':'아직 개발 이슈가 없습니다.'}</p>}</div><div className={styles.navFoot}><span><i/>생성된 문서</span><span>{count}개 문서</span></div></aside>
 <section className={styles.reader} aria-label="개발 이슈 및 산출물 상세">{issue?<>
 <header className={styles.readerHead}><div className={styles.readerMeta}><span>{devId(issue.id)}</span><i/><span>{requirement.reqKey}</span><span className={styles.readerState}>{confirmed?'확정본':'검토용 초안'}</span></div><h2>{issue.title}</h2><p>요구사항에서 나눈 개발 범위와 관련 산출물을 한곳에서 검토합니다.</p></header>
 <div className={styles.tabs} role="tablist" aria-label="산출물 선택" onKeyDown={event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const buttons=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role=tab]'));const index=buttons.indexOf(event.target as HTMLButtonElement);const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;buttons[next].focus();buttons[next].click();}}>{[{type:'issue',label:'개발 이슈'},...ARTIFACT_TYPES].map(type=><button type="button" role="tab" id={`tab-${type.type}`} key={type.type} tabIndex={activeTab===type.type?0:-1} aria-selected={activeTab===type.type} aria-controls="artifact-reader-panel" onClick={()=>setActiveTab(type.type as Tab)}><ReviewIcon name={type.type==='detail-design'?'diagram':'file'} size={14}/>{type.label}{type.type!=='issue'&&<i className={issue.artifacts.some(doc=>doc.type===type.type)?styles.tabReady:''}/>}</button>)}</div>
 <div className={styles.paper} role="tabpanel" id="artifact-reader-panel" aria-labelledby={`tab-${activeTab}`}>
 {activeTab==='issue'?<><div className={styles.paperTitle}><span className={styles.paperIcon}><ReviewIcon name="file" size={20}/></span><div><h3>개발 이슈 개요</h3><p>구현할 내용과 변경 범위를 확인합니다.</p></div></div><ArtifactDocument key={`issue-${issue.id}`} content={{symptom:issue.symptom,improvementReq:issue.improvementReq,changeScope:issue.changeScope,constraintsNote:issue.constraintsNote}}/><div className={styles.comparison}><section><span>AS-IS</span><h4>변경 전</h4>{issue.beforeState?<ArtifactRichText text={issue.beforeState}/>:<p className={styles.muted}>작성된 내용이 없습니다.</p>}</section><section><span>TO-BE</span><h4>변경 후</h4>{issue.afterState?<ArtifactRichText text={issue.afterState}/>:<p className={styles.muted}>작성된 내용이 없습니다.</p>}</section></div><div className={styles.issueDates}><span>생성일 <b>{date(issue.createdAt)}</b></span><span>목표일 <b>{date(issue.dueOn)}</b></span></div></>:<>
 <div className={styles.paperTitle}><span className={styles.paperIcon}><ReviewIcon name={activeTab==='detail-design'?'diagram':'file'} size={21}/></span><div><h3>{activeLabel?.label}</h3><p>{activeLabel?.description}</p></div>{doc?.document&&<span className={styles.savedDate}>저장 {date(doc.document.updatedAt)}</span>}</div>
 {!summary?<div className={styles.documentEmpty}><ReviewIcon name="clock" size={30}/><h4>산출물이 아직 준비되지 않았습니다.</h4><p>생성이 완료되면 이 탭에서 내용을 확인할 수 있습니다.</p></div>:doc?.error?<div className={styles.documentEmpty} role="alert"><ReviewIcon name="alert" size={28}/><h4>산출물을 불러오지 못했습니다.</h4><p>{doc.error}</p><button className={styles.secondary} onClick={()=>{cache.current.delete(documentKey);setRetry(v=>v+1);}}>다시 불러오기</button></div>:!doc?.document?<div className={styles.documentLoading} role="status"><span/>문서를 불러오는 중입니다.</div>:<ArtifactDocument key={documentKey} content={doc.document.content}/>}</>}
 <details className={styles.source}><summary><ReviewIcon name="attachment" size={14}/>요구사항 근거<span>{requirement.reqKey}</span></summary><div>{issue.quote?<blockquote>{issue.quote}</blockquote>:<p className={styles.muted}>연결된 원문 구절이 없습니다.</p>}<details><summary>확정 요구사항 전체 보기</summary><ArtifactRichText text={requirement.content}/></details></div></details>
 </div><footer className={styles.readerFoot}><span>개발 이슈 {position+1} / {data.issues.length}</span><div><button className={styles.secondary} disabled={position<=0} onClick={()=>chooseIssue(data.issues[position-1].id)}>이전 이슈</button><button className={styles.secondary} disabled={position>=data.issues.length-1} onClick={()=>chooseIssue(data.issues[position+1].id)}>다음 이슈<ReviewIcon name="arrow" size={13}/></button></div></footer>
 </>:<div className={styles.documentEmpty}><ReviewIcon name="file" size={35}/><h3>검토할 개발 이슈가 없습니다.</h3><p>요구사항에서 개발 이슈와 산출물을 먼저 생성해주세요.</p><Link className={styles.secondary} href={`/projects/${projectId}/requirements/${requirementId}/issues`}>개발 이슈 도출로 이동<ReviewIcon name="arrow" size={14}/></Link></div>}</section></div>
 {error&&<p className={`${styles.message} ${styles.messageError}`} role="alert">{error}</p>}{notice&&<p className={`${styles.message} ${notice.error?styles.messageError:''}`} role={notice.error?'alert':'status'}>{notice.text}</p>}
 <footer className={styles.confirmBar}><span className={styles.confirmIcon}><ReviewIcon name={confirmed?'check':'file'} size={20}/></span><div><b>{confirmed?'개발 이슈와 산출물을 확정했습니다.':'검토한 내용으로 산출물을 확정합니다.'}</b><p>{confirmed?'확정 후에도 이 화면에서 모든 문서를 확인할 수 있습니다.':incomplete?'모든 산출물의 생성이 완료되면 전체 확정할 수 있습니다.':`${data.issues.length}개 개발 이슈와 ${count}개 산출물의 현재 내용을 함께 확정합니다.`}</p></div><button className={styles.primary} disabled={busy||!data.issues.length||confirmed||incomplete} onClick={finish}><ReviewIcon name="check" size={15}/>{confirmed?'전체 확정됨':busy?'확정 중…':'전체 확정'}</button></footer>
 </>}
 </main></div></div>;
}
