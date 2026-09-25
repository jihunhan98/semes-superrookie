import { redirect } from "next/navigation";
export default function LegacyArtifactsRequirement({ params }: { params: { id: string; reqId: string } }) {
  redirect(`/projects/${params.id}/requirements/${params.reqId}/issues`);
}
