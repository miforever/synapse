import { redirect } from "next/navigation";

/**
 * The root is not a view of its own.
 *
 * Every view is a route with a mode in it, so landing here means picking one:
 * the graph in space, which is what the canvas is for.
 */
export default function Home() {
  redirect("/canvas/3d");
}
