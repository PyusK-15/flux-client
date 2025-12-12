// flux-client/src/components/Auth.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Chat from './Chat';
import io from 'socket.io-client';
import { API_BASE_URL } from '../config'; 
const PUBLIC_LOGO_PATH = '/flux-logo.jpg'; 

const socket = io(API_BASE_URL); 

const Auth = () => {
    const [customIdInput, setCustomIdInput] = useState(''); 
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [isRegister, setIsRegister] = useState(false); 
    const [isAuthenticated, setIsAuthenticated] = useState(false); 
    const [systemUsername, setSystemUsername] = useState(''); 
    const [isLoading, setIsLoading] = useState(true); 

    // FIX 3: Check for token/username in localStorage on mount
    useEffect(() => {
        const storedToken = localStorage.getItem('chatToken');
        const storedUsername = localStorage.getItem('chatUsername');
        
        if (storedToken && storedUsername) {
            setSystemUsername(storedUsername);
            socket.emit('register_user', storedUsername); 
            setIsAuthenticated(true);
        }
        setIsLoading(false); 
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const endpoint = isRegister ? '/register' : '/login';
            const payload = isRegister 
                ? { customId: customIdInput, password, displayName } 
                : { customId: customIdInput, password };

            const response = await axios.post(`${API_BASE_URL}/api/auth${endpoint}`, payload);

            if (isRegister) {
                alert(`Registered! Your System ID for friends to find you is: ${response.data.username}`);
                setIsRegister(false); 
                setCustomIdInput(''); 
                setPassword('');
            } else {
                const { token, username: sysID } = response.data; 
                
                // FIX 3: Store token and System ID upon successful login
                localStorage.setItem('chatToken', token);
                localStorage.setItem('chatUsername', sysID);

                setSystemUsername(sysID);
                socket.emit('register_user', sysID); 
                setIsAuthenticated(true);
            }
        } catch (error) {
            alert(error.response?.data?.message || 'Error occurred. Check your backend console for details.');
        }
    };
    
    // FIX 3: Function to handle logout and clear storage
    const handleLogout = () => {
        localStorage.removeItem('chatToken');
        localStorage.removeItem('chatUsername');
        window.location.reload(); 
    };

    if (isLoading) {
        return <div className="loading-screen">Loading authentication...</div>;
    }
    
    if (isAuthenticated) {
        return <Chat username={systemUsername} socket={socket} handleLogout={handleLogout} />;
    }

    return (
        <div className="auth-container">
            <div className="app-logo-container">
                <img src={PUBLIC_LOGO_PATH} alt="Flux Chat Logo" className="app-logo-large" />
                <h1>Flux Chat</h1>
            </div>
            <h2>{isRegister ? 'Create Account' : 'Login'}</h2>
            <form onSubmit={handleSubmit} className="auth-form">
                {isRegister && (
                    <input type="text" placeholder="Display Name (e.g. User)" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                )}
                <input 
                    type="text" 
                    placeholder={isRegister ? "Create Login ID (e.g. user123)" : "Login ID"} 
                    value={customIdInput} 
                    onChange={(e) => setCustomIdInput(e.target.value)} 
                    required 
                />
                <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                <button type="submit">{isRegister ? 'REGISTER' : 'LOGIN'}</button>
            </form>
            <div className="switch-view">
                <button onClick={() => setIsRegister(!isRegister)}>
                    {isRegister ? 'Have an account? Login.' : 'New User? Register.'}
                </button>
            </div>
        </div>
    );
};
export default Auth;