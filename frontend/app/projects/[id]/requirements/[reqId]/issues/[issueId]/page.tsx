import { redirect } from "next/navigation";
export default function CanonicalIssue({ params }: { params: { id: string; reqId: string; issueId: string } }) {
  redirect(`/projects/${params.id}/requirements/${params.reqId}/review?issue=${params.issueId}`);
}
