import { Checkbox } from "@/components/ui/checkbox";

interface Props {
  createdAt?: Date | string | null;
  value: string; // JSON array of checked years, e.g. '["2020","2022"]'
  onChange: (next: string) => void;
}

export function PensionChecklist({ createdAt, value, onChange }: Props) {
  const baseYear = (() => {
    if (!createdAt) return new Date().getFullYear();
    const d = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
    return d.getFullYear();
  })();

  // 6 tax years back from lead creation year (baseYear-1 .. baseYear-6)
  const years: number[] = [];
  for (let i = 1; i <= 6; i++) years.push(baseYear - i);

  const checked: Set<string> = (() => {
    if (!value) return new Set();
    try {
      const arr = JSON.parse(value);
      return new Set(Array.isArray(arr) ? arr.map(String) : []);
    } catch {
      return new Set();
    }
  })();

  const toggle = (year: string) => {
    const next = new Set(checked);
    if (next.has(year)) next.delete(year);
    else next.add(year);
    onChange(JSON.stringify(Array.from(next).sort()));
  };

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
      {years.map(y => {
        const yStr = String(y);
        const isOn = checked.has(yStr);
        return (
          <label
            key={y}
            className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${
              isOn ? "bg-green-50 border-green-300" : "bg-muted/30 border-transparent hover:border-muted-foreground/20"
            }`}
            data-testid={`pension-year-${y}`}
          >
            <Checkbox
              checked={isOn}
              onCheckedChange={() => toggle(yStr)}
            />
            <span className="text-sm font-medium">{y}</span>
          </label>
        );
      })}
    </div>
  );
}
