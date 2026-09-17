"use client";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import AppShell from "../../../components/AppShell";
import RequirementTable from "../../../components/RequirementTable";
import PageHeader from "../../../components/ui/PageHeader";
import { buttonClass } from "../../../components/ui/Button";
import Icon from "../../../components/ui/Icon";
import { ErrorState, LoadingState } from "../../../components/ui/PageState";
import { getProject, listAssignees, listRequirements, type AssigneeCandidate, type ProjectDetail, type RequirementSummary } from "../../../lib/api";
import { listViewQuery, parseListView, selectRequirements, type ListView } from "../../../lib/requirementList";
import { getCurrentUser } from "../../../lib/session";

function RequirementList() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const projectId = Number(params.id);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [rows, setRows] = useState<RequirementSummary[] | null>(null);
  const [assignees, setAssignees] = useState<AssigneeCandidate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const view = useMemo(() => parseListView(new URLSearchParams(search.toString())), [search]);
  const updateView = useCallback((next: ListView, push = false) => {
    const query = listViewQuery(next);
    const user = getCurrentUser();
    if (user) {
      try { sessionStorage.setItem(`reqops:list:${user.id}:${projectId}`, query); } catch { /* URL remains authoritative if storage is unavailable. */ }
    }
    const url = `/projects/${projectId}/requirements${query ? `?${query}` : ""}`;
    // Next.js synchronizes native History API changes with useSearchParams.
    // Filter edits replace the list entry; pagination is a navigable history entry.
    if (push) window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
  }, [projectId]);

  useEffect(() => {
    let active = true;
    const user = getCurrentUser();
    if (!user) { router.replace("/login"); return; }
    if (!Number.isSafeInteger(projectId) || projectId < 1) { setError("올바르지 않은 프로젝트 주소입니다."); return; }
    // Restore the list when a detail breadcrumb returns without a query string.
    // Explicit URL filters always take precedence; scoped to the current user/project.
    if (!window.location.search) {
      try {
        const saved = sessionStorage.getItem(`reqops:list:${user.id}:${projectId}`);
        if (saved) updateView(parseListView(new URLSearchParams(saved)));
      } catch { /* Storage is optional. */ }
    }
    setError(null); setRows(null); setProject(null);
    Promise.all([getProject(projectId, user.id), listRequirements(projectId, user.id), listAssignees(projectId, user.id)])
      .then(([p, reqs, people]) => { if (active) { setProject(p); setRows(reqs); setAssignees(people); } })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : "요구사항을 불러오지 못했습니다."); });
    return () => { active = false; };
  }, [projectId, router, attempt, updateView]);

  useEffect(() => {
    if (!rows) return;
    const result = selectRequirements(rows, view);
    if (result.page !== view.page) updateView({ ...view, page: result.page });
  }, [rows, view, updateView]);

  return <AppShell projectId={projectId} projectName={project?.name} active="requirements">
    <PageHeader title="요구사항" description="고객 요구사항을 검토하고, 합의와 변경 이력을 관리하세요." action={project && <Link className={buttonClass("primary")} href={`/projects/${projectId}/requirements/new`}><Icon name="plus" />새 요구사항</Link>} />
    {error ? <ErrorState message={error} onRetry={() => setAttempt(n => n + 1)} /> : !rows || !project ? <LoadingState /> : <RequirementTable rows={rows} assignees={assignees} projectId={projectId} view={view} onChange={updateView} />}
  </AppShell>;
}
export default function RequirementListPage() {
  return <Suspense fallback={<div className="ui-refresh" style={{ minHeight: "100vh", padding: 32 }}><LoadingState /></div>}><RequirementList /></Suspense>;
}
