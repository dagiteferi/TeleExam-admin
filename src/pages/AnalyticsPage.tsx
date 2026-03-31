import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import api from "@/lib/api";

const mockDAU = Array.from({ length: 30 }, (_, i) => ({
  date: new Date(Date.now() - (29 - i) * 86400000).toLocaleDateString("en", { month: "short", day: "numeric" }),
  count: Math.floor(Math.random() * 300 + 80),
}));

const mockExams = [
  { subject: "Mathematics", completed: 4521, avg_score: 72 },
  { subject: "Physics", completed: 3812, avg_score: 68 },
  { subject: "Chemistry", completed: 2930, avg_score: 75 },
  { subject: "Biology", completed: 2104, avg_score: 80 },
  { subject: "English", completed: 1876, avg_score: 85 },
];

const mockReferrals = [
  { username: "@ahmed_top", invites: 142 },
  { username: "@sara_study", invites: 98 },
  { username: "@mohamed_k", invites: 87 },
  { username: "@fatma_ai", invites: 65 },
  { username: "@ali_exam", invites: 51 },
];

const mockQuestions = [
  { id: 1, text: "What is the derivative of x²?", attempts: 8321, accuracy: 89 },
  { id: 2, text: "Newton's second law states...", attempts: 7654, accuracy: 72 },
  { id: 3, text: "The pH of pure water is...", attempts: 6190, accuracy: 94 },
  { id: 4, text: "Mitochondria is known as...", attempts: 5832, accuracy: 97 },
  { id: 5, text: "Select the correct passive voice...", attempts: 4210, accuracy: 61 },
];

export default function AnalyticsPage() {
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
                <AreaChart data={mockDAU}>
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
                <BarChart data={mockExams}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="subject" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)", fontSize: 12 }} />
                  <Bar dataKey="completed" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
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
              {mockReferrals.map((r, i) => (
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
                {mockQuestions.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-mono text-xs">{q.id}</TableCell>
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
