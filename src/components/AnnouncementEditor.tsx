import { useRef, type KeyboardEvent } from "react";
import { Bold, Code, EyeOff, Italic, Link, Strikethrough, Underline } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FormattedAnnouncement } from "@/lib/announcementFormat";

interface Tool {
  label: string;
  icon: typeof Bold;
  marker: string;
  placeholder: string;
  shortcut?: string; // Ctrl/Cmd + this key
}

const TOOLS: Tool[] = [
  { label: "Bold", icon: Bold, marker: "**", placeholder: "bold text", shortcut: "b" },
  { label: "Italic", icon: Italic, marker: "__", placeholder: "italic text", shortcut: "i" },
  { label: "Underline", icon: Underline, marker: "++", placeholder: "underlined text", shortcut: "u" },
  { label: "Strikethrough", icon: Strikethrough, marker: "~~", placeholder: "crossed-out text" },
  { label: "Spoiler (hidden until tapped)", icon: EyeOff, marker: "||", placeholder: "hidden text" },
  { label: "Monospace", icon: Code, marker: "`", placeholder: "code" },
];

interface Props {
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  rows?: number;
  placeholder?: string;
}

/** Announcement text box with a formatting toolbar and a preview of what users see. */
export default function AnnouncementEditor({ value, onChange, maxLength, rows = 6, placeholder }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Replaces the selection with before + (selection or placeholder) + after, keeping the inner text selected.
  const surround = (before: string, after: string, placeholder: string) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const inner = value.slice(start, end) || placeholder;
    const next = value.slice(0, start) + before + inner + after + value.slice(end);
    if (next.length > maxLength) return;
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + inner.length);
    });
  };

  const addLink = () => {
    const url = window.prompt("Link address (https://…)", "https://");
    if (!url) return;
    const href = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
    surround("[", `](${href})`, "link text");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const key = e.key.toLowerCase();
    const tool = TOOLS.find((t) => t.shortcut === key);
    if (tool) {
      e.preventDefault();
      surround(tool.marker, tool.marker, tool.placeholder);
    } else if (key === "k") {
      e.preventDefault();
      addLink();
    }
  };

  return (
    <div className="space-y-2">
      <TooltipProvider delayDuration={300}>
        <div className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/30 p-1">
          {TOOLS.map((t) => (
            <Tooltip key={t.label}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  aria-label={t.label}
                  onClick={() => surround(t.marker, t.marker, t.placeholder)}
                >
                  <t.icon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {t.label}
                {t.shortcut ? ` (Ctrl+${t.shortcut.toUpperCase()})` : ""}
              </TooltipContent>
            </Tooltip>
          ))}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Link" onClick={addLink}>
                <Link className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Link (Ctrl+K)</TooltipContent>
          </Tooltip>
          <span className="ml-auto pr-2 text-[11px] text-muted-foreground hidden sm:inline">
            Select text, then pick a style
          </span>
        </div>
      </TooltipProvider>

      <Textarea
        ref={ref}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        className="font-mono text-sm"
      />
      <p className="text-[11px] text-muted-foreground text-right">
        {value.length}/{maxLength}
      </p>

      {value.trim() && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Preview — how users see it</p>
          <div className="rounded-lg border-l-4 border-primary bg-muted/40 px-3 py-2.5 max-h-72 overflow-y-auto">
            <p className="font-semibold mb-2 text-sm">📢 Announcement</p>
            <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
              <FormattedAnnouncement text={value.trim()} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
