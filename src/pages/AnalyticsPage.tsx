import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import api from "@/lib/api";

type DauChartPoint = { date: string; count: number };
type ReferralRow = { username: string; invites: number };
type QuestionRow = { id: string; text: string; attempts: number; accuracy: number };

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function AnalyticsPage() {
  const [dau, setDau] = useState<DauChartPoint[]>([]);
  const [examStats, setExamStats] = useState<{ total_exams: number; total_users: number; average_score: number } | null>(null);
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);

  const examBar = useMemo(() => {
    if (!examStats) return [];
    return [
      { metric: "Total Users", value: examStats.total_users },
      { metric: "Total Exams", value: examStats.total_exams },
      { metric: "Avg Score", value: Number(examStats.average_score.toFixed(2)) },
    ];
  }, [examStats]);

  useEffect(() => {
    (async () => {
      try {
        const today = new Date();
        const start = new Date();
        start.setDate(today.getDate() - 29);

        const [dauResp, examsResp, referralsResp, questionsResp] = await Promise.all([
          api.get("/admin/stats/dau", { params: { start_date: toISODate(start), end_date: toISODate(today) } }),
          api.get("/admin/stats/exams"),
          api.get("/admin/stats/referrals"),
          api.get("/admin/stats/questions"),
        ]);

        const dauData = Array.isArray(dauResp.data?.data) ? dauResp.data.data : [];
        setDau(
          dauData.map((p: any) => ({
            date: new Date(p.day).toLocaleDateString("en", { month: "short", day: "numeric" }),
            count: p.dau,
          }))
        );

        setExamStats(examsResp.data);

        const inviters = Array.isArray(referralsResp.data?.top_inviters) ? referralsResp.data.top_inviters : [];
        setReferrals(
          inviters.map((r: any) => ({
            username: r.telegram_username ? `@${String(r.telegram_username).replace(/^@/, "")}` : String(r.telegram_id),
            invites: r.invite_count,
          }))
        );

        const qs = Array.isArray(questionsResp.data) ? questionsResp.data : [];
        setQuestions(
          qs.map((q: any) => ({
            id: q.question_id,
            text: q.prompt,
            attempts: q.total_answer_count,
            accuracy: Math.round((q.accuracy ?? 0) * 100),
          }))
        );
      } catch {
        // Keep empty state (auth/permissions will already gate this page).
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground text-sm">Platform performance and insights</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* DAU Chart */}
        <Card className="animate-fade-in">
          <CardHeader><CardTitle className="text-base">Daily Active Users</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dau}>
                  <defs>
                    <linearGradient id="dauGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)", fontSize: 12 }} />
                  <Area type="monotone" dataKey="count" stroke="hsl(var(--chart-1))" fill="url(#dauGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Exam Stats Bar Chart */}
        <Card className="animate-fade-in">
          <CardHeader><CardTitle className="text-base">Exam Statistics</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={examBar}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="metric" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)", fontSize: 12 }} />
                  <Bar dataKey="value" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top Referrers */}
        <Card className="animate-fade-in">
          <CardHeader><CardTitle className="text-base">Top Referrers</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {referrals.map((r, i) => (
                <div key={r.username} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-muted-foreground w-5">{i + 1}.</span>
                    <span className="text-sm font-medium">{r.username}</span>
                  </div>
                  <Badge variant="secondary">{r.invites} invites</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Question Performance */}
        <Card className="animate-fade-in">
          <CardHeader><CardTitle className="text-base">Question Performance</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">ID</TableHead>
                  <TableHead>Question</TableHead>
                  <TableHead className="text-right">Attempts</TableHead>
                  <TableHead className="text-right">Accuracy</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {questions.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-mono text-xs">{q.id.slice(0, 6)}</TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{q.text}</TableCell>
                    <TableCell className="text-right text-sm">{q.attempts.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={q.accuracy >= 80 ? "default" : q.accuracy >= 60 ? "secondary" : "destructive"}>
                        {q.accuracy}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
