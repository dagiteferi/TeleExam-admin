import { Fragment, type ReactNode } from "react";

/**
 * Announcement formatting, shown in the admin panel exactly as users see it in Telegram:
 *
 *   **bold**   __italic__   ++underline++   ~~strikethrough~~
 *   ||spoiler||   `code`   [link text](https://example.com)
 *
 * A marker without a matching closing marker stays as plain text.
 * Keep in sync with bot/utils/announcement_format.py in the bot.
 */

type Paired = "b" | "i" | "u" | "s" | "spoiler";

// Checked in this order at each position (same as the bot).
const PAIRED: [string, Paired][] = [
  ["**", "b"],
  ["__", "i"],
  ["++", "u"],
  ["~~", "s"],
  ["||", "spoiler"],
];

const LINK = /^\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/;

function wrap(tag: Paired, key: number, children: ReactNode[]): ReactNode {
  switch (tag) {
    case "b":
      return <strong key={key}>{children}</strong>;
    case "i":
      return <em key={key}>{children}</em>;
    case "u":
      return <u key={key}>{children}</u>;
    case "s":
      return <s key={key}>{children}</s>;
    case "spoiler":
      return (
        <span key={key} className="rounded bg-muted-foreground/25 px-0.5" title="Spoiler: hidden until the user taps it">
          {children}
        </span>
      );
  }
}

function render(text: string, allowLinks: boolean): ReactNode[] {
  const out: ReactNode[] = [];
  let plain = "";
  const flush = () => {
    if (plain) out.push(<Fragment key={out.length}>{plain}</Fragment>);
    plain = "";
  };

  let i = 0;
  outer: while (i < text.length) {
    if (text[i] === "`") {
      const end = text.indexOf("`", i + 1);
      if (end > i + 1) {
        flush();
        out.push(
          <code key={out.length} className="rounded bg-muted px-1 font-mono text-[0.9em]">
            {text.slice(i + 1, end)}
          </code>
        );
        i = end + 1;
        continue;
      }
    }

    if (allowLinks && text[i] === "[") {
      const m = LINK.exec(text.slice(i));
      if (m) {
        flush();
        out.push(
          <a key={out.length} href={m[2]} target="_blank" rel="noopener noreferrer" className="text-primary underline">
            {render(m[1], false)}
          </a>
        );
        i += m[0].length;
        continue;
      }
    }

    for (const [marker, tag] of PAIRED) {
      if (text.startsWith(marker, i)) {
        const start = i + marker.length;
        const end = text.indexOf(marker, start);
        if (end > start) {
          flush();
          out.push(wrap(tag, out.length, render(text.slice(start, end), allowLinks)));
          i = end + marker.length;
          continue outer;
        }
      }
    }

    plain += text[i];
    i += 1;
  }
  flush();
  return out;
}

/** The announcement as users see it. Use inside an element with whitespace-pre-wrap. */
export function FormattedAnnouncement({ text }: { text: string }) {
  return <>{render(text, true)}</>;
}
