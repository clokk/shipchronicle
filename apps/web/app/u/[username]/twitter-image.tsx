import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { getPublicProfile } from "@cogcommit/supabase/queries";

export const runtime = "nodejs";
export const alt = "CogCommit - User Profile";
export const size = { width: 1200, height: 600 };
export const contentType = "image/png";

// Design system colors
const colors = {
  bg: "#0d0b0a",
  panel: "#181614",
  primary: "#e8e4df",
  muted: "#a39e97",
  subtle: "#6b6660",
  border: "#2a2725",
  chronicleGreen: "#5fb88e",
  chronicleAmber: "#d4a030",
  chroniclePurple: "#9d7cd8",
  chronicleBlue: "#7aa2f7",
};

interface Props {
  params: Promise<{ username: string }>;
}

export default async function TwitterImage({ params }: Props) {
  const { username } = await params;
  const supabase = await createClient();

  const result = await getPublicProfile(supabase, username);

  if (!result) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.bg,
          }}
        >
          <div style={{ color: colors.muted, fontSize: 32 }}>
            User not found
          </div>
        </div>
      ),
      { ...size }
    );
  }

  const { profile, stats } = result;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: colors.bg,
          padding: 40,
        }}
      >
        {/* Main card */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.panel,
            borderRadius: 16,
            border: `1px solid ${colors.border}`,
            padding: 40,
            gap: 40,
          }}
        >
          {/* Avatar */}
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatarUrl}
              alt=""
              width={120}
              height={120}
              style={{ borderRadius: 60 }}
            />
          ) : (
            <div
              style={{
                width: 120,
                height: 120,
                borderRadius: 60,
                backgroundColor: colors.bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: colors.primary,
                fontSize: 48,
                fontWeight: 600,
              }}
            >
              {profile.username[0]?.toUpperCase() || "U"}
            </div>
          )}

          {/* Info */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
            }}
          >
            <div
              style={{
                fontSize: 44,
                fontWeight: 700,
                color: colors.primary,
              }}
            >
              @{profile.username}
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                gap: 24,
                marginTop: 16,
                fontSize: 24,
                color: colors.muted,
              }}
            >
              <span style={{ color: colors.chronicleGreen }}>
                {stats.publicCommitCount} commits
              </span>
              <span style={{ color: colors.subtle }}>·</span>
              <span>{stats.totalPrompts} prompts</span>
            </div>
          </div>

          {/* Branding */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
            }}
          >
            <span
              style={{
                fontSize: 32,
                fontWeight: 700,
                color: colors.primary,
              }}
            >
              CogCommit
            </span>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
