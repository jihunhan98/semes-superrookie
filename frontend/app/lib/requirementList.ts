import type { RequirementSummary, ReqState } from "./api";
import { REQUIREMENT_STATES } from "./requirementPresentation";
export type SortKey = "reqKey" | "content" | "state" | "version" | "assigneeName" | "updatedAt";
export type ListView = { query: string; status: string; assignees: string[]; sort: SortKey; direction: "asc" | "desc"; page: number; size: number };
const sortKeys: SortKey[] = ["reqKey", "content", "state", "version", "assigneeName", "updatedAt"];
export function parseListView(params: URLSearchParams): ListView {
  const status = params.get("status") || "ALL";
  const sort = params.get("sort") as SortKey;
  const page = Number(params.get("page"));
  const size = Number(params.get("size"));
  return {
    query: params.get("q") || "",
    status: status === "OPEN" || Object.prototype.hasOwnProperty.call(REQUIREMENT_STATES, status) ? status : "ALL",
    assignees: [...new Set((params.get("assignees") || "").split(",").filter(v => /^\d+$/.test(v)))],
    sort: sortKeys.includes(sort) ? sort : "updatedAt",
    direction: params.get("direction") === "asc" ? "asc" : "desc",
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    size: [10, 20, 50].includes(size) ? size : 10,
  };
}
export function listViewQuery(view: ListView): string {
  const q = new URLSearchParams();
  if (view.query) q.set("q", view.query);
  if (view.status !== "ALL") q.set("status", view.status);
  if (view.assignees.length) q.set("assignees", view.assignees.join(","));
  if (view.sort !== "updatedAt") q.set("sort", view.sort);
  if (view.direction !== "desc") q.set("direction", view.direction);
  if (view.page > 1) q.set("page", String(view.page));
  if (view.size !== 10) q.set("size", String(view.size));
  return q.toString();
}
export function selectRequirements(rows: RequirementSummary[], view: ListView) {
  const query = view.query.trim().toLocaleLowerCase();
  const filtered = rows.filter(r => {
    if (view.assignees.length && (r.assigneeId === null || !view.assignees.includes(String(r.assigneeId)))) return false;
    if (view.status === "OPEN" && r.state === "CONFIRMED") return false;
    if (view.status !== "ALL" && view.status !== "OPEN" && r.state !== view.status) return false;
    return !query || `${r.reqKey} ${r.content} ${r.assigneeName || ""}`.toLocaleLowerCase().includes(query);
  });
  filtered.sort((a, b) => {
    const av = a[view.sort], bv = b[view.sort];
    if (!av && !bv) return a.id - b.id;
    if (!av) return 1;
    if (!bv) return -1;
    const aText = view.sort === "state" ? REQUIREMENT_STATES[av as ReqState].label : String(av);
    const bText = view.sort === "state" ? REQUIREMENT_STATES[bv as ReqState].label : String(bv);
    const compared = aText.localeCompare(bText, "ko", { numeric: true });
    return (view.direction === "asc" ? compared : -compared) || a.id - b.id;
  });
  const pages = Math.max(1, Math.ceil(filtered.length / view.size));
  const page = Math.min(view.page, pages);
  return { filtered, pages, page, rows: filtered.slice((page - 1) * view.size, page * view.size) };
}
