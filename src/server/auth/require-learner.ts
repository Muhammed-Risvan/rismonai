import { createSupabaseServerClient } from "@/lib/supabase/server";
import { UnauthenticatedError } from "@/server/errors";

export type LearnerSession = {
  learnerId: string;
  email: string;
};

/**
 * Verifies the session with Supabase Auth server-side (auth.getUser()), the
 * server-confirmed method recommended by current Supabase docs. getSession()
 * data is NEVER used for authorization.
 *
 * The learnerId returned here is the ONLY source of learner identity in the
 * app: it comes from the verified session, never from request bodies, query
 * strings or headers.
 *
 * @throws UnauthenticatedError when there is no valid session.
 */
export async function requireLearner(): Promise<LearnerSession> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new UnauthenticatedError();
  }

  return {
    learnerId: data.user.id,
    email: data.user.email ?? "",
  };
}