import type { CSSProperties } from "react";
const paths = {
  menu: "M4 6h16M4 12h16M4 18h16",
  close: "m6 6 12 12M6 18 18 6",
  plus: "M12 5v14M5 12h14",
  search: "m16 16 4 4M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  home: "m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  box: "m12 3 9 5-9 5-9-5 9-5ZM3 8v9l9 5 9-5V8M12 13v9",
  settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2",
  back: "m14 6-6 6 6 6", next: "m10 6 6 6-6 6",
  first: "m16 6-6 6 6 6M5 5v14", last: "m8 6 6 6-6 6M19 5v14",
  sort: "M8 4v16m-3-3 3 3 3-3M16 20V4m-3 3 3-3 3 3",
  check: "m5 12 4 4L19 6", logout: "M9 4H4v16h5M10 12h11m-4-4 4 4-4 4",
  chevron: "m8 10 4 4 4-4", filter: "M4 7h16M7 12h10M10 17h4",
};
export type IconName = keyof typeof paths;
export default function Icon({ name, size = 16, style }: { name: IconName; size?: number; style?: CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, ...style }}><path d={paths[name]} /></svg>;
}
