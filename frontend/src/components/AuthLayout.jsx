function AuthLayout({ title, subtitle, children }) {
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>{title}</h1>
        <p style={styles.subtitle}>{subtitle}</p>
        {children}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#f4f7fb",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontFamily: "Arial, sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: "450px",
    backgroundColor: "#ffffff",
    padding: "35px",
    borderRadius: "16px",
    boxShadow: "0 8px 25px rgba(0,0,0,0.08)",
  },
  title: {
    margin: 0,
    textAlign: "center",
    color: "#1f2937",
    fontSize: "30px",
    fontWeight: "700",
  },
  subtitle: {
    textAlign: "center",
    color: "#6b7280",
    marginBottom: "25px",
  },
};

export default AuthLayout;
