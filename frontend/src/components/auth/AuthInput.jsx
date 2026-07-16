function AuthInput({
  label,
  type = "text",
  name,
  placeholder,
  value,
  onChange,
  icon,
  required = true,
  disabled = false,
  autoComplete,
}) {
  return (
    <div className="auth-field">
      <label htmlFor={name}>
        {label}
        {required && (
          <span className="auth-required" aria-label="required">
            *
          </span>
        )}
      </label>

      <div className="auth-input-wrapper">
        {icon && <span className="auth-input-icon">{icon}</span>}

        <input
          id={name}
          className={icon ? "auth-input has-icon" : "auth-input"}
          type={type}
          name={name}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required={required}
          disabled={disabled}
          autoComplete={autoComplete}
          aria-required={required}
        />
      </div>
    </div>
  );
}

export default AuthInput;
