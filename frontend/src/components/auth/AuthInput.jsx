function AuthInput({
  label,
  type = 'text',
  name,
  placeholder,
  value,
  onChange,
  icon: Icon,
  required = true,
}) {
  return (
    <div className="auth-field">
      <label>{label}</label>

      <div className="auth-input-wrapper">
        {Icon && <Icon className="auth-input-icon" />}

        <input
          className={Icon ? 'auth-input has-icon' : 'auth-input'}
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