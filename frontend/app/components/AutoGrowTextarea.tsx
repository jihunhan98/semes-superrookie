"use client";

import { useEffect, useRef, type TextareaHTMLAttributes } from "react";

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value"> & {
  value: string;
  onChange: (value: string) => void;
  /** 이 높이를 넘으면 더 늘어나지 않고 내부 스크롤로 대신한다(Mermaid 코드처럼 아주 길어질 수 있는 칸용). */
  maxHeight?: number;
};

/**
 * 내용 길이에 맞춰 높이가 늘어나는 textarea — 내부 스크롤 대신 박스 자체가
 * 커져서 한 번에 다 보이게 한다. {@code maxHeight}를 주면 그 높이까지만 늘어나고,
 * 그 이상은 내부 스크롤로 본다.
 */
export default function AutoGrowTextarea({ value, onChange, style, maxHeight, ...rest }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const needed = el.scrollHeight;
    if (maxHeight && needed > maxHeight) {
      el.style.height = `${maxHeight}px`;
      el.style.overflowY = "auto";
    } else {
      el.style.height = `${needed}px`;
      el.style.overflowY = "hidden";
    }
  }, [value, maxHeight]);

  return (
    <textarea
      ref={ref}
      style={{ ...style, overflow: "hidden", resize: "none" }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      {...rest}
    />
  );
}
