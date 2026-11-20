import { useState } from "react";
import { Copy, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { g12Api } from "../api";
import { Empty, Loading, PageHeader, run, useLoad, when } from "../components/kit";

interface Promo {
  id: string;
  code: string;
  welcome_message: string;
  click_count: number;
  students: number;
  active_students: number;
  is_active: boolean;
  created_at: string;
}

const BOT = import.meta.env.VITE_G12_BOT_USERNAME || "TeleExamAi12_bot";
const link = (code: string) => `https://t.me/${BOT}?start=promo_${code}`;

export default function G12PromoPage() {
  const { data, loading, reload } = useLoad(async () => (await g12Api.get<Promo[]>("/promo-links")).data);
  const [code, setCode] = useState("");
  const [welcome, setWelcome] = useState("");
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);

  const create = async () => {
    if (await run(() => g12Api.post("/promo-links", { code, welcome_message: welcome }), "Promo link created.")) {
      setCode("");
      setWelcome("");
      reload();
    }
  };
  const update = async (id: string, body: object, message: string) => {
    if (await run(() => g12Api.patch(`/promo-links/${id}`, body), message)) {
      setEditing(null);
      reload();
    }
  };

  return (
    <>
      <PageHeader title="Promo Links" description="Links for campaigns. Each link counts clicks and shows its own welcome message." />
      <Card className="mb-6">
        <CardHeader><CardTitle className="text-base">New promo link</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[220px_1fr_auto] items-end">
          <div className="space-y-1"><Label>Code</Label><Input placeholder="AAU_2027" value={code} onChange={(e) => setCode(e.target.value)} /></div>
          <div className="space-y-1"><Label>Welcome message</Label><Input value={welcome} onChange={(e) => setWelcome(e.target.value)}
            placeholder="Welcome! You joined through our campus campaign." /></div>
          <Button disabled={code.length < 3 || welcome.length < 3} onClick={create}><Plus className="h-4 w-4 mr-1" />Create</Button>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          {loading ? <Loading /> : !data?.length ? <Empty text="No promo links yet." /> : (
            <Table>
              <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Welcome message</TableHead><TableHead>Clicks</TableHead>
                <TableHead>Students</TableHead><TableHead>Created</TableHead><TableHead>Active</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {data.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono">{p.code}</TableCell>
                    <TableCell className="max-w-sm">
                      {editing?.id === p.id ? (
                        <div className="space-y-2">
                          <Textarea rows={2} value={editing.text} onChange={(e) => setEditing({ id: p.id, text: e.target.value })} />
                          <div className="space-x-2"><Button size="sm" onClick={() => update(p.id, { welcome_message: editing.text }, "Saved.")}>Save</Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button></div>
                        </div>
                      ) : <button className="text-left hover:underline" onClick={() => setEditing({ id: p.id, text: p.welcome_message })}>{p.welcome_message}</button>}
                    </TableCell>
                    <TableCell>{p.click_count}</TableCell>
                    <TableCell>{p.active_students} / {p.students}</TableCell>
                    <TableCell>{when(p.created_at)}</TableCell>
                    <TableCell><Switch checked={p.is_active} onCheckedChange={(is_active) => update(p.id, { is_active }, is_active ? "Link turned on." : "Link turned off.")} /></TableCell>
                    <TableCell><Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(link(p.code)); toast.success("Link copied."); }}>
                      <Copy className="h-3 w-3 mr-1" />Copy link</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground mt-2">Students: chose a stream / started the bot. Links look like {link("CODE")}.</p>
    </>
  );
}
