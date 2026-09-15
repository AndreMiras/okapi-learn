import { VideoGameRevealProvider } from "@/components/video-game-reveal";

export default async function LearnerLayout({
  children,
  params,
}: LayoutProps<"/learn/[learnerAlias]">) {
  const { learnerAlias } = await params;
  return (
    <VideoGameRevealProvider key={learnerAlias}>
      {children}
    </VideoGameRevealProvider>
  );
}
