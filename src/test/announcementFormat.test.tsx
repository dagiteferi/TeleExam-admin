import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FormattedAnnouncement } from "@/lib/announcementFormat";

const html = (text: string) => renderToStaticMarkup(<FormattedAnnouncement text={text} />);

describe("FormattedAnnouncement", () => {
  it("formats the supported markers", () => {
    expect(html("**b** __i__ ++u++ ~~s~~")).toBe("<strong>b</strong> <em>i</em> <u>u</u> <s>s</s>");
  });
  it("nests formatting", () => {
    expect(html("**__x__ y**")).toBe("<strong><em>x</em> y</strong>");
  });
  it("keeps code as-is", () => {
    expect(html("`a **b**`")).toContain(">a **b**</code>");
  });
  it("renders http(s) links only", () => {
    expect(html("[site](https://t.me/TeleExamAI)")).toContain('href="https://t.me/TeleExamAI"');
    expect(html("[x](javascript:alert(1))")).toBe("[x](javascript:alert(1))");
  });
  it("leaves unmatched markers as text", () => {
    expect(html("2 ** 3 and a__b")).toBe("2 ** 3 and a__b");
    expect(html("<b>&")).toBe("&lt;b&gt;&amp;");
  });
});
