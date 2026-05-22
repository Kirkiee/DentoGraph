function AuthInput({
  label,
  type = 'text',
  name,
  placeholder,
  value,
  onChange,
  icon,
  required = true,
}) {
  return (
    <div className="auth-field">
      <label>{label}</label>

      <div className="auth-input-wrapper">
        {icon && <span className="auth-input-icon">{icon}</span>}

        <input
          className={icon ? 'auth-input has-icon' : 'auth-input'}
          type={type}
          name={name}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required={required}
        />
      </div>
    </div>
  );
}

export default AuthInput;