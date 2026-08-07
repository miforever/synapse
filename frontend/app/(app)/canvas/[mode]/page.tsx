import { notFound } from "next/navigation";

import { CanvasView } from "@/components/CanvasView";

/** The graph, drawn flat or in space. Both are the canvas. */
export function generateStaticParams() {
  return [{ mode: "2d" }, { mode: "3d" }];
}

export default async function CanvasPage({
  params,
}: {
  params: Promise<{ mode: string }>;
}) {
  const { mode } = await params;
  // Anything else is not a way of drawing the graph, so it is not a page.
  if (mode !== "2d" && mode !== "3d") notFound();

  return <CanvasView mode={mode} />;
}
