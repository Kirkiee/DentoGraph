function AuthButton({ children, type = 'button', disabled = false }) {
  return (
    <button className="auth-button" type={type} disabled={disabled}>
      {children}
    </button>
  );
}

export default AuthButton;