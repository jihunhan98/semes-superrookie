"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { AssigneeCandidate, RequirementSummary } from "../lib/api";
import { formatUpdatedAt, REQUIREMENT_STATES } from "../lib/requirementPresentation";
import { selectRequirements, type ListView, type SortKey } from "../lib/requirementList";
import Button from "./ui/Button";
import Icon from "./ui/Icon";
import StatusBadge from "./ui/StatusBadge";
import { EmptyState } from "./ui/PageState";
import styles from "./RequirementTable.module.css";
const columns: { key: SortKey; label: string }[] = [
  { key: "reqKey", label: "요구사항 ID" }, { key: "content", label: "내용" }, { key: "state", label: "상태" },
  { key: "version", label: "버전" }, { key: "assigneeName", label: "담당자" }, { key: "updatedAt", label: "수정일" },
];
export default function RequirementTable({ rows, assignees, projectId, view, onChange }: {
  rows: RequirementSummary[]; assignees: AssigneeCandidate[]; projectId: number; view: ListView; onChange: (next: ListView, push?: boolean) => void;
}) {
  const [peopleOpen, setPeopleOpen] = useState(false);
  const people = useRef<HTMLDivElement>(null), peopleButton = useRef<HTMLButtonElement>(null);
  const result = useMemo(() => selectRequirements(rows, view), [rows, view]);
  const activeFilters = !!(view.query || view.status !== "ALL" || view.assignees.length);
  useEffect(() => {
    function close(e: MouseEvent) { if (!people.current?.contains(e.target as Node)) setPeopleOpen(false); }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  function reset() { onChange({ ...view, query: "", status: "ALL", assignees: [], page: 1 }); }
  function sort(key: SortKey) { onChange({ ...view, sort: key, direction: view.sort === key && view.direction === "asc" ? "desc" : "asc", page: 1 }); }
  return <>
    <div className={styles.toolbar}>
      <div className={styles.search}><Icon name="search" /><label htmlFor="requirement-search" className={styles.srOnly}>ID·내용·담당자로 검색</label><input id="requirement-search" type="search" placeholder="ID·내용·담당자로 검색..." value={view.query} onChange={e => onChange({ ...view, query: e.target.value, page: 1 })} /></div>
      <label className={styles.filter}><Icon name="filter" /><span className={styles.srOnly}>상태</span><select aria-label="상태" value={view.status} onChange={e => onChange({ ...view, status: e.target.value, page: 1 })}><option value="ALL">모든 상태</option><option value="OPEN">진행 중 전체</option>{Object.entries(REQUIREMENT_STATES).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select></label>
      <div ref={people} className={styles.people} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPeopleOpen(false); }} onKeyDown={e => { if (e.key === "Escape") { setPeopleOpen(false); peopleButton.current?.focus(); } }}>
        <button ref={peopleButton} type="button" className={`${styles.filter} ${styles.peopleButton}`} aria-expanded={peopleOpen} aria-controls="assignee-options" onClick={() => setPeopleOpen(v => !v)}><Icon name="plus" />담당자{view.assignees.length > 0 && ` ${view.assignees.length}`}<Icon name="chevron" /></button>
        {peopleOpen && <div className={styles.peoplePanel} id="assignee-options"><p>담당자 선택 · 미선택 시 전체</p><div className={styles.peopleOptions}>{assignees.length ? assignees.map(a => <label className={styles.person} key={a.userId}><input type="checkbox" checked={view.assignees.includes(String(a.userId))} onChange={e => onChange({ ...view, page: 1, assignees: e.target.checked ? [...view.assignees, String(a.userId)] : view.assignees.filter(id => id !== String(a.userId)) })} />{a.name}</label>) : <p>등록된 담당자가 없습니다.</p>}</div>{view.assignees.length > 0 && <Button variant="ghost" onClick={() => onChange({ ...view, assignees: [], page: 1 })}>선택 해제</Button>}</div>}
      </div>
      {activeFilters && <Button variant="ghost" onClick={reset}>초기화<Icon name="close" /></Button>}
      <span className={styles.count} aria-live="polite">{activeFilters ? `${rows.length}건 중 ${result.filtered.length}건` : `총 ${rows.length}건`}</span>
    </div>
    {result.filtered.length === 0 ? <EmptyState title={rows.length ? "검색 결과가 없습니다" : "첫 요구사항을 등록해 보세요"} description={rows.length ? "검색어나 필터를 변경해서 다시 확인하세요." : "고객 요구사항을 등록하면 AI 검토를 시작할 수 있습니다."} action={rows.length ? <Button onClick={reset}>필터 초기화</Button> : undefined} /> : <>
      <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="요구사항 표, 좁은 화면에서 가로 스크롤 가능">
        <table className={styles.table}><caption className={styles.srOnly}>프로젝트 요구사항 목록</caption><thead><tr>{columns.map(c => <th key={c.key} scope="col" aria-sort={view.sort === c.key ? view.direction === "asc" ? "ascending" : "descending" : "none"}><button className={styles.sort} onClick={() => sort(c.key)} aria-label={`${c.label} ${view.sort === c.key && view.direction === "asc" ? "내림차순" : "오름차순"} 정렬`}>{c.label}<Icon name="sort" size={13} /></button></th>)}</tr></thead><tbody>{result.rows.map(r => {
          const href = `/projects/${projectId}/requirements/${r.id}`;
          return <tr key={r.id}><td className={styles.key}><Link href={href}>{r.reqKey}</Link></td><td className={styles.content}><Link href={href} title={r.content}>{r.content}</Link></td><td><StatusBadge state={r.state} /></td><td className={styles.meta}>{r.version ? <span className={styles.version}>v{r.version}</span> : "—"}</td><td className={styles.meta}>{r.assigneeName || "미지정"}</td><td className={styles.meta}><time dateTime={r.updatedAt || undefined} title={r.updatedAt || undefined}>{formatUpdatedAt(r.updatedAt)}</time></td></tr>;
        })}</tbody></table>
      </div>
      <div className={styles.footer}><span className={styles.range} aria-live="polite">{(result.page - 1) * view.size + 1}–{Math.min(result.page * view.size, result.filtered.length)} / {result.filtered.length}건</span><label className={styles.size}>페이지당 행 수<select value={view.size} onChange={e => onChange({ ...view, size: Number(e.target.value), page: 1 })}>{[10, 20, 50].map(n => <option key={n}>{n}</option>)}</select></label><span className={styles.pageNumber} aria-live="polite">{result.page} / {result.pages} 페이지</span><div className={styles.paging}><Button aria-label="첫 페이지" disabled={result.page === 1} onClick={() => onChange({ ...view, page: 1 }, true)}><Icon name="first" /></Button><Button aria-label="이전 페이지" disabled={result.page === 1} onClick={() => onChange({ ...view, page: result.page - 1 }, true)}><Icon name="back" /></Button><Button aria-label="다음 페이지" disabled={result.page === result.pages} onClick={() => onChange({ ...view, page: result.page + 1 }, true)}><Icon name="next" /></Button><Button aria-label="마지막 페이지" disabled={result.page === result.pages} onClick={() => onChange({ ...view, page: result.pages }, true)}><Icon name="last" /></Button></div></div>
    </>}
  </>;
}
