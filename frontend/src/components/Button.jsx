function Button({ children, type = 'button', disabled = false }) {
    return (
        <button type={type} disabled={disabled} style={styles.button}>
            {children}
        </button>
    );
}

const styles = {
    button: {
        padding: '13px',
        borderRadius: '10px',
        border: 'none',
        backgroundColor: '#2563eb',
        color: '#ffffff',
        fontSize: '16px',
        fontWeight: '600',
        cursor: 'pointer',
        marginTop: '5px',
        width: '100%',
    },
};

export default Button;