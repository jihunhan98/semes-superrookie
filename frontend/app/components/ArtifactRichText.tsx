"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import MermaidDiagram from "./MermaidDiagram";
import {cleanDiagram} from "../lib/artifacts/document.mjs";
import styles from "./ArtifactDocument.module.css";
export default function ArtifactRichText({text,diagramAppearance}:{text:string;diagramAppearance?:"jira"}){
 const code=cleanDiagram(text);
 if(/^(sequenceDiagram|classDiagram|flowchart|graph|stateDiagram|erDiagram)\b/.test(code))return <MermaidDiagram appearance={diagramAppearance} code={code} copyable/>;
 return <div className={styles.richText}><ReactMarkdown remarkPlugins={[remarkGfm]} components={{
  table:({children})=><div className={styles.tableScroll}><table>{children}</table></div>,
  pre:({children})=><div className={styles.codeBlock}>{children}</div>,
  code:({className,children,...props})=>className?.includes('language-mermaid')?<MermaidDiagram appearance={diagramAppearance} code={String(children).trim()} copyable/>:<code className={className} {...props}>{children}</code>,
  a:({children})=><span>{children}</span>,img:({alt})=><span>{alt}</span>,
 }}>{text}</ReactMarkdown></div>;
}
