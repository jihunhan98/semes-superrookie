import type { ReactNode } from "react";
import styles from "./ui.module.css";
export default function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className={styles.heading}><div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</div>;
}
