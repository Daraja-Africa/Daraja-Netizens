import AppFooter from '../layout/AppFooter';
import { handleLinkClick, type LegalPage } from '../router';

const lastUpdated = '18 November 2026';

/**
 * The two public documents Discord requires before it will verify an
 * application: /terms and /privacy. They render without a portal choice, a
 * session or an API call, so a reviewer can open them cold.
 */
export default function LegalPage({ page }: { page: LegalPage }) {
  const other: LegalPage = page === 'terms' ? 'privacy' : 'terms';
  return (
    <main className="legal-shell">
      <div className="legal-inner">
        <header className="legal-header">
          <img className="brand-badge" src="/daraja-logo.png" alt="" />
          <div>
            <p className="eyebrow">Daraja Netizens</p>
            <h1>{page === 'terms' ? 'Terms of Service' : 'Privacy Policy'}</h1>
            <p className="legal-meta">Last updated {lastUpdated}</p>
          </div>
        </header>

        <article className="legal-card legal-doc">
          {page === 'terms' ? <Terms /> : <Privacy />}
        </article>

        <nav className="legal-nav" aria-label="Legal documents">
          <a href="/" onClick={(event) => handleLinkClick(event, '/')}>← Back to the portal</a>
          <a href={`/${other}`} onClick={(event) => handleLinkClick(event, `/${other}`)}>
            {other === 'terms' ? 'Terms of Service' : 'Privacy Policy'}
          </a>
        </nav>

        <AppFooter />
      </div>
    </main>
  );
}

function Terms() {
  return (
    <>
      <p>
        Daraja Netizens is a youth wellbeing and digital-skills programme. These terms cover the Daraja Netizens web
        portal, the facilitator workspace, the Student Portal and the Daraja Discord community. By using any of them you
        agree to what is written here.
      </p>

      <h2>Who we are</h2>
      <p>
        Daraja Netizens (&ldquo;Daraja&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) runs training sessions, attendance
        tracking, learning resources and confidential wellbeing support for young people. The programme team can be
        reached through the confidential reach-out form in the Student Portal.
      </p>

      <h2>Using the portal</h2>
      <ul>
        <li>Use the portal for the programme it is built for: learning, attending sessions, and asking for support.</li>
        <li>Do not attempt to access accounts, data or facilitator screens that are not yours.</li>
        <li>Do not upload malware, scrape the portal, or interfere with its availability.</li>
        <li>Do not impersonate another person when you submit a reach-out note or sign in.</li>
        <li>
          Treat everyone with respect in Jitsi sessions and in the Daraja Discord community: no harassment, hate speech,
          spam or unwanted messages.
        </li>
      </ul>

      <h2>Accounts and sign-in</h2>
      <p>
        Facilitators and administrators sign in with Google or Discord. Signing in only proves which email address you
        control: the facilitator and admin workspace is limited to the people already on the Daraja roster, and any
        other account is refused access. Students do not need an account to read the learning hub or to reach out for
        support.
      </p>
      <p>
        You are responsible for keeping your own Google or Discord account secure. Tell us straight away if you think
        somebody else has used your Daraja access.
      </p>

      <h2>Confidential reach-out is not an emergency service</h2>
      <p>
        The reach-out form connects you to a trained Daraja supporter, who aims to make first contact within the response
        window you choose. It is not monitored around the clock and it is not a crisis line. If you are in immediate
        danger, call <a href="tel:999">999</a> or one of the helplines listed on the reach-out page now.
      </p>
      <p>
        Our guides, peer facilitation and facilitator training are educational and supportive. They do not replace
        assessment, diagnosis or treatment by a qualified medical or mental-health professional, and no facilitator
        acts as your clinician. In an immediate crisis, contact your local emergency services or the nearest hospital
        before anything else.
      </p>

      <h2>The Daraja Discord community</h2>
      <p>
        Our Discord server is an optional space for students and facilitators between sessions. By joining you agree to
        follow the server rules, to treat other members with respect, and to accept that moderators may remove messages
        or members that break those rules. What you write in Discord is hosted by Discord under their own terms; our{' '}
        <a href="/privacy" onClick={(event) => handleLinkClick(event, '/privacy')}>Privacy Policy</a> explains what we
        receive when you use Discord to sign in.
      </p>

      <h2>Intellectual property</h2>
      <p>
        The learning guides, session plans and programme materials on the portal belong to Daraja Netizens, the Daraja
        Africa Network and their contributors. You may read, download and share them for personal learning and
        non-commercial awareness work. Please do not resell them, present them as your own, or remove the Daraja
        attribution they carry.
      </p>

      <h2>Availability and changes</h2>
      <p>
        The portal is provided as it is. We may change, pause or withdraw any part of it &mdash; for example during
        maintenance, when a training cohort ends, or when a security issue needs fixing. We also update these terms from
        time to time; the date at the top of this page shows the current version, and continuing to use the portal means
        you accept it.
      </p>

      <h2>Ending access</h2>
      <p>
        We may suspend facilitator or admin access if an account is used in a way that puts students, staff or the
        programme at risk. You can stop using the portal at any time, and you can ask us to delete your data (see the{' '}
        <a href="/privacy" onClick={(event) => handleLinkClick(event, '/privacy')}>Privacy Policy</a>).
      </p>

      <h2>Limits of liability</h2>
      <p>
        We work hard to keep the portal accurate and available, but we cannot promise it will always be uninterrupted or
        error-free. To the extent the law allows, Daraja Netizens is not liable for indirect or consequential loss
        arising from your use of the portal. Nothing in these terms limits your rights under Kenyan law, including your
        rights under the Data Protection Act, 2019.
      </p>

      <h2>Questions</h2>
      <p>
        If anything here is unclear, send a note through the{' '}
        <a href="/student/reach-out" onClick={(event) => handleLinkClick(event, '/student/reach-out')}>
          Student Portal reach-out page
        </a>{' '}
        or speak to any Daraja facilitator. This document is governed by the laws of Kenya.
      </p>
    </>
  );
}

