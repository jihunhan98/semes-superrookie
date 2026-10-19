"use client";

type Quality = { status?: string; concerns?: string[] };
export default function ArtifactEvidence({ content }: { content: Record<string, unknown> }) {
  const extra = content.legacyExtras as { quality?: Quality } | undefined;
  const evidence = content.evidence as {field: string; reqKey: string; quote: string}[] | undefined;
  return <section className="insight-card artifact-evidence"><div className="insight-heading"><h2>요구사항 근거</h2></div>{extra?.quality?.concerns?.map((concern,index) => <p key={index} className="lmsg err">{concern}</p>)}{Array.isArray(evidence) && evidence.map((item,index) => <p key={index}><b>{item.reqKey}</b> · {item.field}<br />{item.quote}</p>)}</section>;
}
