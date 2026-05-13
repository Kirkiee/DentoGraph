function FormInput({ label, type = 'text', name, placeholder, value, onChange, required = true }) {
    return (
        <div style={styles.formGroup}>
            <label style={styles.label}>{label}</label>
            <input
                type={type}
                name={name}
                placeholder={placeholder}
                value={value}
                onChange={onChange}
                style={styles.input}
                required={required}
            />
        </div>
    );
}

const styles = {
    formGroup: {
        display: 'flex',
        flexDirection: 'column',
    },
    label: {
        marginBottom: '8px',
        fontWeight: '600',
        color: '#374151',
        fontSize: '14px',
    },
    input: {
        padding: '12px 14px',
        borderRadius: '10px',
        border: '1px solid #d1d5db',
        fontSize: '15px',
        outline: 'none',
    },
};

export default FormInput;