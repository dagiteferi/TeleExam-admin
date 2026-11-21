import { useEffect, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { g12Api } from "../api";

export interface PickedStudent {
  id: string;
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  stream: string | null;
  plan: string;
}

export const studentName = (s: PickedStudent) => [s.first_name, s.last_name].filter(Boolean).join(" ") || "No name";

export default function StudentPicker({ value, onChange }: { value: PickedStudent | null; onChange: (s: PickedStudent | null) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PickedStudent[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    let live = true;
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const { data } = await g12Api.get<{ items: PickedStudent[] }>("/users", { params: { q: term, limit: 8 } });
        if (live) setResults(data.items);
      } catch {
        if (live) setResults([]);
      } finally {
        if (live) setBusy(false);
      }
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [q]);

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
        <div>
          <p className="font-medium">{studentName(value)}</p>
          <p className="text-xs text-muted-foreground">
            {value.username ? `@${value.username} · ` : ""}ID {value.telegram_id}{value.stream ? ` · ${value.stream}` : ""} · {value.plan}
          </p>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)} aria-label="Choose another student">
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, @username or Telegram ID" />
      {busy && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
      {q.trim().length >= 2 && !busy && (
        <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover shadow-md max-h-72 overflow-y-auto">
          {results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">No student found.</p>
          ) : results.map((s) => (
            <button key={s.id} type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
              onClick={() => { onChange(s); setQ(""); }}>
              <span className="font-medium">{studentName(s)}</span>
              <span className="ml-2 text-xs text-muted-foreground">
                {s.username ? `@${s.username} · ` : ""}ID {s.telegram_id}{s.stream ? ` · ${s.stream}` : ""}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
