import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api/axios';
import AuthLayout from '../components/AuthLayout';
import FormInput from '../components/FormInput';
import Button from '../components/Button';

function Login() {
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        email: '',
        password: '',
    });

    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    const redirectByRole = (role) => {
        switch (role) {
            case 'Admin':
                navigate('/admin/dashboard');
                break;
            case 'Dentist':
                navigate('/dentist/dashboard');
                break;
            case 'Patient':
                navigate('/patient/dashboard');
                break;
            case 'Assistant':
                navigate('/assistant/dashboard');
                break;
            default:
                navigate('/');
                break;
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await API.post('/api/users/login', formData);

            const { token, user } = response.data;

            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));

            redirectByRole(user.role);
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
        <AuthLayout title="DentoGraph" subtitle="Login to your account">
            {error && <div style={styles.error}>{error}</div>}

            <form onSubmit={handleSubmit} style={styles.form}>
                <FormInput
                    label="Email"
                    type="email"
                    name="email"
                    placeholder="Enter your email"
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
                    {loading ? 'Logging in...' : 'Login'}
                </Button>
            </form>

            <p style={styles.footerText}>
                Do not have an account?{' '}
                <span style={styles.link} onClick={() => navigate('/register')}>
                    Register
                </span>
            </p>
        </AuthLayout>
    );
}

const styles = {
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
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
};

export default Login;