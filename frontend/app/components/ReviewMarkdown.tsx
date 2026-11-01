"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import styles from "./ReviewMarkdown.module.css";

/** Model text is Markdown, never trusted HTML. ReactMarkdown escapes raw HTML. */
export default function ReviewMarkdown({text}:{text:string|null|undefined}) {
 return <div className={styles.content}><ReactMarkdown remarkPlugins={[remarkGfm]} components={{
  table:({children})=><div className={styles.tableScroll}><table>{children}</table></div>,
  a:({children})=><span>{children}</span>,
  img:({alt})=><span>{alt}</span>,
 }}>{text??""}</ReactMarkdown></div>;
}
