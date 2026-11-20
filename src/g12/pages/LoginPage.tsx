import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { GraduationCap, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage } from "../api";
import { useG12Auth } from "../auth";

export default function G12LoginPage() {
  const { admin, login } = useG12Auth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const target = (location.state as { from?: string } | null)?.from ?? "/12";

  if (admin) return <Navigate to={target} replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await login(email.trim(), password);
      navigate(target, { replace: true });
    } catch (err) {
      toast.error(errorMessage(err, "Wrong email or password."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md animate-fade-in">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
            <GraduationCap className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">TeleExam 12</CardTitle>
            <CardDescription>Sign in to the Grade 12 admin panel</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="g12-email">Email</Label>
              <Input id="g12-email" type="email" autoComplete="username" required value={email}
                     onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="g12-password">Password</Label>
              <Input id="g12-password" type="password" autoComplete="current-password" required value={password}
                     onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign in
            </Button>
          </form>
          <p className="text-xs text-muted-foreground text-center mt-6">
            Looking for the exit exam panel? <Link to="/" className="underline">Go back</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
