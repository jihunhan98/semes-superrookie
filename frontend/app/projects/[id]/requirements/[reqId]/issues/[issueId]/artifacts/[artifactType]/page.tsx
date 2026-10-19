"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Header from "../../../../../../../../components/Header";
import WorkflowStepper from "../../../../../../../../components/WorkflowStepper";
import ArtifactReviewForm, { ARTIFACT_LABELS } from "../../../../../../../../components/ArtifactReviewForm";
import { getCurrentUser } from "../../../../../../../../lib/session";
import { getCurrentBundle } from "../../../../../../../../lib/api/v2";
import type { ArtifactTypeSlug } from "../../../../../../../../lib/api";
import { devId } from "../../../../../../../../lib/identifiers";

export default function ArtifactEditor() {
  const params = useParams<{ id: string; reqId: string; issueId: string; artifactType: ArtifactTypeSlug }>();
  const router = useRouter();
  const projectId = Number(params.id), requirementId = Number(params.reqId), issueId = Number(params.issueId), type = params.artifactType;
  const [identity, setIdentity] = useState<{userId: number; issueKey: string} | null>(null);
  const [dirty, setDirty] = useState(false), [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const user = getCurrentUser(); if (!user) { router.replace("/login"); return; }
    getCurrentBundle(projectId, requirementId, user.id).then(bundle => {
      if (cancelled) return;
      const issue = bundle.issues.find(item => item.id === issueId);
      if (!issue) throw new Error("개발 이슈를 찾을 수 없습니다.");
      setIdentity({userId: user.id, issueKey: issue.issueKey});
    }).catch(cause => { if (!cancelled) setError(cause instanceof Error ? cause.message : "화면을 불러오지 못했습니다."); });
    return () => { cancelled = true; };
  }, [projectId, requirementId, issueId, router]);
  return <div className="appshell"><Header /><main className="main jira-standalone"><WorkflowStepper step={4} /><Link className="jira-back" href={`/projects/${projectId}/requirements/${requirementId}/review?issue=${issueId}`} onClick={event => { if (busy || (dirty && !window.confirm("저장하지 않은 수정 내용을 버리고 돌아갈까요?"))) event.preventDefault(); }}>← 산출물 검토로 돌아가기</Link><section className="jira-standalone-document"><div className="jira-document-title"><span>{devId(issueId)} / 산출물 검토</span><h1>{ARTIFACT_LABELS[type] ?? "산출물"}</h1></div>{error && <p className="lmsg err">{error}</p>}{identity && ARTIFACT_LABELS[type] ? <ArtifactReviewForm key={`${identity.issueKey}-${type}`} projectId={projectId} requirementId={requirementId} issueKey={identity.issueKey} type={type} userId={identity.userId} onDirtyChange={setDirty} onBusyChange={setBusy} /> : !error && <p>산출물을 불러오는 중…</p>}</section></main></div>;
}
