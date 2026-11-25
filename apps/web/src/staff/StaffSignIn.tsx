import type { SupabaseClient } from '@supabase/supabase-js';

import CredentialSignIn from './CredentialSignIn';

type StaffSignInProps = {
  accessNotice: string;
  client: SupabaseClient;
  onBack: () => void;
};

/** Sign-in for both staff dashboards; roles determine the workspace after authentication. */
export default function StaffSignIn({ accessNotice, client, onBack }: StaffSignInProps) {
  return <CredentialSignIn
    client={client}
    heading="Staff sign in"
    description="Administrators and facilitators are directed to the workspace their account allows."
    accessNotice={accessNotice}
    onBack={onBack}
  />;
}
