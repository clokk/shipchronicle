import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import DashboardView from "@/components/DashboardView";
import { getCachedCommits } from "@/lib/data/commits";
import DashboardLoading from "./loading";

async function DashboardContent() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null; // Layout will redirect to login
  }

  const userName =
    user.user_metadata?.user_name ||
    user.user_metadata?.preferred_username ||
    user.email?.split("@")[0] ||
    "User";

  const avatarUrl = user.user_metadata?.avatar_url;

  // Fetch commits with server-side caching
  const { commits, projects, totalCount } = await getCachedCommits(user.id);

  return (
    <DashboardView
      commits={commits}
      userName={userName}
      avatarUrl={avatarUrl}
      projects={projects}
      totalCount={totalCount}
    />
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardContent />
    </Suspense>
  );
}
