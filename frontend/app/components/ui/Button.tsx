import type { ButtonHTMLAttributes } from "react";
import styles from "./ui.module.css";
export function buttonClass(variant: "primary" | "secondary" | "ghost" = "secondary") {
  return `${styles.button} ${variant === "secondary" ? "" : styles[variant]}`;
}
export default function Button({ variant = "secondary", className = "", type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" }) {
  return <button type={type} className={`${buttonClass(variant)} ${className}`} {...props} />;
}
