import { redirect } from "next/navigation";

/**
 * Health insights (articles + workout videos) is cut for now (v3). What was useful, patterns
 * from the user's own logs, now lives in the AI overview on My progress. Old links land there.
 */
export default function InsightsRedirect() {
  redirect("/progress");
}
