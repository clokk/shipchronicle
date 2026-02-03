import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { getPublicProfile } from "@cogcommit/supabase/queries";

export const runtime = "nodejs";
export const alt = "CogCommit - User Profile";
export const size = { width: 1200, height: 630 };
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

export default async function OgImage({ params }: Props) {
  const { username } = await params;
  const supabase = await createClient();

  const result = await getPublicProfile(supabase, username);

  if (!result) {
    // Return a generic fallback image
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
          padding: 48,
        }}
      >
        {/* Main card */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            backgroundColor: colors.panel,
            borderRadius: 16,
            border: `1px solid ${colors.border}`,
            overflow: "hidden",
            padding: 48,
          }}
        >
          {/* Profile section */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 24,
            }}
          >
            {/* Avatar */}
            {profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatarUrl}
                alt=""
                width={96}
                height={96}
                style={{ borderRadius: 48 }}
              />
            ) : (
              <div
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 48,
                  backgroundColor: colors.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: colors.primary,
                  fontSize: 40,
                  fontWeight: 600,
                }}
              >
                {profile.username[0]?.toUpperCase() || "U"}
              </div>
            )}

            {/* Username */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div
                style={{
                  fontSize: 48,
                  fontWeight: 700,
                  color: colors.primary,
                }}
              >
                @{profile.username}
              </div>
              <div
                style={{
                  fontSize: 24,
                  color: colors.muted,
                }}
              >
                CogCommit Profile
              </div>
            </div>
          </div>

          {/* Stats */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              gap: 48,
              marginTop: 48,
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "24px 48px",
                backgroundColor: colors.bg,
                borderRadius: 12,
              }}
            >
              <div
                style={{
                  fontSize: 56,
                  fontWeight: 700,
                  color: colors.chronicleGreen,
                }}
              >
                {stats.publicCommitCount}
              </div>
              <div
                style={{
                  fontSize: 20,
                  color: colors.muted,
                  marginTop: 8,
                }}
              >
                Public Commits
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "24px 48px",
                backgroundColor: colors.bg,
                borderRadius: 12,
              }}
            >
              <div
                style={{
                  fontSize: 56,
                  fontWeight: 700,
                  color: colors.chronicleBlue,
                }}
              >
                {stats.totalPrompts}
              </div>
              <div
                style={{
                  fontSize: 20,
                  color: colors.muted,
                  marginTop: 8,
                }}
              >
                Total Prompts
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "flex-end",
            alignItems: "center",
            marginTop: 24,
            paddingRight: 8,
          }}
        >
          <span
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: colors.primary,
            }}
          >
            CogCommit
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
