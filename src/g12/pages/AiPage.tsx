import { useState } from "react";
import { ArrowDown, ArrowUp, Check, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { g12Api } from "../api";
import { useG12Auth } from "../auth";
import { Empty, Loading, PageHeader, StatusBadge, run, useLoad, when } from "../components/kit";

interface Model {
  id: string;
  provider: string;
  model: string;
  key_alias: string;
  priority: number;
  enabled: boolean;
  pro_only: boolean;
  status?: string;
  back_in_s?: number | null;
}

interface Usage {
  day: string;
  provider: string;
  model: string;
  feature: string;
  result: string;
  calls: number;
  tokens_in: number;
  tokens_out: number;
  avg_ms: number | null;
}

interface Explanation {
  id: string;
  code: string;
  status: string;
  body: string;
  provider: string | null;
  model: string | null;
  created_at: string;
}

const FEATURES: [string, string, string][] = [
  ["explain", "ai.enabled.explain", "Ask AI Tutor (explanations)"],
  ["chat", "ai.enabled.chat", "Follow-up chat"],
  ["study_plan", "ai.enabled.study_plan", "AI study plan"],
];

function Models() {
  const { can } = useG12Auth();
  const owner = can("owner");
  const { data, loading, reload, setData } = useLoad(async () => (await g12Api.get<Model[]>("/ai/models")).data);
  const [form, setForm] = useState({ provider: "groq", model: "", key_alias: "GROQ_KEY_1" });

  const move = async (index: number, step: number) => {
    if (!data) return;
    const order = [...data];
    [order[index], order[index + step]] = [order[index + step], order[index]];
    setData(order);
    if (!(await run(() => g12Api.put("/ai/models/order", order.map((m) => m.id)), "Order saved."))) reload();
  };
  const patch = async (model: Model, body: object) => {
    if (await run(() => g12Api.patch(`/ai/models/${model.id}`, body), "Saved.")) reload();
  };
  const add = async () => {
    if (await run(() => g12Api.post("/ai/models", form), "Model added at the end of the list.")) {
      setForm({ ...form, model: "" });
      reload();
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Models, tried from top to bottom</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {loading ? <Loading /> : !data?.length ? <Empty text="No models yet. The AI Tutor answers 'busy' until one is added." /> : (
          <Table>
            <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Provider</TableHead><TableHead>Model</TableHead>
              <TableHead>Key name</TableHead><TableHead>Status</TableHead><TableHead>On</TableHead><TableHead>PRO only</TableHead>
              {owner && <TableHead>Order</TableHead>}</TableRow></TableHeader>
            <TableBody>
              {data.map((m, i) => (
                <TableRow key={m.id}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell className="capitalize">{m.provider}</TableCell>
                  <TableCell className="font-mono text-xs">{m.model}</TableCell>
                  <TableCell className="font-mono text-xs">{m.key_alias}</TableCell>
                  <TableCell><StatusBadge value={m.status} />{m.back_in_s ? <span className="text-xs text-muted-foreground ml-1">back in {Math.ceil(m.back_in_s / 60)} min</span> : null}</TableCell>
                  <TableCell><Switch disabled={!owner} checked={m.enabled} onCheckedChange={(enabled) => patch(m, { enabled })} /></TableCell>
                  <TableCell><Switch disabled={!owner} checked={m.pro_only} onCheckedChange={(pro_only) => patch(m, { pro_only })} /></TableCell>
                  {owner && <TableCell className="space-x-1 whitespace-nowrap">
                    <Button size="icon" variant="ghost" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" disabled={i === data.length - 1} onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
                  </TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <p className="text-xs text-muted-foreground">"missing key" means the key name is not set as a secret on the server. Keys are never shown here.</p>
        {owner && (
          <div className="grid gap-2 md:grid-cols-[140px_1fr_200px_auto] items-end border-t pt-4">
            <div className="space-y-1"><Label>Provider</Label>
              <Select value={form.provider} onValueChange={(provider) => setForm({ ...form, provider, key_alias: provider === "groq" ? "GROQ_KEY_1" : "GEMINI_KEY_1" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="groq">Groq</SelectItem><SelectItem value="gemini">Gemini</SelectItem></SelectContent>
              </Select></div>
            <div className="space-y-1"><Label>Model name</Label><Input placeholder="openai/gpt-oss-120b" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></div>
            <div className="space-y-1"><Label>Key name</Label><Input value={form.key_alias} onChange={(e) => setForm({ ...form, key_alias: e.target.value.toUpperCase() })} /></div>
            <Button disabled={form.model.length < 2} onClick={add}><Plus className="h-4 w-4 mr-1" />Add</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Switches() {
  const { data, loading, reload } = useLoad(async () => {
    const settings = (await g12Api.get<{ settings: { key: string; value: unknown }[] }>("/settings")).data.settings;
    return Object.fromEntries(settings.map((s) => [s.key, s.value]));
  });
  const toggle = async (feature: string, enabled: boolean) => {
    if (await run(() => g12Api.post("/ai/kill-switch", { feature, enabled }), enabled ? "Turned on." : "Turned off for everyone.")) reload();
  };
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">AI features</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {loading || !data ? <Loading /> : FEATURES.map(([feature, key, label]) => (
          <div key={feature} className="flex items-center justify-between">
            <span className="text-sm">{label}</span>
            <Switch checked={Boolean(data[key])} onCheckedChange={(enabled) => toggle(feature, enabled)} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function UsageTable() {
  const [days, setDays] = useState("7");
  const { data, loading } = useLoad(async () => (await g12Api.get<Usage[]>("/ai/usage", { params: { days } })).data, [days]);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Usage</CardTitle>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="1">Today</SelectItem><SelectItem value="7">7 days</SelectItem><SelectItem value="30">30 days</SelectItem></SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? <Loading /> : !data?.length ? <Empty text="No AI calls in this period." /> : (
          <Table>
            <TableHeader><TableRow><TableHead>Day</TableHead><TableHead>Model</TableHead><TableHead>Feature</TableHead>
              <TableHead>Result</TableHead><TableHead>Calls</TableHead><TableHead>Tokens in/out</TableHead><TableHead>Avg time</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.map((u, i) => (
                <TableRow key={i}>
                  <TableCell>{u.day}</TableCell><TableCell className="font-mono text-xs">{u.model}</TableCell>
                  <TableCell>{u.feature}</TableCell><TableCell><StatusBadge value={u.result} /></TableCell>
                  <TableCell>{u.calls}</TableCell><TableCell>{u.tokens_in} / {u.tokens_out}</TableCell>
                  <TableCell>{u.avg_ms ? `${(u.avg_ms / 1000).toFixed(1)} s` : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function Explanations() {
  const [status, setStatus] = useState("reported");
  const { data, loading, reload } = useLoad(async () =>
    (await g12Api.get<Explanation[]>("/ai/explanations", { params: { status, limit: 50 } })).data, [status]);
  const decide = async (id: string, action: "approve" | "reject") => {
    if (await run(() => g12Api.post(`/ai/explanations/${id}/${action}`), action === "approve" ? "Approved." : "Rejected and hidden.")) reload();
  };
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Saved AI explanations</CardTitle>
        <Tabs value={status} onValueChange={setStatus}>
          <TabsList><TabsTrigger value="reported">Reported</TabsTrigger><TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger><TabsTrigger value="rejected">Rejected</TabsTrigger></TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? <Loading /> : !data?.length ? <Empty text={`No ${status} explanations.`} /> : data.map((e) => (
          <div key={e.id} className="border rounded-md p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono text-foreground">{e.code}</span><StatusBadge value={e.status} />
              <span>{e.model ?? ""}</span><span>{when(e.created_at)}</span>
            </div>
            <p className="text-sm whitespace-pre-wrap">{e.body}</p>
            {(e.status === "pending" || e.status === "reported") && (
              <div className="space-x-2">
                <Button size="sm" onClick={() => decide(e.id, "approve")}><Check className="h-3 w-3 mr-1" />Approve</Button>
                <Button size="sm" variant="destructive" onClick={() => decide(e.id, "reject")}><X className="h-3 w-3 mr-1" />Reject</Button>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function G12AiPage() {
  return (
    <>
      <PageHeader title="AI Tutor" description="Which models answer, in which order, and what students are told." />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Models />
        <Switches />
      </div>
      <div className="grid gap-6 mt-6">
        <UsageTable />
        <Explanations />
      </div>
    </>
  );
}
