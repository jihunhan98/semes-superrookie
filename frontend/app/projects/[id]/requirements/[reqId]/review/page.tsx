"use client";
import Link from "next/link";
import {useEffect,useRef,useState} from "react";
import {useParams,useRouter,useSearchParams} from "next/navigation";
import Header from "../../../../../components/Header";
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
import "../../../../../components/jira/aui-9.12.0.scoped.css";
import styles from "../../../../../components/ArtifactReviewPage.module.css";
import frame from "../../../../../components/ArtifactWorkspace.module.css";
type Tab='issue'|ArtifactTypeSlug;
function validTab(value:string|null):Tab{return ARTIFACT_TYPES.some(item=>item.type===value)?value as ArtifactTypeSlug:'issue';}
function date(value:string|null|undefined){return value?value.replace('T',' ').slice(0,16):'—';}
export default function ReviewPage(){
 const params=useParams<{id:string;reqId:string}>(),router=useRouter(),search=useSearchParams();
 const projectId=Number(params.id),requirementId=Number(params.reqId),query=search.toString();
 const [user,setUser]=useState<User|null>(null),[project,setProject]=useState<ProjectDetail|null>(null),[requirement,setRequirement]=useState<RequirementDetail|null>(null);
 const [sidebarOpen,setSidebarOpen]=useState(true),[selectedIssue,setSelectedIssue]=useState<number|null>(null),[activeTab,setActiveTab]=useState<Tab>(validTab(search.get('artifact'))),[filter,setFilter]=useState('');
 const [wide,setWide]=useState(false);
 const sourceRef=useRef<HTMLDetailsElement>(null);
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState<{error:boolean;text:string}|null>(null),[retry,setRetry]=useState(0);
 const [loaded,setLoaded]=useState<{key:string;document:ArtifactDetail|null;error:string|null}|null>(null);
 const cache=useRef(new Map<string,ArtifactDetail>()),pending=useRef(false);
 const {data,error,reload,accept}=useBundle(projectId,requirementId,user?.id);
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
 async function finish(){if(!data||!user||pending.current)return;pending.current=true;setBusy(true);setNotice(null);try{const confirmed=await confirmBundle(projectId,requirementId,user.id,data.revision,crypto.randomUUID());if(confirmed.state!=='CONFIRMED')throw new Error('서버'+'에서 확정 완료 상태를 확인하지 못했습니다. 다시 조회해주세요.');accept(confirmed);setNotice({error:false,text:'개발 이슈와 산출물을 전체 확정했습니다.'});}catch(cause){setNotice({error:true,text:cause instanceof Error?cause.message:'전체 확정하지 못했습니다.'});}finally{pending.current=false;setBusy(false);}}
 async function retryGeneration(){if(!data?.generation||!user||pending.current)return;pending.current=true;setBusy(true);setNotice(null);try{await retryJob(data.generation.id,user.id);await reload();setNotice({error:false,text:'실패한 산출물을 다시 생성합니다.'});}catch(cause){setNotice({error:true,text:cause instanceof Error?cause.message:'재시도하지 못했습니다.'});}finally{pending.current=false;setBusy(false);}}
 const count=data?.issues.reduce((n,item)=>n+ARTIFACT_TYPES.filter(type=>item.artifacts.some(doc=>doc.type===type.type)).length,0)??0;
 const expected=(data?.issues.length??0)*4,confirmed=data?.state==='CONFIRMED';
 const incomplete=data?.state==='GENERATING'||Boolean(data?.generation&&(data.generation.failed>0||data.generation.pending>0))||count<expected;
 const visible=data?.issues.filter(item=>`${devId(item.id)} ${item.issueKey} ${item.title}`.toLowerCase().includes(filter.toLowerCase()))??[];
 const position=data?.issues.findIndex(item=>item.id===issue?.id)??0;
 const activeLabel=ARTIFACT_TYPES.find(type=>type.type===activeTab);
 function selectDocument(tab:Tab,id=issue?.id){
  if(id===undefined)return;
  setSelectedIssue(id);setActiveTab(tab);
  const next=new URLSearchParams(search.toString());next.set('issue',String(id));next.delete('issueKey');
  if(tab==='issue')next.delete('artifact');else next.set('artifact',tab);
  router.replace(`/projects/${projectId}/requirements/${requirementId}/review?${next}`,{scroll:false});
 }
 function chooseIssue(id:number){selectDocument('issue',id);}
 function showSource(){if(sourceRef.current){sourceRef.current.open=true;sourceRef.current.scrollIntoView({behavior:'smooth',block:'start'});}}

 return <div className={`appshell ${frame.frame}`}>
  <Header projectName={project?.name} onToggleSidebar={()=>setSidebarOpen(v=>!v)}/>
  <div className="body">
   <main className={`main jira-dc-ui ${styles.page}`}>
    <WorkflowStepper step={4} completed={confirmed}/>
    <nav className={styles.breadcrumb} aria-label="현재 위치">
     <Link href={`/projects/${projectId}/artifacts`}>산출물</Link><span>/</span>
     <Link href={`/projects/${projectId}/requirements/${requirementId}`}>{requirement?.reqKey??'요구사항'}</Link><span>/</span><span aria-current="page">검토·확정</span>
    </nav>
    <header className={styles.heading}>
     <div><h1>산출물 검토</h1><p>{requirement?.reqKey??'요구사항'} · 개발 이슈 {data?.issues.length??0}개 · 산출물 {count} / {expected}</p></div>
     <span className={`aui-lozenge aui-lozenge-subtle ${confirmed?'aui-lozenge-success':incomplete?'aui-lozenge-moved':'aui-lozenge-inprogress'}`}>
      {!data?'불러오는 중':confirmed?'전체 확정 완료':incomplete?'생성 확인 필요':'검토 중'}
     </span>
    </header>
    {!data||!project||!requirement?<div className={styles.loading} role={error||notice?.error?'alert':'status'}>{error??notice?.text??'산출물과 개발 이슈를 불러오는 중입니다.'}</div>:<>
     {incomplete&&<div className={`aui-message ${data.generation?.failed?'aui-message-warning':'aui-message-info'} ${styles.generation}`} role="status">
      <div><p className="title"><strong>{data.generation?.failed?'일부 산출물 생성에 실패했습니다.':data.state==='GENERATING'?'산출물을 생성하고 있습니다.':'아직 생성되지 않은 산출물이 있습니다.'}</strong></p>
       <p>준비된 문서는 지금 열어볼 수 있습니다.{data.generation?` 생성 ${data.generation.succeeded} · 대기 ${data.generation.pending} · 실패 ${data.generation.failed}`:''}</p></div>
      {Boolean(data.generation?.failed)&&<button className="aui-button" disabled={busy} onClick={retryGeneration}>실패한 산출물 재시도</button>}
     </div>}
     <div className={`${styles.workspace} ${wide?styles.workspaceWide:''} ${!sidebarOpen?styles.navigationCollapsed:''}`}>
      <aside className={styles.navigator} aria-label="개발 이슈 목록">
       <div className={styles.navHeading}><h2>개발 이슈 <span className="aui-badge">{data.issues.length}</span></h2><p>이슈별 문서 4종</p></div>
       <label className={styles.search}><ReviewIcon name="search" size={16}/><input value={filter} onChange={e=>setFilter(e.target.value)} aria-label="개발 이슈 검색" placeholder="ID 또는 제목 검색"/></label>
       <div className={styles.issueList}>
        {visible.map(item=>{
         const ready=ARTIFACT_TYPES.filter(type=>item.artifacts.some(doc=>doc.type===type.type)).length;
         return <button key={item.id} type="button" className={`${styles.issueItem} ${issue?.id===item.id?styles.selected:''}`} aria-current={issue?.id===item.id?'true':undefined} onClick={()=>chooseIssue(item.id)}>
          <div className={styles.issueMeta}><span>{devId(item.id)}</span><small>{ready}/4</small></div><h3>{item.title}</h3>
          <div className={styles.docDots}>{ARTIFACT_TYPES.map(type=><span key={type.type} className={item.artifacts.some(doc=>doc.type===type.type)?styles.dotReady:''}><i/>{type.short}</span>)}</div>
         </button>;
        })}
        {!visible.length&&<p className={styles.navEmpty}>{data.issues.length?'검색 결과가 없습니다.':'아직 개발 이슈가 없습니다.'}</p>}
       </div>
      </aside>
      <section className={styles.reader} aria-label="개발 이슈 및 산출물 상세">
       {issue?<>
        <header className={styles.readerHead}>
         <div className={styles.readerMeta}><span className={styles.typeIcon}><ReviewIcon name="check" size={13}/></span><span>{devId(issue.id)}</span><span>/</span><span>{requirement.reqKey}</span>
          <span className={`aui-lozenge aui-lozenge-subtle ${confirmed?'aui-lozenge-success':'aui-lozenge-inprogress'}`}>{confirmed?'확정':'검토 중'}</span>
         </div>
         <h2>{issue.title}</h2>
         <div className={styles.readerToolbar}>
          <button type="button" className="aui-button" onClick={showSource}>원문 근거</button>
          <button type="button" className="aui-button" aria-pressed={wide} onClick={()=>setWide(v=>!v)}>{wide?'기본 보기':'본문 넓게'}</button>
          {!confirmed&&<Link className="aui-button aui-button-link" href={`/projects/${projectId}/requirements/${requirementId}/issues`}>이슈 도출 화면</Link>}
          <span className={styles.savedDate}>{activeTab==='issue'?'개발 이슈':doc?.document?`저장 ${date(doc.document.updatedAt)}`:'산출물 문서'}</span>
         </div>
        </header>
        <div className={`aui-tabs horizontal-tabs ${styles.documentTabs}`}>
         <ul className={`tabs-menu ${styles.tabs}`} role="tablist" aria-label="산출물 선택" onKeyDown={event=>{
          if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();
          const buttons=Array.from(event.currentTarget.querySelectorAll<HTMLAnchorElement>('[role=tab]'));
          const index=buttons.indexOf(event.target as HTMLAnchorElement),next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;
          buttons[next].focus();buttons[next].click();
         }}>
          {[{type:'issue',label:'개발 이슈'},...ARTIFACT_TYPES].map(type=><li key={type.type} role="presentation" className={`menu-item ${activeTab===type.type?'active-tab':''}`}><a href="#artifact-reader-panel" role="tab" id={`tab-${type.type}`} tabIndex={activeTab===type.type?0:-1} aria-selected={activeTab===type.type} aria-controls="artifact-reader-panel" onClick={event=>{event.preventDefault();selectDocument(type.type as Tab);}}>
           {type.label}{type.type!=='issue'&&<span className={issue.artifacts.some(doc=>doc.type===type.type)?styles.tabReady:styles.tabMissing} aria-label={issue.artifacts.some(doc=>doc.type===type.type)?'생성됨':'미생성'}/>}
          </a></li>)}
         </ul>
        </div>
        <div className={styles.readerBody}>
         <div className={styles.paper} role="tabpanel" id="artifact-reader-panel" aria-labelledby={`tab-${activeTab}`}>
          <div className={styles.paperTitle}><h3>{activeTab==='issue'?'설명':activeLabel?.label}</h3><p>{activeTab==='issue'?'현상과 개선 요구, 변경 범위를 정리합니다.':activeLabel?.description}</p></div>
          {activeTab==='issue'?<ArtifactDocument key={`issue-${issue.id}`} type="issue" content={{symptom:issue.symptom,improvementReq:issue.improvementReq,changeScope:issue.changeScope,constraintsNote:issue.constraintsNote,beforeState:issue.beforeState,afterState:issue.afterState}}/>:
           !summary?<div className={styles.documentEmpty}><ReviewIcon name="clock" size={28}/><h4>아직 생성되지 않은 산출물입니다.</h4><p>다른 문서는 계속 확인할 수 있습니다. 생성이 완료되면 이 탭에서 열어보세요.</p></div>:
           doc?.error?<div className={styles.documentEmpty} role="alert"><ReviewIcon name="alert" size={28}/><h4>산출물을 불러오지 못했습니다.</h4><p>{doc.error}</p><button className="aui-button" onClick={()=>{cache.current.delete(documentKey);setRetry(v=>v+1);}}>다시 불러오기</button></div>:
           !doc?.document?<div className={styles.documentLoading} role="status"><span/>문서를 불러오는 중입니다.</div>:<ArtifactDocument key={documentKey} type={activeTab} content={doc.document.content}/>
          }
          <details ref={sourceRef} className={styles.source}><summary>요구사항 근거 <span>{requirement.reqKey}</span></summary><div>
           {issue.quote?<blockquote>{issue.quote}</blockquote>:<p>연결된 원문 구절이 없습니다.</p>}
           <details><summary>확정 요구사항 전체 보기</summary><ArtifactRichText text={requirement.content}/></details>
          </div></details>
         </div>
         <aside className={styles.issueInfo} aria-label="이슈 상세 정보">
          <section><h3>상세 정보</h3><dl><div><dt>유형</dt><dd>{activeTab==='issue'?'개발 이슈':activeLabel?.label}</dd></div><div><dt>문서 상태</dt><dd>{activeTab==='issue'?(confirmed?'확정':'검토 중'):!summary?'미생성':summary.state==='CONFIRMED'?'확정':'초안'}</dd></div>{summary&&<div><dt>문서 리비전</dt><dd>{summary.revision}</dd></div>}<div><dt>프로젝트</dt><dd>{project.name}</dd></div><div><dt>근거 요구사항</dt><dd><Link href={`/projects/${projectId}/requirements/${requirementId}`}>{requirement.reqKey}</Link></dd></div></dl></section>
          <section><h3>관계자</h3><dl><div><dt>요구사항 담당자</dt><dd>{requirement.assigneeName??'미지정'}</dd></div><div><dt>요청자</dt><dd>{[requirement.requesterDept,requirement.requesterName].filter(Boolean).join(' · ')||'미등록'}</dd></div></dl></section>
          <section><h3>날짜</h3><dl><div><dt>이슈 생성</dt><dd>{date(issue.createdAt)}</dd></div><div><dt>목표일</dt><dd>{date(issue.dueOn)}</dd></div>{doc?.document&&<div><dt>문서 저장</dt><dd>{date(doc.document.updatedAt)}</dd></div>}</dl></section>
          <section><h3>연결 문서</h3><div className={styles.linkedDocuments}>{ARTIFACT_TYPES.map(type=><button type="button" key={type.type} onClick={()=>selectDocument(type.type as Tab)} aria-current={activeTab===type.type?'page':undefined}><span>{type.label}</span><small>{issue.artifacts.some(doc=>doc.type===type.type)?'열기':'미생성'}</small></button>)}</div></section>
         </aside>
        </div>
        <footer className={styles.readerFoot}><span>개발 이슈 {position+1} / {data.issues.length}</span><div><button type="button" className="aui-button" disabled={position<=0} onClick={()=>chooseIssue(data.issues[position-1].id)}>이전 이슈</button><button type="button" className="aui-button" disabled={position>=data.issues.length-1} onClick={()=>chooseIssue(data.issues[position+1].id)}>다음 이슈</button></div></footer>
       </>:<div className={styles.documentEmpty}><ReviewIcon name="file" size={32}/><h3>검토할 개발 이슈가 없습니다.</h3><p>개발 이슈와 산출물을 먼저 생성해주세요.</p><Link className="aui-button" href={`/projects/${projectId}/requirements/${requirementId}/issues`}>개발 이슈 도출로 이동</Link></div>}
      </section>
     </div>
     {error&&<p className="aui-message aui-message-error" role="alert">{error}</p>}
     {notice&&<p className={`aui-message ${notice.error?'aui-message-error':'aui-message-success'}`} role={notice.error?'alert':'status'}>{notice.text}</p>}
     <footer className={styles.confirmBar}><div><strong>{confirmed?'개발 이슈와 산출물을 확정했습니다.':'검토한 내용으로 전체 확정합니다.'}</strong><p>{confirmed?'확정 후에도 모든 문서를 계속 열어볼 수 있습니다.':incomplete?'모든 산출물의 생성이 완료되면 전체 확정할 수 있습니다.':`${data.issues.length}개 개발 이슈와 ${count}개 산출물의 현재 내용을 함께 확정합니다.`}</p></div>
      <button className="aui-button aui-button-primary" disabled={busy||!data.issues.length||confirmed||incomplete} onClick={finish}>{confirmed?'전체 확정됨':busy?'확정 중…':'전체 확정'}</button>
     </footer>
    </>}
   </main>
  </div>
 </div>;
}
