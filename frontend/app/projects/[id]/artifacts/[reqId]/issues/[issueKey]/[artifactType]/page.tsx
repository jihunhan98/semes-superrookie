import { redirect } from "next/navigation";
export default function LegacyArtifact({ params }: { params: { id: string; reqId: string; issueKey: string; artifactType: string } }) {
  redirect(`/projects/${params.id}/requirements/${params.reqId}/review?issueKey=${encodeURIComponent(params.issueKey)}&artifact=${encodeURIComponent(params.artifactType)}`);
}
