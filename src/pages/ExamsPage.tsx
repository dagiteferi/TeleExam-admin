import { useEffect, useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Search, Plus, Pencil, Trash2, Loader2, ChevronLeft, ChevronRight, Eye, BookOpen, FileQuestion, ClipboardList, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Department { id: string; code: string; name: string; is_active: boolean; }
interface Course { id: string; department_id: string; code: string; name: string; is_active: boolean; }
interface Topic { id: string; course_id: string; code: string; name: string; }

interface PastExam {
  id: string; department_id: string; course_id: string | null;
  year: number; semester: string; created_at: string;
  question_count: number; department_name: string | null; course_name: string | null;
}

interface Question {
  id: string; course_id: string; topic_id: string; format: string;
  prompt: string; choice_a: string; choice_b: string; choice_c: string; choice_d: string;
  correct_choice: string; difficulty: number | null; source: string | null;
  explanation_static: string | null; is_active: boolean;
  created_at: string; updated_at: string;
  course_name: string | null; topic_name: string | null;
}

interface ExamTemplateTopic { topic_id: string; topic_name: string | null; weight: number; }
interface ExamTemplate {
  id: string; course_id: string; code: string; name: string; mode: string;
  question_count: number; duration_seconds: number | null; is_active: boolean;
  created_at: string; course_name: string | null; topics: ExamTemplateTopic[];
}

const LIMIT = 20;
const emptyQuestion = () => ({
  course_id: "", topic_id: "", prompt: "", choice_a: "", choice_b: "",
  choice_c: "", choice_d: "", correct_choice: "A" as "A"|"B"|"C"|"D",
  difficulty: "" as any, source: "", explanation_static: "", is_active: true,
});
const emptyPastExam = () => ({ department_id: "", course_id: "", year: new Date().getFullYear(), semester: "1" });
const emptyTemplate = () => ({
  course_id: "", code: "", name: "", mode: "exam" as "exam"|"quiz",
  question_count: 50, duration_seconds: "" as any, is_active: true, topics: [] as ExamTemplateTopic[],
});

// ─── Shared hooks ─────────────────────────────────────────────────────────────

function useSupport() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);

  useEffect(() => {
    api.get("/admin/exams/departments").then(r => setDepartments(r.data)).catch(() => {});
    api.get("/admin/exams/courses").then(r => setCourses(r.data)).catch(() => {});
    api.get("/admin/exams/topics").then(r => setTopics(r.data)).catch(() => {});
  }, []);

  const coursesByDept = (deptId: string) => courses.filter(c => c.department_id === deptId);
  const topicsByCourse = (courseId: string) => topics.filter(t => t.course_id === courseId);

  return { departments, courses, topics, coursesByDept, topicsByCourse };
}

// ─── Past Exams Tab ───────────────────────────────────────────────────────────

