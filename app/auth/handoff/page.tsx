"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import { Loader2 } from "lucide-react";
import { setAuthSession } from "@/store/slices/authSlice";
import { exchangeLaunchToken } from "@/lib/wa";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function HandoffPage() {
  const router = useRouter();
  const dispatch = useDispatch();
  const [error, setError] = useState("");

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const search = new URLSearchParams(window.location.search);
    const sso = hash.get("sso") || search.get("token") || "";
    const sellerToken = hash.get("token") || "";
    const next = search.get("next") || "/";
    if (!sso) {
      setError("Launch token is missing. Open WhatsApp from the seller dashboard.");
      return;
    }
    let active = true;
    exchangeLaunchToken(sso)
      .then((whatsapp) => {
        if (!active) return;
        dispatch(
          setAuthSession({
            token: sellerToken || `wa:${whatsapp.id}`,
            user: {
              id: whatsapp.id,
              name: whatsapp.name,
              email: whatsapp.email,
              role: whatsapp.role === "admin" ? "admin" : "user",
              whatsapp,
            },
          })
        );
        const safeNext = next.startsWith("/") ? next : "/";
        router.replace(safeNext);
      })
      .catch((launchError: any) => {
        if (!active) return;
        setError(launchError?.message || "Unable to open the WhatsApp workspace");
      });
    return () => {
      active = false;
    };
  }, [dispatch, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Opening WhatsApp workspace</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="space-y-4">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" onClick={() => router.replace("/login")}>
                Go to sign in
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Signing you in with your SellersLogin account
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
