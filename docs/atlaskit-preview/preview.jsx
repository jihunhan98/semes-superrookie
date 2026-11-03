import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import Button from '@atlaskit/button/new';
import Tabs, { Tab, TabList, TabPanel } from '@atlaskit/tabs';
import Lozenge from '@atlaskit/lozenge';
import Breadcrumbs, { BreadcrumbsItem } from '@atlaskit/breadcrumbs';
import DynamicTable from '@atlaskit/dynamic-table';
import SectionMessage from '@atlaskit/section-message';
import '@atlaskit/css-reset';
import './preview.css';
import { sequence, classes } from './diagrams';

const source = 'VCS는 IDLE 상태이며 SOC 기준을 만족하는 AMR 후보를 조회한다. 후보별 경로 거리를 계산하고, 최단 거리 우선으로 선택하되 동일 거리이면 SOC가 높은 AMR을 선택한다. VCS는 선택 결과와 선정 근거를 매칭 이력으로 기록한다.';
const issues = [
  { key: 'DEV-EXAMPLE-01', title: 'AMR 후보 선정 및 매칭 우선순위', short: 'AMR 후보 선정 및 매칭', summary: '가용 AMR을 일관된 기준으로 선정하고, 선택 이유를 확인할 수 있어야 합니다.', scope: '후보 조회 · 경로 거리 계산 · 우선순위 판단', quote: 'VCS는 IDLE 상태이며 SOC 기준을 만족하는 AMR 후보를 조회한다. 후보별 경로 거리를 계산하고, 최단 거리 우선으로 선택하되 동일 거리이면 SOC가 높은 AMR을 선택한다.', changes: ['IDLE 상태와 SOC 기준에 맞는 AMR 후보를 조회합니다.', '최단 경로 거리를 우선 적용합니다.', '동일 거리에서는 SOC가 높은 AMR을 선택합니다.'], basic: ['조건을 만족하는 후보가 있습니다.', '후보 조회 → 경로 거리 계산 → 우선순위 적용', '선정된 AMR을 반환합니다.'], alternate: ['최단 경로 거리가 같은 후보가 있습니다.', '동률 후보의 SOC를 비교합니다.', 'SOC가 높은 AMR을 선정합니다.'], exception: '가용 후보가 없을 때의 처리 정책', design: '매칭 요청을 받고 후보 상태를 조회한 후, 거리와 SOC를 기준으로 결과를 선정하는 흐름입니다.' },
  { key: 'DEV-EXAMPLE-02', title: '매칭 결과와 선정 근거의 이력 기록', short: '매칭 결과 이력 기록', summary: '어떤 AMR이 어떤 근거로 선택되었는지 결과를 추적할 수 있어야 합니다.', scope: '매칭 결과 · 선정 근거의 이력 기록', quote: 'VCS는 선택 결과와 선정 근거를 매칭 이력으로 기록한다.', changes: ['선택된 AMR과 선정 근거를 함께 기록합니다.', '이력 기록 범위를 매칭 처리 결과에 연결합니다.'], basic: ['AMR 매칭이 완료되었습니다.', '선택 결과와 선정 근거를 이력에 기록합니다.', '매칭 결과를 추적할 수 있습니다.'], alternate: ['대안 흐름이 예시 원문에 없습니다.', '추가 업무 정책을 확인합니다.', '확정된 정책을 문서에 반영합니다.'], exception: '이력 저장 실패 시의 처리 정책', design: '매칭 완료 결과를 받아 선택 정보와 선정 근거를 이력으로 남기는 범위입니다.' },
];
const libraries = ['@atlaskit/button 25.7.0', '@atlaskit/tabs 21.3.0', '@atlaskit/dynamic-table 19.3.8', '@atlaskit/lozenge 17.0.6', '@atlaskit/breadcrumbs 17.8.6', '@atlaskit/section-message 10.2.6', '@atlaskit/css-reset 8.4.8', '@atlaskit/tokens 20.9.0'];

