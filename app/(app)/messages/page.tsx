import { redirect } from "next/navigation";

/** Old route. Messages are now Notifications (bell on Home, sidebar Account section). */
export default async function MessagesRedirect({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind } = await searchParams;
  redirect(kind ? `/notifications?kind=${encodeURIComponent(kind)}` : "/notifications");
}
