import React, { useState } from "react";
import AuthInput from "./AuthInput";

function PasswordInput({
  label,
  name,
  value,
  onChange,
  placeholder,
  required = false,
  autoComplete,
  icon = "🔒",
  disabled = false,
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="password-auth-shell">
      <AuthInput
        label={label}
        type={showPassword ? "text" : "password"}
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        icon={icon}
        autoComplete={autoComplete}
        required={required}
        disabled={disabled}
      />

      <button
        type="button"
        className="password-visibility-button"
        onClick={() => setShowPassword((prev) => !prev)}
        disabled={disabled}
        aria-label={showPassword ? "Hide password" : "Show password"}
        title={showPassword ? "Hide password" : "Show password"}
      >
        {showPassword ? "Hide" : "Show"}
      </button>
    </div>
  );
}

export default PasswordInput;
