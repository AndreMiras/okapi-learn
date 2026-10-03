import { LearnerActivityProvider } from "@/components/learner-activity-state";

export default async function LearnerLayout({
  children,
  params,
}: LayoutProps<"/learn/[learnerAlias]">) {
  const { learnerAlias } = await params;
  return (
    <LearnerActivityProvider key={learnerAlias}>
      {children}
    </LearnerActivityProvider>
  );
}
