/**
 * Optional student community invite.
 *
 * Only rendered when VITE_DISCORD_INVITE_URL is set at build time and looks like
 * a real https invite, so a deployment without a server simply has no card, and
 * a mistyped value can never become a clickable link.
 */
const inviteUrl = (import.meta.env.VITE_DISCORD_INVITE_URL ?? '').trim();
const hasInvite = /^https:\/\/\S+$/.test(inviteUrl);

export default function DiscordInvite() {
  if (!hasInvite) return null;
  return (
    <section className="discord-invite-card" aria-labelledby="discord-invite-title">
      <span className="discord-mark" aria-hidden="true">◈</span>
      <div>
        <p className="viewer-kicker">Student community</p>
        <h3 id="discord-invite-title">Join the Daraja Discord Community</h3>
        <p className="muted">
          Keep the conversation going between sessions: study circles, learning resources and a moderator-supported
          space where you can ask questions. Joining is optional.
        </p>
      </div>
      <a className="discord-invite-link" href={inviteUrl} target="_blank" rel="noopener noreferrer">
        Join the Daraja Discord Community
      </a>
    </section>
  );
}
