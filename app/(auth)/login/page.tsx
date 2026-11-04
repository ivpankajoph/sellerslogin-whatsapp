"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import axios from "axios";
import { Eye, EyeOff, Lock, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useDispatch } from "react-redux";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setAuthSession } from "@/store/slices/authSlice";
import { exchangeLaunchToken } from "@/lib/wa";

export default function LoginPage() {
  const router = useRouter();
  const dispatch = useDispatch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    try {
      const baseUrl = String(process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
      const response = await axios.post(`${baseUrl}/v1/auth/login`, { email, password });
      if (!response.data?.success || !response.data?.token) {
        throw new Error(response.data?.message || "Invalid credentials");
      }
      const token = response.data.token as string;
      const seller = response.data.data || {};
      const role = String(seller.role || "").toLowerCase();
      const launchPath = role === "admin" || role === "superadmin" ? "/v1/admin/marketing/launch" : "/v1/vendor/marketing/launch";
      const launch = await axios.get(`${baseUrl}${launchPath}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const launchUrl = String(launch.data?.launchUrl || "");
      const sso = new URL(launchUrl, window.location.origin).searchParams.get("token") || "";
      if (!sso) throw new Error("WhatsApp launch token was not returned");
      const whatsapp = await exchangeLaunchToken(sso);
      dispatch(setAuthSession({ token, user: { ...seller, whatsapp } }));
      toast.success(`Welcome, ${whatsapp.name || seller.name || "there"}`);
      router.replace("/");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || "Unable to sign in");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center space-y-2 text-center">
          <Image src="/logo-mark-v5.svg" alt="SellersLogin WhatsApp" width={56} height={56} priority className="size-14" />
          <h1 className="text-2xl font-extrabold tracking-tight">SellersLogin WhatsApp</h1>
          <p className="text-sm text-muted-foreground">Sign in with your SellersLogin seller or admin account</p>
        </div>
        <Card className="border-border/80 shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Sign in</CardTitle>
              <Badge variant="outline" className="gap-1">
                <ShieldCheck className="size-3" />
                Secure
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Email address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="pl-9" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="pl-9 pr-10" />
                  <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Signing in..." : "Open WhatsApp workspace"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
