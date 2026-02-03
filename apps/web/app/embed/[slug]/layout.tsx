import type { Metadata } from "next";
import "../../globals.css";

export const metadata: Metadata = {
  title: "CogCommit Embed",
  robots: {
    index: false,
    follow: false,
  },
};

export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Minimal layout for embeds - no header/footer, just the content
  return <>{children}</>;
}
