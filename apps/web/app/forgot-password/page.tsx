import Link from 'next/link';
export default function ForgotPassword() {
  return (
    <main className="login">
      <section className="card login-card">
        <div className="brand" style={{ color: '#17212b', marginBottom: 28 }}>
          <span className="mark">N</span>NexusForge
        </div>
        <h1>Reset your password</h1>
        <div className="alert alert-info" role="note">
          Password recovery isn’t available yet. Email-based reset is planned for a future release. For now,
          contact your workspace administrator if you’re locked out.
        </div>
        <form aria-disabled="true">
          <label htmlFor="email">
            Email
            <input id="email" className="input" type="email" placeholder="you@company.com" disabled />
          </label>
          <button className="button" style={{ width: '100%' }} type="button" disabled>
            Send reset link (coming soon)
          </button>
        </form>
        <p className="muted" style={{ fontSize: 13 }}>
          <Link href="/login" style={{ color: '#315dca' }}>
            Return to sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