function PastExamsTab({ support }: { support: ReturnType<typeof useSupport> }) {
  const { departments, coursesByDept } = support;
  const [exams, setExams] = useState<PastExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [filterDept, setFilterDept] = useState("all");
  const [filterYear, setFilterYear] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PastExam | null>(null);
  const [form, setForm] = useState(emptyPastExam());
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PastExam | null>(null);

  const fetch = useCallback(() => {
    setLoading(true);
    const params: any = { limit: LIMIT, offset };
    if (filterDept !== "all") params.department_id = filterDept;
    if (filterYear.trim()) params.year = parseInt(filterYear);
    api.get("/admin/exams/past-exams", { params })
      .then(r => setExams(r.data))
      .catch(() => toast.error("Failed to fetch past exams"))
      .finally(() => setLoading(false));
  }, [offset, filterDept, filterYear]);

  useEffect(() => { fetch(); }, [fetch]);

  const openCreate = () => { setEditing(null); setForm(emptyPastExam()); setModalOpen(true); };
  const openEdit = (e: PastExam) => {
    setEditing(e);
    setForm({ department_id: e.department_id, course_id: e.course_id || "", year: e.year, semester: e.semester });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form, course_id: form.course_id || null };
      if (editing) {
        await api.patch(`/admin/exams/past-exams/${editing.id}`, payload);
        toast.success("Past exam updated");
      } else {
        await api.post("/admin/exams/past-exams", payload);
        toast.success("Past exam created");
      }
      setModalOpen(false); fetch();
    } catch { toast.error("Save failed"); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/admin/exams/past-exams/${deleteTarget.id}`);
      toast.success("Past exam deleted");
      setDeleteTarget(null); fetch();
    } catch { toast.error("Delete failed"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <Select value={filterDept} onValueChange={v => { setFilterDept(v); setOffset(0); }}>
            <SelectTrigger className="w-[200px] h-9"><SelectValue placeholder="All Departments" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="Filter by year…" className="w-32 h-9" value={filterYear}
            onChange={e => { setFilterYear(e.target.value); setOffset(0); }} />
        </div>
        <Button size="sm" className="h-9" onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> New Past Exam</Button>
      </div>

      <Card className="border border-primary/10 shadow-lg overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Year / Sem</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Course</TableHead>
                <TableHead className="text-center">Questions</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                </TableCell></TableRow>
              ) : exams.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">No past exams found</TableCell></TableRow>
              ) : exams.map(e => (
                <TableRow key={e.id} className="hover:bg-primary/5 transition-colors">
                  <TableCell><span className="font-mono font-bold">{e.year}</span><span className="text-muted-foreground text-xs ml-1">/ Sem {e.semester}</span></TableCell>
                  <TableCell>{e.department_name ?? e.department_id.slice(0, 8)}</TableCell>
                  <TableCell>{e.course_name ?? <span className="text-muted-foreground text-xs italic">N/A</span>}</TableCell>
                  <TableCell className="text-center"><Badge variant="outline">{e.question_count}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" className="h-8" onClick={() => openEdit(e)}><Pencil className="h-3.5 w-3.5 mr-1" /> Edit</Button>
                      <Button variant="outline" size="sm" className="h-8 border-red-400 text-red-500 hover:bg-red-50" onClick={() => setDeleteTarget(e)}><Trash2 className="h-3.5 w-3.5 mr-1" /> Delete</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
            <span className="text-xs text-muted-foreground font-mono">Showing {offset + 1}–{offset + exams.length}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-8" disabled={offset === 0} onClick={() => setOffset(o => Math.max(0, o - LIMIT))}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" className="h-8" disabled={exams.length < LIMIT} onClick={() => setOffset(o => o + LIMIT)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={open => !open && setModalOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Past Exam" : "New Past Exam"}</DialogTitle>
            <DialogDescription>Fill in the exam metadata. Questions are linked separately.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Department</Label>
              <Select value={form.department_id} onValueChange={v => setForm(f => ({ ...f, department_id: v, course_id: "" }))}>
                <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>{departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Course <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Select value={form.course_id || "none"} onValueChange={v => setForm(f => ({ ...f, course_id: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {coursesByDept(form.department_id).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Year</Label>
                <Input type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: parseInt(e.target.value) || f.year }))} />
              </div>
              <div className="space-y-1">
                <Label>Semester</Label>
                <Select value={form.semester} onValueChange={v => setForm(f => ({ ...f, semester: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Semester 1</SelectItem>
                    <SelectItem value="2">Semester 2</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.department_id || !form.year}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {editing ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Past Exam?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the <strong>{deleteTarget?.year} Sem {deleteTarget?.semester}</strong> exam and unlink all its questions. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Questions Tab ─────────────────────────────────────────────────────────────

function QuestionsTab({ support }: { support: ReturnType<typeof useSupport> }) {
  const { courses, topicsByCourse } = support;
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCourse, setFilterCourse] = useState("all");
  const [filterActive, setFilterActive] = useState("all");
  const [offset, setOffset] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Question | null>(null);
  const [form, setForm] = useState(emptyQuestion());
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Question | null>(null);

  const fetch = useCallback(() => {
    setLoading(true);
    const params: any = { limit: LIMIT, offset };
    if (filterCourse !== "all") params.course_id = filterCourse;
    if (filterActive !== "all") params.is_active = filterActive === "active";
    if (search.trim()) params.search = search.trim();
    api.get("/admin/exams/questions", { params })
      .then(r => setQuestions(r.data))
      .catch(() => toast.error("Failed to fetch questions"))
      .finally(() => setLoading(false));
  }, [offset, filterCourse, filterActive, search]);

  useEffect(() => {
    const t = setTimeout(fetch, 400);
    return () => clearTimeout(t);
  }, [fetch]);

  const openCreate = () => { setEditing(null); setForm(emptyQuestion()); setModalOpen(true); };
  const openEdit = (q: Question) => {
    setEditing(q);
    setForm({
      course_id: q.course_id, topic_id: q.topic_id, prompt: q.prompt,
      choice_a: q.choice_a, choice_b: q.choice_b, choice_c: q.choice_c, choice_d: q.choice_d,
      correct_choice: q.correct_choice as any, difficulty: q.difficulty ?? "",
      source: q.source ?? "", explanation_static: q.explanation_static ?? "", is_active: q.is_active,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form, difficulty: form.difficulty !== "" ? parseInt(String(form.difficulty)) : null,
        source: form.source || null, explanation_static: form.explanation_static || null };
      if (editing) {
        await api.patch(`/admin/exams/questions/${editing.id}`, payload);
        toast.success("Question updated");
      } else {
        await api.post("/admin/exams/questions", payload);
        toast.success("Question created");
      }
      setModalOpen(false); fetch();
    } catch (e: any) {
      const msg = e?.response?.data?.detail?.error?.message || "Save failed";
      toast.error(msg);
    } finally { setSaving(false); }
  };

  const handleDelete = async (q: Question, hard = false) => {
    try {
      await api.delete(`/admin/exams/questions/${q.id}`, { params: { hard } });
      toast.success(hard ? "Question hard-deleted" : "Question deactivated");
      setDeleteTarget(null); fetch();
    } catch { toast.error("Delete failed"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2 flex-wrap items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search questions…" className="pl-9 w-64 h-9" value={search}
              onChange={e => { setSearch(e.target.value); setOffset(0); }} />
          </div>
          <Select value={filterCourse} onValueChange={v => { setFilterCourse(v); setOffset(0); }}>
            <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="All Courses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Courses</SelectItem>
              {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterActive} onValueChange={v => { setFilterActive(v); setOffset(0); }}>
            <SelectTrigger className="w-[130px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active Only</SelectItem>
              <SelectItem value="inactive">Inactive Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" className="h-9" onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> New Question</Button>
      </div>

      <Card className="border border-primary/10 shadow-lg overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Prompt</TableHead>
                <TableHead>Course / Topic</TableHead>
                <TableHead className="text-center">Correct</TableHead>
                <TableHead className="text-center">Difficulty</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                </TableCell></TableRow>
              ) : questions.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No questions found</TableCell></TableRow>
              ) : questions.map(q => (
                <TableRow key={q.id} className="hover:bg-primary/5 transition-colors">
                  <TableCell className="max-w-xs">
                    <p className="truncate font-medium text-sm">{q.prompt}</p>
                    {q.source && <p className="text-xs text-muted-foreground truncate">{q.source}</p>}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-xs font-medium">{q.course_name}</span>
                      <span className="text-xs text-muted-foreground">{q.topic_name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center"><Badge className="bg-green-600 text-white">{q.correct_choice}</Badge></TableCell>
                  <TableCell className="text-center">
                    {q.difficulty ? <span className="font-mono text-sm">{q.difficulty}/5</span> : <span className="text-muted-foreground text-xs">—</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    {q.is_active
                      ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                      : <XCircle className="h-4 w-4 text-red-400 mx-auto" />}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" className="h-8" onClick={() => openEdit(q)}><Pencil className="h-3.5 w-3.5 mr-1" /> Edit</Button>
                      <Button variant="outline" size="sm" className="h-8 border-red-400 text-red-500 hover:bg-red-50" onClick={() => setDeleteTarget(q)}>
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> {q.is_active ? "Deactivate" : "Delete"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
            <span className="text-xs text-muted-foreground font-mono">Showing {offset + 1}–{offset + questions.length}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-8" disabled={offset === 0} onClick={() => setOffset(o => Math.max(0, o - LIMIT))}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" className="h-8" disabled={questions.length < LIMIT} onClick={() => setOffset(o => o + LIMIT)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={open => !open && setModalOpen(false)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Question" : "New Question"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Course</Label>
                <Select value={form.course_id} onValueChange={v => setForm(f => ({ ...f, course_id: v, topic_id: "" }))}>
                  <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                  <SelectContent>{courses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Topic</Label>
                <Select value={form.topic_id} onValueChange={v => setForm(f => ({ ...f, topic_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select topic" /></SelectTrigger>
                  <SelectContent>{topicsByCourse(form.course_id).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Question Prompt</Label>
              <Textarea placeholder="Enter the question text…" className="min-h-[80px]" value={form.prompt}
                onChange={e => setForm(f => ({ ...f, prompt: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(["a", "b", "c", "d"] as const).map(k => (
                <div key={k} className="space-y-1">
                  <Label className="flex items-center gap-1">
                    Choice {k.toUpperCase()}
                    {form.correct_choice === k.toUpperCase() && <Badge className="h-4 text-[10px] bg-green-600 ml-1">✓ Correct</Badge>}
                  </Label>
                  <Input placeholder={`Choice ${k.toUpperCase()}…`} value={(form as any)[`choice_${k}`]}
                    onChange={e => setForm(f => ({ ...f, [`choice_${k}`]: e.target.value }))} />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Correct Answer</Label>
                <Select value={form.correct_choice} onValueChange={v => setForm(f => ({ ...f, correct_choice: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["A","B","C","D"].map(c => <SelectItem key={c} value={c}>Choice {c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Difficulty <span className="text-muted-foreground text-xs">(1–5)</span></Label>
                <Select value={String(form.difficulty || "none")} onValueChange={v => setForm(f => ({ ...f, difficulty: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Not set —</SelectItem>
                    {[1,2,3,4,5].map(n => <SelectItem key={n} value={String(n)}>{n} — {"★".repeat(n)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Active</Label>
                <Select value={form.is_active ? "true" : "false"} onValueChange={v => setForm(f => ({ ...f, is_active: v === "true" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Active</SelectItem>
                    <SelectItem value="false">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Source <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input placeholder="e.g. Ethiopian Grade 12 National Exam 2022" value={form.source}
                onChange={e => setForm(f => ({ ...f, source: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Explanation <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea placeholder="Static explanation shown after answering…" className="min-h-[60px]" value={form.explanation_static}
                onChange={e => setForm(f => ({ ...f, explanation_static: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.course_id || !form.topic_id || !form.prompt}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {editing ? "Save Changes" : "Create Question"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete / Deactivate Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteTarget?.is_active ? "Deactivate Question?" : "Hard-Delete Question?"}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p className="font-medium text-foreground line-clamp-2">{deleteTarget?.prompt}</p>
              {deleteTarget?.is_active
                ? "This will soft-delete the question (set it inactive). It won't appear in exams but can be reactivated."
                : "This question is already inactive. You can hard-delete it permanently — this cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {deleteTarget?.is_active
              ? <AlertDialogAction className="bg-amber-500 hover:bg-amber-600" onClick={() => deleteTarget && handleDelete(deleteTarget, false)}>Deactivate</AlertDialogAction>
              : <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteTarget && handleDelete(deleteTarget, true)}>Delete Permanently</AlertDialogAction>}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Exam Templates Tab ────────────────────────────────────────────────────────

function TemplatesTab({ support }: { support: ReturnType<typeof useSupport> }) {
  const { courses, topicsByCourse } = support;
  const [templates, setTemplates] = useState<ExamTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCourse, setFilterCourse] = useState("all");
  const [filterMode, setFilterMode] = useState("all");
  const [offset, setOffset] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ExamTemplate | null>(null);
  const [form, setForm] = useState(emptyTemplate());
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ExamTemplate | null>(null);

  const fetch = useCallback(() => {
    setLoading(true);
    const params: any = { limit: LIMIT, offset };
    if (filterCourse !== "all") params.course_id = filterCourse;
    if (filterMode !== "all") params.mode = filterMode;
    api.get("/admin/exams/templates", { params })
      .then(r => setTemplates(r.data))
      .catch(() => toast.error("Failed to fetch templates"))
      .finally(() => setLoading(false));
  }, [offset, filterCourse, filterMode]);

  useEffect(() => { fetch(); }, [fetch]);

  const openCreate = () => { setEditing(null); setForm(emptyTemplate()); setModalOpen(true); };
  const openEdit = (t: ExamTemplate) => {
    setEditing(t);
    setForm({
      course_id: t.course_id, code: t.code, name: t.name, mode: t.mode as any,
      question_count: t.question_count, duration_seconds: t.duration_seconds ?? "",
      is_active: t.is_active, topics: t.topics,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form, duration_seconds: form.duration_seconds !== "" ? parseInt(String(form.duration_seconds)) : null };
      if (editing) {
        await api.patch(`/admin/exams/templates/${editing.id}`, payload);
        toast.success("Template updated");
      } else {
        await api.post("/admin/exams/templates", payload);
        toast.success("Template created");
      }
      setModalOpen(false); fetch();
    } catch { toast.error("Save failed"); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/admin/exams/templates/${deleteTarget.id}`);
      toast.success("Template deleted");
      setDeleteTarget(null); fetch();
    } catch { toast.error("Delete failed"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <Select value={filterCourse} onValueChange={v => { setFilterCourse(v); setOffset(0); }}>
            <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="All Courses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Courses</SelectItem>
              {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterMode} onValueChange={v => { setFilterMode(v); setOffset(0); }}>
            <SelectTrigger className="w-[120px] h-9"><SelectValue placeholder="Mode" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Modes</SelectItem>
              <SelectItem value="exam">Exam</SelectItem>
              <SelectItem value="quiz">Quiz</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" className="h-9" onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> New Template</Button>
      </div>

      <Card className="border border-primary/10 shadow-lg overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Template</TableHead>
                <TableHead>Course</TableHead>
                <TableHead className="text-center">Mode</TableHead>
                <TableHead className="text-center">Questions</TableHead>
                <TableHead className="text-center">Duration</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                </TableCell></TableRow>
              ) : templates.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">No templates found</TableCell></TableRow>
              ) : templates.map(t => (
                <TableRow key={t.id} className="hover:bg-primary/5 transition-colors">
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-semibold">{t.name}</span>
                      <span className="text-xs text-muted-foreground font-mono">{t.code}</span>
                    </div>
                  </TableCell>
                  <TableCell>{t.course_name}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={t.mode === "exam" ? "default" : "secondary"}>{t.mode}</Badge>
                  </TableCell>
                  <TableCell className="text-center font-mono">{t.question_count}</TableCell>
                  <TableCell className="text-center text-sm">
                    {t.duration_seconds ? `${Math.round(t.duration_seconds / 60)} min` : <span className="text-muted-foreground text-xs">—</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    {t.is_active ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" /> : <XCircle className="h-4 w-4 text-red-400 mx-auto" />}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" className="h-8" onClick={() => openEdit(t)}><Pencil className="h-3.5 w-3.5 mr-1" /> Edit</Button>
                      <Button variant="outline" size="sm" className="h-8 border-red-400 text-red-500 hover:bg-red-50" onClick={() => setDeleteTarget(t)}><Trash2 className="h-3.5 w-3.5 mr-1" /> Delete</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
            <span className="text-xs text-muted-foreground font-mono">Showing {offset + 1}–{offset + templates.length}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-8" disabled={offset === 0} onClick={() => setOffset(o => Math.max(0, o - LIMIT))}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" className="h-8" disabled={templates.length < LIMIT} onClick={() => setOffset(o => o + LIMIT)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={open => !open && setModalOpen(false)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Template" : "New Exam Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Course</Label>
              <Select value={form.course_id} onValueChange={v => setForm(f => ({ ...f, course_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                <SelectContent>{courses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Code</Label>
                <Input placeholder="e.g. MATH-FINAL" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Mode</Label>
                <Select value={form.mode} onValueChange={v => setForm(f => ({ ...f, mode: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="exam">Exam</SelectItem>
                    <SelectItem value="quiz">Quiz</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Name</Label>
              <Input placeholder="e.g. Mathematics Final Exam" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Question Count</Label>
                <Input type="number" value={form.question_count} onChange={e => setForm(f => ({ ...f, question_count: parseInt(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-1">
                <Label>Duration (seconds) <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input type="number" placeholder="e.g. 3600" value={form.duration_seconds}
                  onChange={e => setForm(f => ({ ...f, duration_seconds: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Active</Label>
              <Select value={form.is_active ? "true" : "false"} onValueChange={v => setForm(f => ({ ...f, is_active: v === "true" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.course_id || !form.code || !form.name}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {editing ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template?</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete <strong>{deleteTarget?.name}</strong>? This will also remove all topic associations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function ExamsPage() {
  const support = useSupport();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold italic tracking-tight">EXAM MANAGEMENT</h1>
          <p className="text-muted-foreground text-sm uppercase tracking-widest">Content Control Interface</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="h-6"><BookOpen className="h-3 w-3 mr-1" /> Content Admin</Badge>
        </div>
      </div>

      <Tabs defaultValue="past-exams" className="space-y-4">
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="past-exams" className="gap-1.5">
            <FileQuestion className="h-4 w-4" /> Past Exams
          </TabsTrigger>
          <TabsTrigger value="questions" className="gap-1.5">
            <ClipboardList className="h-4 w-4" /> Questions
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-1.5">
            <BookOpen className="h-4 w-4" /> Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="past-exams">
          <PastExamsTab support={support} />
        </TabsContent>
        <TabsContent value="questions">
          <QuestionsTab support={support} />
        </TabsContent>
        <TabsContent value="templates">
          <TemplatesTab support={support} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
