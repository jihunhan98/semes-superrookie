import type { CSSProperties } from "react";
import type { ReqState } from "../../lib/api";
import { REQUIREMENT_STATES } from "../../lib/requirementPresentation";
import styles from "./ui.module.css";
export default function StatusBadge({ state }: { state: ReqState }) {
  const item = REQUIREMENT_STATES[state];
  return <span className={styles.badge}><span className={styles.dot} style={{ "--state-color": item.color } as CSSProperties} />{item.label}</span>;
}
