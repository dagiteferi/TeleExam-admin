import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { g12Api } from "../api";
import { QuestionEditor } from "../components/QuestionEditor";
import { Empty, Loading, PageHeader, StatusBadge, run, useLoad } from "../components/kit";

interface Subject { id: string; code: string; name: string; kind: string; sort: number; is_active: boolean; streams: string[]; ready: number }
interface Unit { id: string; code: string; grade: number | null; unit_no: number; name: string; sort: number; is_active: boolean; ready: number }
interface Paper { id: string; slug: string; subject: string; year: number; exam_type: string; stream: string; label: string; duration_minutes: number | null; question_count: number; is_active: boolean }
interface QuestionRow { id: string; code: string; subject: string; unit: string | null; status: string; preview: string; chapter_confidence: string | null }

const ALL = "all";

function useSubjects() {
  return useLoad(async () => (await g12Api.get<Subject[]>("/subjects")).data);
}

function SubjectsTab() {
  const { data, loading, reload } = useSubjects();
  const patch = async (s: Subject, body: object) => {
    if (await run(() => g12Api.patch(`/subjects/${s.id}`, body), "Saved.")) reload();
  };
  if (loading || !data) return <Loading />;
  return (
    <Table>
      <TableHeader><TableRow><TableHead>Subject</TableHead><TableHead>Streams</TableHead><TableHead>Ready questions</TableHead>
        <TableHead>Order</TableHead><TableHead>Shown</TableHead></TableRow></TableHeader>
      <TableBody>
        {data.map((s) => (
          <TableRow key={s.id}>
            <TableCell className="font-medium">{s.name}</TableCell>
            <TableCell className="capitalize">{s.streams.join(", ")}</TableCell>
            <TableCell>{s.ready}</TableCell>
            <TableCell>{s.sort}</TableCell>
            <TableCell><Switch checked={s.is_active} onCheckedChange={(is_active) => patch(s, { is_active })} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function SubjectSelect({ value, onChange, all = false }: { value: string; onChange: (v: string) => void; all?: boolean }) {
  const { data } = useSubjects();
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-52"><SelectValue placeholder="Choose a subject" /></SelectTrigger>
      <SelectContent>
        {all && <SelectItem value={ALL}>All subjects</SelectItem>}
        {(data ?? []).map((s) => <SelectItem key={s.id} value={all ? s.code : s.id}>{s.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function ChaptersTab() {
  const [subject, setSubject] = useState("");
  const [names, setNames] = useState<Record<string, string>>({});
  const { data, loading, reload } = useLoad(async () =>
    subject ? (await g12Api.get<Unit[]>(`/subjects/${subject}/units`)).data : [], [subject]);
  const patch = async (u: Unit, body: object) => {
    if (await run(() => g12Api.patch(`/units/${u.id}`, body), "Saved.")) {
      setNames((all) => { const next = { ...all }; delete next[u.id]; return next; });
      reload();
    }
  };
  return (
    <div className="space-y-3">
      <SubjectSelect value={subject} onChange={setSubject} />
      {!subject ? <Empty text="Choose a subject to see its chapters." /> : loading ? <Loading /> : (
        <Table>
          <TableHeader><TableRow><TableHead>Grade</TableHead><TableHead>#</TableHead><TableHead>Chapter</TableHead>
            <TableHead>Ready questions</TableHead><TableHead>Shown</TableHead></TableRow></TableHeader>
          <TableBody>
            {(data ?? []).map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.grade ?? "—"}</TableCell>
                <TableCell>{u.unit_no}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Input value={names[u.id] ?? u.name} onChange={(e) => setNames({ ...names, [u.id]: e.target.value })} />
                    {names[u.id] !== undefined && names[u.id] !== u.name &&
                      <Button size="sm" onClick={() => patch(u, { name: names[u.id] })}>Save</Button>}
                  </div>
                </TableCell>
                <TableCell>{u.ready}</TableCell>
                <TableCell><Switch checked={u.is_active} onCheckedChange={(is_active) => patch(u, { is_active })} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function PapersTab() {
  const [subject, setSubject] = useState(ALL);
  const [minutes, setMinutes] = useState<Record<string, string>>({});
  const { data, loading, reload } = useLoad(async () =>
    (await g12Api.get<Paper[]>("/papers", { params: { subject: subject === ALL ? undefined : subject } })).data, [subject]);
  const patch = async (p: Paper, body: object) => {
    if (await run(() => g12Api.patch(`/papers/${p.id}`, body), "Saved.")) reload();
  };
  return (
    <div className="space-y-3">
      <SubjectSelect value={subject} onChange={setSubject} all />
      {loading ? <Loading /> : (
        <Table>
          <TableHeader><TableRow><TableHead>Subject</TableHead><TableHead>Paper</TableHead><TableHead>Type</TableHead>
            <TableHead>Stream</TableHead><TableHead>Questions</TableHead><TableHead>Minutes</TableHead><TableHead>Shown</TableHead></TableRow></TableHeader>
          <TableBody>
            {(data ?? []).map((p) => (
              <TableRow key={p.id}>
                <TableCell className="capitalize">{p.subject}</TableCell>
                <TableCell className="font-medium">{p.label}</TableCell>
                <TableCell className="capitalize">{p.exam_type}</TableCell>
                <TableCell className="capitalize">{p.stream}</TableCell>
                <TableCell>{p.question_count}</TableCell>
                <TableCell>
                  <div className="flex gap-2 items-center">
                    <Input className="w-20" placeholder="auto" value={minutes[p.id] ?? (p.duration_minutes ?? "")}
                           onChange={(e) => setMinutes({ ...minutes, [p.id]: e.target.value })} />
                    {minutes[p.id] !== undefined && /^\d+$/.test(minutes[p.id]) &&
                      <Button size="sm" onClick={() => patch(p, { duration_minutes: Number(minutes[p.id]) })}>Save</Button>}
                  </div>
                </TableCell>
                <TableCell><Switch checked={p.is_active} onCheckedChange={(is_active) => patch(p, { is_active })} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function QuestionsTab() {
  const [subject, setSubject] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const { data, loading, reload } = useLoad(async () => (await g12Api.get<{ items: QuestionRow[] }>("/questions", {
    params: { subject: subject === ALL ? undefined : subject, status: status === ALL ? undefined : status, q: query || undefined, limit: 100 },
  })).data.items, [subject, status, query]);
  return (
    <div className="space-y-3">
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); setQuery(text.trim()); }}>
        <SubjectSelect value={subject} onChange={setSubject} all />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value={ALL}>All statuses</SelectItem><SelectItem value="ready">Ready</SelectItem>
            <SelectItem value="hidden">Hidden</SelectItem><SelectItem value="review">Needs review</SelectItem></SelectContent>
        </Select>
        <Input className="max-w-xs" placeholder="Search text or code" value={text} onChange={(e) => setText(e.target.value)} />
        <Button type="submit" variant="outline"><Search className="h-4 w-4 mr-1" />Search</Button>
      </form>
      {loading ? <Loading /> : !data?.length ? <Empty text="No questions found." /> : (
        <Table>
          <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Question</TableHead><TableHead>Chapter</TableHead>
            <TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {data.map((q) => (
              <TableRow key={q.id}>
                <TableCell className="font-mono text-xs whitespace-nowrap">{q.code}</TableCell>
                <TableCell className="max-w-lg truncate">{q.preview}</TableCell>
                <TableCell>{q.unit ?? "—"}</TableCell>
                <TableCell><StatusBadge value={q.status} /></TableCell>
                <TableCell><Button size="sm" variant="outline" onClick={() => setOpen(q.id)}>Edit</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {open && <QuestionEditor id={open} onClose={() => setOpen(null)} onSaved={reload} />}
    </div>
  );
}

export default function G12ContentPage() {
  return (
    <>
      <PageHeader title="Content" description="Subjects, chapters, exam papers and questions. Hidden items are never shown to students." />
      <Tabs defaultValue="questions">
        <TabsList><TabsTrigger value="questions">Questions</TabsTrigger><TabsTrigger value="papers">Papers</TabsTrigger>
          <TabsTrigger value="chapters">Chapters</TabsTrigger><TabsTrigger value="subjects">Subjects</TabsTrigger></TabsList>
        <Card className="mt-4"><CardContent className="p-4">
          <TabsContent value="questions" className="mt-0"><QuestionsTab /></TabsContent>
          <TabsContent value="papers" className="mt-0"><PapersTab /></TabsContent>
          <TabsContent value="chapters" className="mt-0"><ChaptersTab /></TabsContent>
          <TabsContent value="subjects" className="mt-0"><SubjectsTab /></TabsContent>
        </CardContent></Card>
      </Tabs>
    </>
  );
}
