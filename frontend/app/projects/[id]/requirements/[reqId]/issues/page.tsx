import { redirect } from "next/navigation";
export default function CanonicalIssues({ params }: { params: { id: string; reqId: string } }) {
  redirect(`/projects/${params.id}/artifacts/${params.reqId}/split`);
}
