import type { ReactNode } from "react";
import Button from "./Button";
import styles from "./ui.module.css";
export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className={styles.empty}><h2>{title}</h2><p>{description}</p>{action}</div>;
}
export function LoadingState() {
  return <div className={styles.loading} role="status" aria-label="요구사항 불러오는 중"><span>요구사항을 불러오고 있습니다.</span>{[0, 1, 2, 3, 4].map(n => <div key={n} className={styles.skeleton} aria-hidden="true" />)}</div>;
}
export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className={styles.error} role="alert"><p>{message}</p><Button onClick={onRetry}>다시 시도</Button></div>;
}
