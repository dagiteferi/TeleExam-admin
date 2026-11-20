import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, g12Api } from "../api";
import { Loading, StatusBadge } from "./kit";

interface Option {
  letter: string;
  text?: string;
  latex?: string | null;
}

interface Question {
  id: string;
  code: string;
  subject: string;
  unit_name: string | null;
  stem: string;
  options: Option[];
  correct_option: string;
  explanation: string | null;
  difficulty: string | null;
  status: string;
  hidden_reason: string | null;
  topic: string | null;
  version: number;
  papers: { label: string; question_number: number }[];
  reports: { reason: string; note: string | null; created_at: string }[];
  media: { media_id?: string; id?: string; kind: string; option_letter: string | null; url: string | null }[];
}

type Draft = Pick<Question, "stem" | "options" | "correct_option" | "explanation" | "status" | "hidden_reason" | "difficulty" | "topic">;

const pick = (q: Question): Draft => ({
  stem: q.stem, options: q.options.map((o) => ({ ...o })), correct_option: q.correct_option,
  explanation: q.explanation ?? "", status: q.status, hidden_reason: q.hidden_reason ?? "", difficulty: q.difficulty, topic: q.topic ?? "",
});

export function QuestionEditor({ id, onClose, onSaved }: { id: string; onClose: () => void; onSaved?: () => void }) {
  const [question, setQuestion] = useState<Question | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    g12Api.get<Question>(`/questions/${id}`)
      .then(({ data }) => { setQuestion(data); setDraft(pick(data)); })
      .catch((err) => { toast.error(errorMessage(err, "Could not open this question.")); onClose(); });
  }, [id, onClose]);

  const save = async () => {
    if (!question || !draft) return;
    const original = pick(question);
    const changes = Object.fromEntries(Object.entries(draft).filter(([key, value]) =>
      JSON.stringify(value) !== JSON.stringify(original[key as keyof Draft])));
    if (draft.status !== "hidden") delete changes.hidden_reason;
    if (!Object.keys(changes).length) return onClose();
    setSaving(true);
    try {
      await g12Api.patch(`/questions/${id}`, { version: question.version, changes });
      toast.success("Question saved. The bot shows the new version right away.");
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const setOption = (index: number, text: string) =>
    draft && setDraft({ ...draft, options: draft.options.map((o, i) => (i === index ? { ...o, text } : o)) });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {question ? <><span className="font-mono">{question.code}</span><StatusBadge value={question.status} /></> : "Question"}
          </DialogTitle>
        </DialogHeader>
        {!question || !draft ? <Loading /> : (
          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              {question.subject} · {question.unit_name ?? "no chapter"}
              {question.papers.length > 0 && ` · ${question.papers.map((p) => `${p.label} Q${p.question_number}`).join(", ")}`}
            </p>
            {question.media.filter((m) => m.url).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {question.media.filter((m) => m.url).map((m, i) => (
                  <a key={i} href={m.url!} target="_blank" rel="noreferrer" title={m.kind}>
                    <img src={m.url!} alt={m.kind} className="h-28 rounded border object-contain bg-white" />
                  </a>
                ))}
              </div>
            )}
            <div className="space-y-1"><Label>Question</Label>
              <Textarea rows={4} value={draft.stem} onChange={(e) => setDraft({ ...draft, stem: e.target.value })} /></div>
            <div className="space-y-2"><Label>Options</Label>
              {draft.options.map((o, i) => (
                <div key={o.letter} className="flex items-center gap-2">
                  <span className="w-6 font-semibold">{o.letter}</span>
                  <Input value={o.text ?? ""} onChange={(e) => setOption(i, e.target.value)} />
                </div>
              ))}</div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1"><Label>Correct answer</Label>
                <Select value={draft.correct_option} onValueChange={(correct_option) => setDraft({ ...draft, correct_option })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{draft.options.map((o) => <SelectItem key={o.letter} value={o.letter}>{o.letter}</SelectItem>)}</SelectContent>
                </Select></div>
              <div className="space-y-1"><Label>Difficulty</Label>
                <Select value={draft.difficulty ?? "none"} onValueChange={(v) => setDraft({ ...draft, difficulty: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">Not set</SelectItem><SelectItem value="E">Easy</SelectItem>
                    <SelectItem value="M">Medium</SelectItem><SelectItem value="H">Hard</SelectItem></SelectContent>
                </Select></div>
              <div className="space-y-1"><Label>Status</Label>
                <Select value={draft.status} onValueChange={(status) => setDraft({ ...draft, status })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="ready">Ready (shown)</SelectItem><SelectItem value="hidden">Hidden</SelectItem>
                    <SelectItem value="review">Needs review</SelectItem><SelectItem value="draft">Draft</SelectItem></SelectContent>
                </Select></div>
            </div>
            {draft.status === "hidden" && (
              <div className="space-y-1"><Label>Why hidden (required)</Label>
                <Input value={draft.hidden_reason ?? ""} onChange={(e) => setDraft({ ...draft, hidden_reason: e.target.value })} /></div>
            )}
            <div className="space-y-1"><Label>Topic</Label>
              <Input value={draft.topic ?? ""} onChange={(e) => setDraft({ ...draft, topic: e.target.value })} /></div>
            <div className="space-y-1"><Label>Explanation</Label>
              <Textarea rows={5} value={draft.explanation ?? ""} onChange={(e) => setDraft({ ...draft, explanation: e.target.value })} /></div>
            {question.reports.length > 0 && (
              <div className="border-t pt-3"><p className="font-medium mb-1">Student reports</p>
                {question.reports.map((r, i) => <p key={i}>• {r.reason.replace(/_/g, " ")}{r.note ? `: ${r.note}` : ""}</p>)}</div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!draft || saving} onClick={save}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
