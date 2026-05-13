import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api/axios';
import AuthLayout from '../components/AuthLayout';
import FormInput from '../components/FormInput';
import Button from '../components/Button';

function Register() {
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
    });

    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    const PATIENT_ROLE_ID = 3;

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            const payload = {
                ...formData,
                role_id: PATIENT_ROLE_ID,
            };

            await API.post('/api/users/register', payload);

            setSuccess('Patient account registered successfully. You may now log in.');

            setFormData({
                name: '',
                email: '',
                password: '',
            });

            setTimeout(() => {
                navigate('/');
            }, 1200);
        } catch (err) {
            if (err.response?.data?.error) {
                setError(err.response.data.error);
            } else {
                setError('Something went wrong. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout
            title="Create Patient Account"
            subtitle="Register as a patient to access DentoGraph"
        >
            {error && <div style={styles.error}>{error}</div>}
            {success && <div style={styles.success}>{success}</div>}

            <form onSubmit={handleSubmit} style={styles.form}>
                <FormInput
                    label="Full Name"
                    name="name"
                    placeholder="Enter your full name"
                    value={formData.name}
                    onChange={handleChange}
                />

                <FormInput
                    label="Email"
                    type="email"
                    name="email"
                    placeholder="Enter your email address"
                    value={formData.email}
                    onChange={handleChange}
                />

                <FormInput
                    label="Password"
                    type="password"
                    name="password"
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={handleChange}
                />

                <Button type="submit" disabled={loading}>
                    {loading ? 'Registering...' : 'Register'}
                </Button>
            </form>

            <p style={styles.footerText}>
                Already have an account?{' '}
                <span style={styles.link} onClick={() => navigate('/')}>
                    Login
                </span>
            </p>

            <p style={styles.note}>
                Dentists and dental assistants are registered through a subscribed clinic account.
            </p>
        </AuthLayout>
    );
}

const styles = {
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
    },
    error: {
        backgroundColor: '#fee2e2',
        color: '#b91c1c',
        padding: '10px',
        borderRadius: '8px',
        marginBottom: '15px',
        fontSize: '14px',
        textAlign: 'center',
    },
    success: {
        backgroundColor: '#dcfce7',
        color: '#166534',
        padding: '10px',
        borderRadius: '8px',
        marginBottom: '15px',
        fontSize: '14px',
        textAlign: 'center',
    },
    footerText: {
        textAlign: 'center',
        color: '#6b7280',
        fontSize: '14px',
        marginTop: '20px',
    },
    link: {
        color: '#2563eb',
        fontWeight: '600',
        cursor: 'pointer',
    },
    note: {
        marginTop: '15px',
        fontSize: '13px',
        color: '#6b7280',
        textAlign: 'center',
        lineHeight: '1.4',
    },
};

export default Register;