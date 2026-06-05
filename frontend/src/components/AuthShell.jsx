export default function AuthShell({ children }) {
  return (
    <main className="home-page">
      <section className="auth-stage">{children}</section>
    </main>
  );
}
