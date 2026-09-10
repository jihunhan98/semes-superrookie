"use client";

import { useEffect, useRef, type TextareaHTMLAttributes } from "react";

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value"> & {
  value: string;
  onChange: (value: string) => void;
};

/**
 * 내용 길이에 맞춰 높이가 늘어나는 textarea — 내부 스크롤 대신 박스 자체가
 * 커져서 한 번에 다 보이게 한다.
 */
export default function AutoGrowTextarea({ value, onChange, style, ...rest }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

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
