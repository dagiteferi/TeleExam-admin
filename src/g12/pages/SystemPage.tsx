import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { g12Api } from "../api";
import { Loading, PageHeader, StatusBadge, useLoad } from "../components/kit";

interface Health {
  status: string;
  version: string;
  env: string;
  db: { status: string; ms?: number };
  redis: { status: string; ms?: number };
  storage: { status: string };
  workers: Record<string, { status: string; last_success_s_ago: number | null }>;
  queues: Record<string, number | string | null>;
  ai_models: { model: string; status: string }[];
}

const ago = (s: number | null) => (s === null ? "never" : s < 120 ? `${s} s ago` : `${Math.round(s / 60)} min ago`);

export default function G12SystemPage() {
  const { data, loading, reload } = useLoad(async () => (await g12Api.get<Health>("/system/health")).data);
  if (loading || !data) return <Loading />;
  return (
    <>
      <PageHeader title="System" description={`Backend ${data.version} · ${data.env}`}
                  actions={<Button variant="outline" onClick={reload}><RefreshCw className="h-4 w-4 mr-1" />Refresh</Button>} />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card><CardHeader><CardTitle className="text-base">Services</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="flex justify-between">Overall <StatusBadge value={data.status} /></p>
            <p className="flex justify-between">Database {data.db.ms ? `(${data.db.ms} ms)` : ""} <StatusBadge value={data.db.status} /></p>
            <p className="flex justify-between">Redis {data.redis.ms ? `(${data.redis.ms} ms)` : ""} <StatusBadge value={data.redis.status} /></p>
            <p className="flex justify-between">File storage <StatusBadge value={data.storage.status} /></p>
          </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Background jobs</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {Object.entries(data.workers).map(([name, w]) => (
              <p key={name} className="flex justify-between capitalize">{name} <span className="text-muted-foreground">{ago(w.last_success_s_ago)}</span></p>
            ))}
          </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Queues</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {Object.entries(data.queues).map(([name, value]) => (
              <p key={name} className="flex justify-between">{name.replace(/_/g, " ")} <span>{value ?? "—"}</span></p>
            ))}
          </CardContent></Card>
      </div>
    </>
  );
}
