import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Bot, Loader2 } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { clearToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

const loginSchema = z.object({
  email: z.string().email("Invalid email address").max(255),
  password: z.string().min(1, "Password is required").max(128),
});

type LoginForm = z.infer<typeof loginSchema>;

function toErrorMessage(err: any): string {
  const data = err?.response?.data;
  const detail = data?.detail;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object") {
    try {
      return JSON.stringify(detail);
    } catch {
      return "Login failed.";
    }
  }
  if (typeof data?.error === "string") return data.error;
  if (typeof err?.message === "string") return err.message;
  return "Login failed. Please check your credentials.";
}

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("username", data.email);
      params.append("password", data.password);

      const response = await api.post("/admin/auth/login", params, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      login(response.data.access_token);
      toast.success("Welcome back!");
      navigate("/");
    } catch (err: any) {
      // ensure we don't keep any stale/invalid token around
      clearToken();
      toast.error(toErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md animate-fade-in">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
            <Bot className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">TeleExam AI</CardTitle>
            <CardDescription>Sign in to the admin panel</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                {...register("email")}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                {...register("password")}
              />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign In
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
