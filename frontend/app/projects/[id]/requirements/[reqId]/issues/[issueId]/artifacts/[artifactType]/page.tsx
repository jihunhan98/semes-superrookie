import { redirect } from "next/navigation";
export default function ArtifactPage({ params }: { params: { id: string; reqId: string; issueId: string; artifactType: string } }) {
  redirect(`/projects/${params.id}/requirements/${params.reqId}/review?issue=${encodeURIComponent(params.issueId)}&artifact=${encodeURIComponent(params.artifactType)}`);
}