function Privacy() {
  return (
    <>
      <p>
        This policy explains what Daraja Netizens collects when you use the portal or sign in with Google or Discord, why
        we collect it, how it is protected, and how you can ask us to delete it. It covers the web portal, the facilitator
        workspace, the Student Portal and our Discord server invite.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Sign-in details.</strong> If you sign in with Google or Discord we receive the email address, display
          name and account identifier that the provider shares. With Discord that means your Discord user ID, username and
          email address &mdash; nothing more.
        </li>
        <li>
          <strong>Programme records.</strong> Attendance, session participation and training or stipend eligibility for
          students on the Daraja roster.
        </li>
        <li>
          <strong>Reach-out notes.</strong> The name or nickname you choose to give (it is optional), the contact method
          and contact detail you want us to use, the support topic, the urgency you select, your message, and the
          reference we return to you.
        </li>
        <li>
          <strong>Technical logs.</strong> A random request id, the request method and path, the response status and how
          long it took, so we can investigate failures. Reach-out submissions are rate limited per contact detail.
        </li>
      </ul>

      <h2>What we do not collect from Discord</h2>
      <p>
        Joining our Discord server or signing in with Discord gives us only the basic profile Discord chooses to share.
        We never read your direct messages, your friend list, your other servers, your voice calls, or messages in any
        channel we do not moderate. We do not buy, sell or enrich data about you from third parties, and the portal sets
        no advertising or analytics trackers.
      </p>

      <h2>Why we process it</h2>
      <ul>
        <li>To sign you in and keep the facilitator workspace limited to approved staff.</li>
        <li>To record attendance and calculate training and stipend eligibility for programme reporting.</li>
        <li>To let a trained supporter respond to a student who has asked for help, within the urgency they chose.</li>
        <li>To keep the service secure, investigate errors and meet our safeguarding and reporting duties.</li>
      </ul>

      <h2>How it is protected</h2>
      <ul>
        <li>
          The database runs on Supabase PostgreSQL with deny-by-default row-level security: a request without an
          authorised identity reads nothing.
        </li>
        <li>
          Privileged database keys and the Discord alert webhook are kept server-side on the API only. They are never
          shipped to the browser, and the web app never receives them.
        </li>
        <li>
          Confidential reach-out notes are readable only by the wellness team inside the audited facilitator inbox. Every
          note that is opened or updated is recorded in an access log, and the alert that reaches Discord carries the
          reference, topic, urgency, preferred channel and time &mdash; never the student&rsquo;s words, name or contact
          detail.
        </li>
        <li>
          Discord webhooks we receive are verified against Discord&rsquo;s Ed25519 signature, and traffic is encrypted in
          transit (HTTPS) between your browser, Vercel, Render and Supabase.
        </li>
      </ul>

      <h2>How long we keep it</h2>
      <p>
        Attendance and eligibility records are kept for as long as the programme needs them to report on a cohort.
        Reach-out notes are kept while the request is open and for a limited period afterwards so we can follow up
        safely. Technical logs are short-lived. Older records are deleted when they are no longer needed.
      </p>

      <h2>Who we share it with</h2>
      <p>
        We do not sell your data and we do not share it for advertising. We use service providers that host the portal
        and its database (Vercel, Render, Supabase), and Discord is involved only when you choose to sign in with Discord
        or join the community server. Where a safeguarding concern means a young person may be at risk, we may share the
        minimum necessary information with the appropriate authority, as required by law.
      </p>

      <h2>Access, correction and deletion</h2>
      <p>
        You can ask us what we hold about you, ask us to correct it, or ask us to delete it. Send a request through the{' '}
        <a href="/student/reach-out" onClick={(event) => handleLinkClick(event, '/student/reach-out')}>
          Student Portal reach-out form
        </a>{' '}
        (choose <em>email</em> as the contact method and say what you want us to do), or tell any Daraja facilitator. We
        will confirm the request belongs to you before acting, and we aim to complete it within 30 days. If we must keep
        a specific record for a legal or safeguarding reason, we will tell you which record and why.
      </p>
      <p>
        Signing out of the portal does not delete your data. Removing the Daraja app from your Discord account stops
        future sign-ins through Discord but leaves any records already created.
      </p>

      <h2>Young people</h2>
      <p>
        Most people who use Daraja Netizens are young people. We collect as little as we can, keep the reach-out form
        usable without an account or a real name, and only let trained supporters read a confidential note.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        If we change how we handle data we will update this page and the date at the top. This policy is provided under
        the Data Protection Act, 2019 (Kenya). Questions about it can go through the reach-out form above.
      </p>
    </>
  );
}
