import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import QueryProvider from "@/components/providers/QueryProvider";
import DashboardLoading from "./dashboard/loading";

async function AuthCheck({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <>{children}</>;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryProvider>
      <Suspense fallback={<DashboardLoading />}>
        <AuthCheck>{children}</AuthCheck>
      </Suspense>
    </QueryProvider>
  );
}
