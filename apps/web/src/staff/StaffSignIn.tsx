import type { SupabaseClient } from '@supabase/supabase-js';

import CredentialSignIn from './CredentialSignIn';

type StaffSignInProps = {
  accessNotice: string;
  client: SupabaseClient;
  onGoogle: () => Promise<string | undefined>;
  onDiscord: () => Promise<string | undefined>;
  onBack: () => void;
};

/** Sign-in for both staff dashboards; roles determine the workspace after authentication. */
export default function StaffSignIn({ accessNotice, client, onGoogle, onDiscord, onBack }: StaffSignInProps) {
  return <CredentialSignIn
    client={client}
    heading="Staff sign in"
    description="Administrators and facilitators are directed to the workspace their account allows."
    accessNotice={accessNotice}
    onGoogle={onGoogle}
    onDiscord={onDiscord}
    onBack={onBack}
  />;
}
