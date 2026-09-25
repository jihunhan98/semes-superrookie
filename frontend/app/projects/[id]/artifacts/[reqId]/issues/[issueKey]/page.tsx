import { redirect } from "next/navigation";
export default function LegacyIssue({ params }: { params: { id: string; reqId: string; issueKey: string } }) {
  redirect(`/projects/${params.id}/requirements/${params.reqId}/review?issueKey=${encodeURIComponent(params.issueKey)}`);
}
