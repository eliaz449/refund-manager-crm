import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Client } from "@shared/schema";

type CellType = "text" | "number" | "date" | "select";

interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  clientId: string;
  field: keyof Client;
  value: string | null | undefined;
  type?: CellType;
  options?: SelectOption[];   // required if type === "select"
  placeholder?: string;
  className?: string;
  format?: (raw: string) => string;  // custom display formatter (used while NOT editing)
  align?: "right" | "left" | "center";
  // dir for input (ltr for numbers/dates, rtl/auto for text)
  dir?: "ltr" | "rtl" | "auto";
  // Min width hint for cell content
  minWidth?: number;
  // Make display text bold (e.g. when value === "הוגש")
  bold?: boolean;
}

export function EditableCell({
  clientId,
  field,
  value,
  type = "text",
  options,
  placeholder,
  className,
  format,
  align = "right",
  dir = "auto",
  minWidth,
  bold,
}: Props) {
  const qc = useQueryClient();
  const [local, setLocal] = useState<string>(value ?? "");
  const [editing, setEditing] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  // sync external value into local when not actively editing
  useEffect(() => {
    if (!editing) setLocal(value ?? "");
  }, [value, editing]);

  const mutation = useMutation({
    mutationFn: async (newValue: string) => {
      const payload: Record<string, any> = {
        [field]: newValue === "" ? null : newValue,
      };
      const res = await apiRequest("PATCH", `/api/clients/${clientId}`, payload);
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/clients"] });
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1200);
    },
  });

  function commit() {
    setEditing(false);
    const cleaned = local.trim();
    if (cleaned === (value ?? "")) return; // no change
    mutation.mutate(cleaned);
  }

  function cancel() {
    setLocal(value ?? "");
    setEditing(false);
  }

  const alignClass = align === "center" ? "text-center" : align === "left" ? "text-left" : "text-right";

  // ─── Rendering ────────────────────────────────────────────────────
  if (type === "select" && options) {
    return (
      <div className={`relative ${className ?? ""}`} onClick={(e) => e.stopPropagation()}>
        <select
          value={local || ""}
          onChange={(e) => {
            setLocal(e.target.value);
            // for select, save immediately
            const cleaned = e.target.value;
            if (cleaned !== (value ?? "")) mutation.mutate(cleaned);
          }}
          className={`bg-transparent border-0 px-1 py-0.5 text-xs w-full hover:bg-muted/60 rounded focus:bg-white focus:border focus:border-blue-300 focus:outline-none cursor-pointer ${alignClass}`}
          disabled={mutation.isPending}
          data-testid={`cell-${field}-${clientId}`}
        >
          <option value="">—</option>
          {options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {mutation.isPending && <Loader2 className="w-3 h-3 animate-spin absolute -left-4 top-1/2 -translate-y-1/2 text-blue-600" />}
        {justSaved && <Check className="w-3 h-3 absolute -left-4 top-1/2 -translate-y-1/2 text-green-600" />}
      </div>
    );
  }

  const inputType = type === "number" ? "number" : type === "date" ? "date" : "text";
  const inputDir = type === "number" || type === "date" ? "ltr" : dir;
  const displayValue = value && format ? format(value) : (value || "");

  return (
    <div className={`relative ${className ?? ""}`} onClick={(e) => e.stopPropagation()}>
      {editing ? (
        <input
          ref={inputRef as any}
          type={inputType}
          value={local}
          dir={inputDir}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              cancel();
            }
          }}
          autoFocus
          step={type === "number" ? "0.01" : undefined}
          className={`bg-white border border-blue-300 px-1 py-0.5 text-xs w-full rounded focus:outline-none focus:ring-1 focus:ring-blue-400 ${alignClass}`}
          style={minWidth ? { minWidth: `${minWidth}px` } : undefined}
          data-testid={`cell-${field}-${clientId}`}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={`block w-full px-1 py-0.5 text-xs rounded hover:bg-muted/60 transition-colors min-h-[20px] ${alignClass} ${value ? "" : "text-muted-foreground"} ${bold ? "font-bold" : ""}`}
          dir={inputDir}
          style={minWidth ? { minWidth: `${minWidth}px` } : undefined}
          data-testid={`cell-${field}-${clientId}`}
        >
          {displayValue || placeholder || "—"}
        </button>
      )}
      {mutation.isPending && <Loader2 className="w-3 h-3 animate-spin absolute -left-4 top-1/2 -translate-y-1/2 text-blue-600" />}
      {justSaved && !mutation.isPending && <Check className="w-3 h-3 absolute -left-4 top-1/2 -translate-y-1/2 text-green-600" />}
    </div>
  );
}
