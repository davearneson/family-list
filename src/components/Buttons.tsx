"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

type Props = {
  children: ReactNode;
  className: string;
  name?: string;
  value?: string;
  confirm?: string;
  /** Use a different server action than the form's own (e.g. a Delete button inside an edit form). */
  formAction?: (fd: FormData) => void | Promise<void>;
};

/** Submit button that disables itself while the form is saving, with an optional "Are you sure?". */
export function SubmitButton({ children, className, name, value, confirm, formAction }: Props) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      formAction={formAction}
      disabled={pending}
      className={className}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
