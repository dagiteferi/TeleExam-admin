import { useEffect, useState } from "react";
import { Users, FileText, Activity, Ban } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import api from "@/lib/api";

interface DashboardStats {
  total_users: number;
  total_exams: number;
  dau: number;
  banned_users: number;
}

const mockChart = Array.from({ length: 14 }, (_, i) => ({
  date: new Date(Date.now() - (13 - i) * 86400000).toLocaleDateString("en", { month: "short", day: "numeric" }),
  users: Math.floor(Math.random() * 200 + 100),
}));

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/admin/stats/overview")
      .then((r) => setStats(r.data))
      .catch(() => {
        // Fallback mock data for demo
        setStats({ total_users: 12453, total_exams: 87621, dau: 1843, banned_users: 67 });
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6 h-28" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Overview of your platform</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Users" value={stats?.total_users?.toLocaleString() ?? "—"} icon={<Users className="h-4 w-4" />} description="+12% from last month" />
        <StatCard title="Total Exams" value={stats?.total_exams?.toLocaleString() ?? "—"} icon={<FileText className="h-4 w-4" />} description="All time" />
        <StatCard title="Daily Active Users" value={stats?.dau?.toLocaleString() ?? "—"} icon={<Activity className="h-4 w-4" />} description="Today" />
        <StatCard title="Banned Users" value={stats?.banned_users?.toLocaleString() ?? "—"} icon={<Ban className="h-4 w-4" />} description="Currently banned" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">User Activity (14 days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockChart}>
                <defs>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "var(--radius)",
                    fontSize: 12,
                  }}
                />
                <Area type="monotone" dataKey="users" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorUsers)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
