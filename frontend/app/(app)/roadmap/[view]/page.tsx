import { notFound } from "next/navigation";

import { RoadmapView } from "@/components/RoadmapView";

/** The work, as an order or as a board. Both are the roadmap. */
export function generateStaticParams() {
  return [{ view: "path" }, { view: "board" }];
}

export default async function RoadmapPage({
  params,
}: {
  params: Promise<{ view: string }>;
}) {
  const { view } = await params;
  if (view !== "path" && view !== "board") notFound();

  return <RoadmapView view={view} />;
}
