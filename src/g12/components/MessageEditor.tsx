import { useRef, type KeyboardEvent } from "react";
import { Bold, Code, Heading, Italic, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Same rules as the bot's markdown() in bot/ui/text.py, so the preview matches Telegram.
export function toTelegramHtml(value: string): string {
  let t = esc(value);
  t = t.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  t = t.replace(/^#{1,6}\s+(.+)$/gm, "<b>$1</b>");
  t = t.replace(/^(\s*)[-*•]\s+/gm, "$1• ");
  t = t.replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*/g, "<b>$1</b>");
  t = t.replace(/(?<![\w*])[*_](?=\S)([^*_\n]+?)(?<=\S)[*_](?![\w*])/g, "<i>$1</i>");
  return t.split("\n").map((line) => line.trimEnd()).join("\n");
}

export function MessagePreview({ text, title }: { text: string; title?: string }) {
  return (
    <div className="rounded-lg border-l-4 border-primary bg-muted/40 px-3 py-2.5 max-h-72 overflow-y-auto">
      {title && <p className="text-xs font-medium text-muted-foreground mb-1">{title}</p>}
      <div className="text-sm leading-relaxed whitespace-pre-wrap break-words [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono"
        dangerouslySetInnerHTML={{ __html: toTelegramHtml(text) }} />
    </div>
  );
}

const TOOLS = [
  { label: "Bold (Ctrl+B)", icon: Bold, before: "**", after: "**", sample: "bold text", key: "b" },
  { label: "Italic (Ctrl+I)", icon: Italic, before: "_", after: "_", sample: "italic text", key: "i" },
  { label: "Monospace", icon: Code, before: "`", after: "`", sample: "code" },
  { label: "Heading line", icon: Heading, before: "# ", after: "", sample: "Heading", line: true },
  { label: "Bullet point", icon: List, before: "- ", after: "", sample: "item", line: true },
];

export default function MessageEditor({ value, onChange, maxLength, rows = 6, placeholder, previewTitle = "Preview — how students see it" }: {
  value: string; onChange: (v: string) => void; maxLength: number; rows?: number; placeholder?: string; previewTitle?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const apply = (tool: (typeof TOOLS)[number]) => {
    const el = ref.current;
    if (!el) return;
    let start = el.selectionStart;
    const end = el.selectionEnd;
    if (tool.line) start = value.lastIndexOf("\n", start - 1) + 1;
    const inner = value.slice(start, end) || tool.sample;
    const next = value.slice(0, start) + tool.before + inner + tool.after + value.slice(end);
    if (next.length > maxLength) return;
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + tool.before.length, start + tool.before.length + inner.length);
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const tool = TOOLS.find((t) => t.key === e.key.toLowerCase());
    if (tool) {
      e.preventDefault();
      apply(tool);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/30 p-1">
        {TOOLS.map((t) => (
          <Button key={t.label} type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" title={t.label} aria-label={t.label}
            onClick={() => apply(t)}>
            <t.icon className="h-4 w-4" />
          </Button>
        ))}
        <span className="ml-auto pr-2 text-[11px] text-muted-foreground hidden sm:inline">Select text, then pick a style</span>
      </div>
      <Textarea ref={ref} rows={rows} maxLength={maxLength} placeholder={placeholder} value={value}
        onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown} className="font-mono text-sm" />
      <p className="text-[11px] text-muted-foreground text-right">{value.length}/{maxLength}</p>
      {value.trim() && previewTitle !== "" && <MessagePreview text={value.trim()} title={previewTitle} />}
    </div>
  );
}
