import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { g12Api } from "../api";
import { QuestionEditor } from "../components/QuestionEditor";
import { Empty, Loading, PageHeader, StatusBadge, run, useLoad, when } from "../components/kit";

interface Item {
  id: string;
  kind: string;
  question_id: string | null;
  code: string | null;
  note: string | null;
  created_at: string;
}

const KINDS: [string, string][] = [
  ["reported", "Reported by students"], ["hidden", "Hidden"], ["low_confidence", "Unsure chapter"],
  ["missing_picture", "Missing picture"], ["review", "Needs review"], ["ai_explanation", "AI explanations"],
];

export default function G12ReviewPage() {
  const [kind, setKind] = useState("reported");
  const [open, setOpen] = useState<string | null>(null);
  const { data, loading, reload } = useLoad(async () =>
    (await g12Api.get<{ items: Item[] }>("/review-queue", { params: { kind, limit: 100 } })).data, [kind]);
  const counts = useLoad(async () =>
    (await g12Api.get<{ counts: Record<string, number> }>("/review-queue", { params: { limit: 1 } })).data.counts);

  const refresh = () => {
    reload();
    counts.reload();
  };
  const resolve = async (item: Item, action: string, message: string) => {
    if (await run(() => g12Api.post(`/review-queue/${encodeURIComponent(item.id)}/resolve`, { action }), message)) refresh();
  };

  return (
    <>
      <PageHeader title="Review Queue" description="Questions and explanations that need a human decision." />
      <Tabs value={kind} onValueChange={setKind}>
        <TabsList className="flex-wrap h-auto">
          {KINDS.map(([value, label]) => (
            <TabsTrigger key={value} value={value}>{label}{counts.data?.[value] ? ` (${counts.data[value]})` : ""}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <Card className="mt-4">
        <CardContent className="p-4 space-y-3">
          {loading || !data ? <Loading /> : !data.items.length ? <Empty text="Nothing to review here." /> : data.items.map((item) => (
            <div key={item.id} className="border rounded-md p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono text-foreground">{item.code ?? item.id}</span>
                <StatusBadge value={item.kind} /><span>{when(item.created_at)}</span>
              </div>
              {item.note && <p className="text-sm">{item.note}</p>}
              <div className="flex flex-wrap gap-2">
                {item.question_id && <Button size="sm" onClick={() => setOpen(item.question_id)}>Open and fix</Button>}
                <Button size="sm" variant="outline" onClick={() => resolve(item, "fix_applied", "Marked as fixed.")}>Fixed</Button>
                <Button size="sm" variant="outline" onClick={() => resolve(item, "approve", "Approved and shown.")}>Approve</Button>
                <Button size="sm" variant="outline" onClick={() => resolve(item, "hide", "Hidden from students.")}>Hide</Button>
                <Button size="sm" variant="ghost" onClick={() => resolve(item, "dismiss", "Dismissed.")}>Dismiss</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      {open && <QuestionEditor id={open} onClose={() => setOpen(null)} onSaved={refresh} />}
    </>
  );
}