function Table({ title, columns = ['항목', '내용'], rows }) {
  return <DynamicTable caption={title} head={{ cells: columns.map((content, i) => ({ key: `col-${i}`, content })) }} rows={rows.map((row, i) => ({ key: `row-${i}`, cells: row.map((content, j) => ({ key: `cell-${i}-${j}`, content })) }))} />;
}
function Scenario({ title, values }) {
  return <section className="scenario-block"><h3>{title}</h3><Table title={title} rows={['선행 조건', '수행 흐름', '완료 조건'].map((label, i) => [label, values[i]])} /></section>;
}
function Drawing({ markup }) { return <div className="drawing" dangerouslySetInnerHTML={{ __html: markup }} />; }
function App() {
  const [selectedIssue, selectIssue] = useState(0);
  const [tab, selectTab] = useState(0);
  const [sourceOpen, showSource] = useState(false);
  const [librariesOpen, showLibraries] = useState(false);
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState({});
  const [draft, setDraft] = useState('');
  const [completed, setCompleted] = useState({});
  const issue = issues[selectedIssue];
  function chooseIssue(index) { selectIssue(index); selectTab(0); setEditing(false); }
  const tabs = [
    ['개발 이슈', <><section><h2>설명</h2><h3>현상</h3><p>{issue.summary}</p><h3>개선 요구</h3><ol>{issue.changes.map(text => <li key={text}>{text}</li>)}</ol></section><section><h3>변경 범위와 제약</h3><Table title="개발 이슈 범위" rows={[[ '변경 범위', issue.scope ], ['제약 조건', '확정 요구사항의 상태·SOC·거리 기준 적용'], ['변경 전', '예시 원문에 기존 동작 정보 없음 · 추가 확인'], ['변경 후', issue.summary]]} /></section><section><h3>요구사항 근거</h3><blockquote>{issue.quote}</blockquote></section><section><h3>검토 메모</h3>{editing ? <><label className="field-label" htmlFor="review-note">이 파일을 열어 둔 동안만 보관되는 예시 메모</label><textarea id="review-note" value={draft} onChange={event => setDraft(event.target.value)} rows={4} /><div className="inline-actions"><Button appearance="primary" onClick={() => { setNotes({ ...notes, [issue.key]: draft }); setEditing(false); }}>메모 반영</Button><Button onClick={() => setEditing(false)}>취소</Button></div></> : <p className="muted">{notes[issue.key] || '검토 메모를 남기려면 상단의 메모 편집을 누르세요.'}</p>}</section></>],
    ['SWVOC', <><div className="document-heading"><span>SWVOC</span><h2>고객 요청사항</h2><p>요청 취지와 변경 요청을 업무 양식으로 읽습니다.</p></div><Table title="SWVOC 작성 양식" rows={[[ '요청자', '고객 요청 부서 · 설명용 예시' ], ['요청 내용', issue.summary], ['상세 요청', <ul>{issue.changes.map(text => <li key={text}>{text}</li>)}</ul>], ['특이 사항', '근거에 없는 수치와 정책은 추가 확인 필요']]} /><section><h3>현상 이미지 · 참고 자료</h3><div className="attachment"><span className="attachment-mark" aria-hidden="true">▧</span><div><strong>현상 캡처 / 고객 제공 그림</strong><p>실제 업무 자료가 들어갈 위치입니다. 이 예시에 고객 자료는 포함하지 않았습니다.</p></div></div></section></>],
    ['기능 요구사항', <><div className="document-heading"><span>FUNCTIONAL REQUIREMENT</span><h2>기능 요구사항 정의</h2><p>{issue.summary}</p></div><Scenario title="기본 시나리오" values={issue.basic} /><Scenario title="대안 시나리오" values={issue.alternate} /><Scenario title="예외 시나리오" values={['예외 상황이 발생합니다.', `${issue.exception}은 원문에 없습니다.`, '추가 확인 후 합의된 처리 기준을 반영합니다.']} /></>],
    ['비기능 요구사항', <><div className="document-heading"><span>NON-FUNCTIONAL REQUIREMENT</span><h2>품질 기준과 제약</h2><p>원문에 있는 기준과 아직 확인되지 않은 항목을 구분합니다.</p></div><Table title="비기능 요구사항 기준" columns={['품질 항목', '기준', '근거 상태']} rows={[[ '응답 시간', '예시 원문에 목표 수치 없음', <Lozenge appearance="moved">추가 확인</Lozenge> ], ['추적 가능성', '선택 결과와 선정 근거 기록', <Lozenge appearance="success">원문 명시</Lozenge>], ['장애 대응', '복구·재시도 정책 없음', <Lozenge appearance="moved">추가 확인</Lozenge>]]} /><section><SectionMessage title="확인해야 할 기준" appearance="information"><p>응답 시간·보관 기간·복구 시간은 원문에 없는 값을 임의로 확정하지 않습니다.</p></SectionMessage></section></>],
    ['상세 설계', <><div className="document-heading"><span>DETAILED DESIGN</span><h2>구조와 처리 흐름</h2><p>{issue.design}</p></div>{selectedIssue === 0 ? <><h3>클래스 구조</h3><Drawing markup={classes} /><h3>변경 후 시퀀스</h3><Drawing markup={sequence} /></> : <><h3>기록 데이터</h3><Table title="매칭 이력의 개념 데이터" rows={[[ '선택 결과', '매칭에서 선정한 AMR' ], ['선정 근거', '거리와 SOC에 따른 선택 이유'], ['연결 정보', '해당 매칭 요청을 추적할 식별 기준 · 추가 확인']]} /><h3>처리 흐름</h3><p>매칭 완료 → 결과·근거 수집 → 이력 기록. 저장소 구조와 실패 정책은 자료 확인 후 구체화합니다.</p></>}<section><h3>변경 전 동작</h3><p className="muted">기존 동작과 실제 구현 클래스는 제공되지 않았습니다. 위 그림은 문서 설명을 위한 개념 예시입니다.</p></section></>],
  ];
  return <>
    <header className="app-header"><div className="app-brand"><span className="brand-mark">R</span><strong>ReqOps</strong><span className="header-context">개발 이슈 · 산출물</span></div><div className="header-actions"><Button appearance="subtle" isSelected={librariesOpen} onClick={() => showLibraries(!librariesOpen)}>사용 라이브러리</Button><Button onClick={() => window.print()}>인쇄 / PDF</Button></div></header>
    <div className="preview-banner"><strong>실제 Atlaskit 컴포넌트로 구성한 미리보기</strong><span>설명용 데이터 · Jira 서버 연결 없음 · HTML 단독 실행</span></div>
    {librariesOpen && <section className="library-panel"><h2>Atlassian 공식 패키지</h2><p>버튼·탭·표·상태·경로·안내 메시지는 아래 패키지의 실제 React 컴포넌트입니다. 화면 배치와 업무 문서 양식은 ReqOps에서 구성합니다.</p><ul>{libraries.map(name => <li key={name}><code>{name}</code></li>)}</ul><p>React 18.3.1 · 각 사용 패키지의 LICENSE를 함께 확인했습니다. 이 페이지는 Jira 제품이나 사내 Jira의 원본 화면이 아닙니다.</p><a href="https://atlassian.design/components" target="_blank" rel="noreferrer">공식 컴포넌트 문서</a></section>}
    <div className="workspace"><aside className="project-sidebar"><div className="project"><div className="project-tile">VC</div><div><strong>VCS 소프트웨어</strong><span>요구사항 프로젝트 · 예시</span></div></div><div className="nav-heading">개발 이슈</div><div className="issue-links">{issues.map((item, index) => <Button key={item.key} shouldFitContainer appearance="subtle" isSelected={selectedIssue === index} onClick={() => chooseIssue(index)} testId={`issue-${index}`}><span className="sidebar-issue"><small>{item.key}</small><span>{item.short}</span></span></Button>)}</div><div className="sidebar-footer"><strong>연결된 산출물</strong><p>SWVOC · 기능 요구사항<br/>비기능 요구사항 · 상세 설계</p><a href="issue-artifact-design-and-prompts.html#prompt">현재 선정 프롬프트 설명 ↗</a></div></aside>
      <main className="issue-main"><Breadcrumbs><BreadcrumbsItem text="VCS 소프트웨어" /><BreadcrumbsItem text="REQ-EXAMPLE-01" /><BreadcrumbsItem text={issue.key} /></Breadcrumbs><div className="issue-heading"><div className="issue-id"><span className="issue-type" aria-hidden="true">✓</span>{issue.key}<Lozenge appearance={completed[issue.key] ? 'success' : 'inprogress'}>{completed[issue.key] ? '검토 완료' : '검토 중'}</Lozenge></div><h1>{issue.title}</h1></div>
      <div className="issue-actions"><Button appearance="primary" isSelected={editing} onClick={() => { selectTab(0); setDraft(notes[issue.key] || ''); setEditing(!editing); }}>메모 편집</Button><Button isSelected={sourceOpen} onClick={() => showSource(!sourceOpen)}>요구사항 원문</Button><Button onClick={() => setCompleted({ ...completed, [issue.key]: !completed[issue.key] })}>{completed[issue.key] ? '검토 중으로 변경' : '검토 완료로 변경'}</Button><span>예시 변경은 새로고침하면 초기화됩니다.</span></div>
      {sourceOpen && <section className="source-panel"><h2>확정 요구사항 · 설명용 원문</h2><p>{source}</p><small>아래 이슈 분할은 디자인 예시이며 실제 모델 응답이 아닙니다.</small></section>}
      <div className="issue-layout"><div className="issue-document"><Tabs id={`artifact-${selectedIssue}`} selected={tab} onChange={index => selectTab(index)}><TabList>{tabs.map(([title]) => <Tab key={title}>{title}</Tab>)}</TabList>{tabs.map(([title, content]) => <TabPanel key={title}><div className="document-body">{content}</div></TabPanel>)}</Tabs></div><aside className="issue-details"><section><h2>상세 정보</h2><dl><dt>유형</dt><dd>개발 이슈</dd><dt>상태</dt><dd><Lozenge appearance={completed[issue.key] ? 'success' : 'inprogress'}>{completed[issue.key] ? '검토 완료' : '검토 중'}</Lozenge></dd><dt>연결 요구사항</dt><dd>REQ-EXAMPLE-01</dd><dt>담당자</dt><dd>미지정</dd><dt>기한</dt><dd>미정</dd></dl></section><section><h2>산출물</h2><dl><dt>연결 문서</dt><dd>4종</dd><dt>본문 양식</dt><dd>표 · 시나리오</dd><dt>설계 표현</dt><dd>그림 · 시퀀스</dd></dl></section><section className="details-footnote">이슈와 문서를 같은 화면에서 읽고 원문 근거를 확인합니다.<br/><br/>데이터와 예시 양식은 사내 원본 템플릿을 재현한 결과가 아닙니다.</section></aside></div>
      </main></div><footer className="app-footer">ReqOps 미리보기 · Atlassian 공식 React 컴포넌트 사용 · <a href="#third-party-notices">오픈소스 고지</a></footer>
  </>;
}
createRoot(document.getElementById('root')).render(<App />);
