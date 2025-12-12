// flux-client/src/components/Chat.jsx
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config'; 
const PUBLIC_LOGO_PATH = '/flux-logo.jpg'; 

const Chat = ({ username, socket, handleLogout }) => {
    const [recipient, setRecipient] = useState(null); 
    const [messages, setMessages] = useState([]); 
    const [chatHistory, setChatHistory] = useState({}); // Local RAM storage for messages
    
    const [messageInput, setMessageInput] = useState('');
    const [friends, setFriends] = useState({}); 
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResult, setSearchResult] = useState(null);
    const [pendingRequests, setPendingRequests] = useState([]);
    const [showRequests, setShowRequests] = useState(false); 
    const messagesEndRef = useRef(null);

    const refreshData = async () => {
        try {
            const reqRes = await axios.post(`${API_BASE_URL}/api/friends/requests/pending`, { username });
            if (reqRes.data.success) setPendingRequests(reqRes.data.pendingRequests);

            const friendRes = await axios.post(`${API_BASE_URL}/api/friends/list`, { username });
            if (friendRes.data.success) {
                const friendsMap = {};
                friendRes.data.friends.forEach(f => {
                    friendsMap[f.username] = {
                        systemId: f.username,
                        displayName: f.displayName,
                        customId: f.customId, 
                        status: 'offline', 
                        unreadCount: 0
                    };
                });
                // Merge the refreshed list with existing friend objects (to retain status/unread)
                setFriends(prev => {
                    const merged = { ...friendsMap };
                    for (const id in prev) {
                        if (merged[id]) {
                            // Keep previous status/unread if the friend is in the new list
                            merged[id] = { ...merged[id], status: prev[id].status, unreadCount: prev[id].unreadCount };
                        }
                    }
                    return merged;
                });
            }
        } catch (error) { console.error("Data refresh failed", error); }
    };

    useEffect(() => {
        refreshData(); 
        
        // --- SOCKET HANDLERS ---
        socket.on('private_message', (data) => {
            const senderId = data.sender;
            const newMessage = { sender: senderId, message: data.message, timestamp: new Date() };

            // 1. Update RAM History
            setChatHistory(prev => ({
                ...prev,
                [senderId]: [...(prev[senderId] || []), newMessage]
            }));

            // 2. If viewing this chat, update view immediately
            if (recipient === senderId) {
                setMessages(prev => [...prev, newMessage]);
            } else {
                // 3. Else update unread
                setFriends(prev => ({
                    ...prev,
                    [senderId]: { ...prev[senderId], unreadCount: (prev[senderId]?.unreadCount || 0) + 1 }
                }));
            }
        });

        socket.on('friend_status_update', (data) => {
            setFriends(prev => {
                if (!prev[data.username]) return prev;
                return { ...prev, [data.username]: { ...prev[data.username], status: data.status } };
            });
        });

        socket.on('new_friend_request', (data) => { alert(data.message); refreshData(); });
        
        // FIX 2: Handle accepted request from the other user
        socket.on('friend_accepted', (data) => {
            alert(`${data.displayName} accepted your friend request!`);
            
            // Manually add the new friend to the friends map
            setFriends(prev => ({ 
                ...prev, 
                [data.username]: {
                    systemId: data.username,
                    displayName: data.displayName,
                    customId: data.customId,
                    status: 'online', // Assume they are online since they just accepted
                    unreadCount: 0
                }
            }));
        });

        return () => { 
            socket.off('private_message'); 
            socket.off('friend_status_update'); 
            socket.off('new_friend_request'); 
            socket.off('friend_accepted'); // Clean up the new listener
        };
    }, [socket, username, recipient]); 

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

    // HANDLERS
    const selectRecipient = (id) => {
        setRecipient(id);
        // Load from RAM history
        setMessages(chatHistory[id] || []);
        // Clear unread
        setFriends(prev => ({ ...prev, [id]: { ...prev[id], unreadCount: 0 } }));
    };

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!messageInput || !recipient) return;
        
        const msgData = { sender: username, recipient, message: messageInput };
        socket.emit('private_message', msgData); 

        // Update local RAM history
        const localMsg = { ...msgData, timestamp: new Date() };
        setChatHistory(prev => ({
            ...prev,
            [recipient]: [...(prev[recipient] || []), localMsg]
        }));
        setMessages(prev => [...prev, localMsg]);
        setMessageInput('');
    };
    
    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchQuery) return;
        setSearchResult(null);
        try {
            const res = await axios.post(`${API_BASE_URL}/api/friends/search`, { targetUsername: searchQuery });
            if (res.data.success) setSearchResult(res.data.user);
        } catch (error) { alert('User not found (Check System ID)'); }
    };
    
    const handleSendRequest = async () => {
        if (!searchResult) return;
        try {
            const res = await axios.post(`${API_BASE_URL}/api/friends/request`, { senderUsername: username, targetUsername: searchResult.username });
            alert(res.data.message);
            setSearchResult(null); setSearchQuery('');
        } catch (error) { alert('Failed'); }
    };

    const handleAcceptRequest = async (senderUsername) => {
        try {
            await axios.post(`${API_BASE_URL}/api/friends/accept`, { acceptorUsername: username, senderUsername });
            alert('Added!'); refreshData(); setShowRequests(false);
        } catch (error) { alert('Failed'); }
    };

    const friendsArray = Object.values(friends);
    
    return (
        <div className="chat-interface">
            <header className="chat-header">
                <div style={{display:'flex', alignItems:'center'}}>
                    <img src={PUBLIC_LOGO_PATH} alt="Logo" className="logo-small" />
                    <span>System ID: <strong>{username}</strong></span>
                </div>
                <div className="friend-request-slot">
                    <button onClick={() => setShowRequests(!showRequests)} className="notification-icon">
                        🔔 {pendingRequests.length > 0 && <span className="notification-badge">{pendingRequests.length}</span>}
                    </button>
                    {showRequests && (
                        <div className="pending-requests-dropdown">
                            {pendingRequests.length === 0 ? <p>No requests</p> : (
                                pendingRequests.map(req => (
                                    <div key={req.username} className="request-item">
                                        <span>{req.displayName} ({req.username})</span>
                                        <button onClick={() => handleAcceptRequest(req.username)} style={{backgroundColor: '#4caf50'}}>Accept</button>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
                <button onClick={handleLogout} className="logout-button">Logout</button>
            </header>
            
            <div className="chat-main">
                <div className="user-sidebar">
                    <h3>🔎 Add Friends</h3>
                    <p style={{fontSize:'0.8rem', color:'#888', marginBottom:'10px'}}>Search using System ID</p>
                    <form onSubmit={handleSearch} className="friend-search">
                        <input type="text" placeholder="System ID (kjv6f8f4)..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                        <button type="submit">Search</button>
                    </form>
                    {searchResult && (
                        <div className="search-result">
                            <p>{searchResult.displayName} ({searchResult.username})</p>
                            {friends[searchResult.username] ? <button disabled>Already Friend</button> : <button onClick={handleSendRequest}>+ Request</button>}
                        </div>
                    )}
                    <hr style={{margin: '20px 0', borderColor: '#333'}} />
                    <h3>💬 Friends</h3>
                    <div className="friends-list">
                        {friendsArray.length === 0 ? <p style={{color:'#666', textAlign:'center'}}>No friends.</p> : (
                            friendsArray.map(user => (
                                <div key={user.systemId} className={`user-item ${recipient === user.systemId ? 'selected' : ''}`} onClick={() => selectRecipient(user.systemId)}>
                                    <span className={`status-indicator ${user.status}`}></span>
                                    <div style={{display:'flex', flexDirection:'column'}}>
                                        <span className="display-name">{user.displayName}</span>
                                        <span style={{fontSize:'0.75rem', color:'#aaa'}}>@{user.customId}</span>
                                    </div>
                                    {user.unreadCount > 0 && <span className="unread-count">({user.unreadCount})</span>}
                                </div>
                            ))
                        )}
                    </div>
                </div>
                
                <div className="chat-window">
                    {recipient ? (
                        <>
                            <div className="chat-title">
                                Chat: {friends[recipient]?.displayName} 
                                <span style={{fontSize:'0.8rem', color:'#aaa', marginLeft:'10px'}}>@{friends[recipient]?.customId}</span>
                            </div>
                            <div className="messages-container">
                                {messages.map((msg, idx) => (
                                    <div key={idx} className={`message-bubble ${msg.sender === username ? 'sent' : 'received'}`}>
                                        <span className="message-sender">{msg.sender === username ? 'You' : friends[msg.sender]?.displayName}: </span>
                                        
                                        {/* FIX 1: Display the message content and time */}
                                        <span className="message-content">{msg.message}</span>
                                        <span className="message-time">
                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>
                            <form onSubmit={handleSendMessage} className="message-input-form">
                                <input type="text" placeholder="Type..." value={messageInput} onChange={(e) => setMessageInput(e.target.value)} />
                                <button type="submit">Send</button>
                            </form>
                        </>
                    ) : (
                        <div className="chat-placeholder">Select a friend to chat</div>
                    )}
                </div>
            </div>
        </div>
    );
};
export default Chat;