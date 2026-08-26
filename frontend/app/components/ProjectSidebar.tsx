import Link from "next/link";
import { colorFor } from "../lib/colors";

const HOME_ICON = (
  <path d="M6.906.664a1.749 1.749 0 0 1 2.187 0l5.25 4.2c.415.332.657.835.657 1.367v7.019A1.75 1.75 0 0 1 13.25 15h-3.5a.75.75 0 0 1-.75-.75V9H7v5.25a.75.75 0 0 1-.75.75h-3.5A1.75 1.75 0 0 1 1 13.25V6.23c0-.531.242-1.034.657-1.366z" />
);

const SETTINGS_ICON = (
  <>
    <circle cx="8" cy="8" r="2" />
    <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0Zm0 2a6 6 0 1 1 0 12A6 6 0 0 1 8 2Z" />
  </>
);

const REQUIREMENTS_ICON = (
  <path d="M2.5 3.5A.75.75 0 0 1 3.25 4h9.5a.75.75 0 0 1 0 1.5h-9.5A.75.75 0 0 1 2.5 4.75Zm0 4A.75.75 0 0 1 3.25 8h9.5a.75.75 0 0 1 0 1.5h-9.5A.75.75 0 0 1 2.5 8.75Zm.75 3.5h6a.75.75 0 0 1 0 1.5h-6a.75.75 0 0 1 0-1.5Z" />
);

const ARTIFACTS_ICON = (
  <path d="m8.878.392 5.25 3.045c.54.314.872.89.872 1.514v6.098a1.75 1.75 0 0 1-.872 1.514l-5.25 3.045a1.75 1.75 0 0 1-1.756 0l-5.25-3.045A1.75 1.75 0 0 1 1 11.049V4.951c0-.624.332-1.201.872-1.514L7.122.392a1.75 1.75 0 0 1 1.756 0Z" />
);

const PLACEHOLDER_NAV_ITEMS = [
  {
    key: "traceability",
    label: "추적성",
    icon: <path d="M5.5 3.25a2.25 2.25 0 1 1 3 2.122v4.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 5.5 3.25Z" />,
  },
] as const;

type NavKey = "home" | "requirements" | "artifacts" | (typeof PLACEHOLDER_NAV_ITEMS)[number]["key"] | "settings";

export default function ProjectSidebar({
  projectId,
  projectName,
  active,
}: {
  projectId: number;
  projectName: string;
  active: NavKey;
}) {
  return (
    <aside className="side">
      <Link href={`/projects/${projectId}`} className="pj">
        <span className="pi" style={{ background: colorFor(projectName) + "22", color: colorFor(projectName) }}>
          {projectName.slice(0, 2)}
        </span>
        <span className="pn">
          {projectName}
          <small>SEMES · 프로젝트</small>
        </span>
      </Link>

      <Link href={`/projects/${projectId}`} className={`nav${active === "home" ? " on" : ""}`}>
        <svg viewBox="0 0 16 16" fill="currentColor">
          {HOME_ICON}
        </svg>
        홈
      </Link>

      <Link
        href={`/projects/${projectId}/requirements`}
        className={`nav${active === "requirements" ? " on" : ""}`}
      >
        <svg viewBox="0 0 16 16" fill="currentColor">
          {REQUIREMENTS_ICON}
        </svg>
        요구사항
      </Link>

      <Link href={`/projects/${projectId}/artifacts`} className={`nav${active === "artifacts" ? " on" : ""}`}>
        <svg viewBox="0 0 16 16" fill="currentColor">
          {ARTIFACTS_ICON}
        </svg>
        산출물
      </Link>

      {PLACEHOLDER_NAV_ITEMS.map((item) => (
        <a key={item.key} className={`nav${active === item.key ? " on" : ""}`} href="#" aria-disabled>
          <svg viewBox="0 0 16 16" fill="currentColor">
            {item.icon}
          </svg>
          {item.label}
        </a>
      ))}

      <div className="nl">프로젝트</div>
      <Link href={`/projects/${projectId}/settings`} className={`nav${active === "settings" ? " on" : ""}`}>
        <svg viewBox="0 0 16 16" fill="currentColor">
          {SETTINGS_ICON}
        </svg>
        설정
      </Link>
    </aside>
  );
}
