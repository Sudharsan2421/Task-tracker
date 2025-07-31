import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { getAllComments, addReply, markCommentsAsRead } from '../../services/commentService';
import { getWorkers } from '../../services/workerService';
import Spinner from '../common/Spinner';
import Modal from '../common/Modal';
import appContext from '../../context/AppContext';

// --- SVG Icons for the UI ---
const SendIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>;
const SearchIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>;
const MoreIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>;
const GroupIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>;

// Component to inject CSS styles directly
const ComponentStyles = () => (
    <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
        :root {
            --primary-color: #FE3A82;
            --background-color: #F0F4F8;
            --container-bg: #FFFFFF;
            --sidebar-bg: #FFFFFF;
            --chat-panel-bg: #F7F9FB;
            --incoming-msg-bg: #FFFFFF;
            --outgoing-msg-bg: #4A4D5F;
            --text-dark: #222222;
            --text-light: #777777;
            --text-white: #FFFFFF;
            --border-color: #E8E8E8;
            --shadow-color: rgba(0, 0, 0, 0.05);
        }
        .admin-chat-container * { box-sizing: border-box; }
        .admin-chat-container {
            font-family: 'Poppins', sans-serif; display: flex; width: 100%; max-width: 1200px; height: 90vh; max-height: 800px;
            background-color: var(--container-bg); border-radius: 40px; box-shadow: 0 10px 40px var(--shadow-color); overflow: hidden; margin: auto;
        }
        .admin-sidebar { width: 30%; max-width: 320px; padding: 30px; display: flex; flex-direction: column; border-right: 1px solid var(--border-color); }
        .admin-sidebar-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .admin-sidebar-header h2 { font-size: 24px; font-weight: 600; }
        .admin-search-bar { position: relative; margin-bottom: 20px; }
        .admin-search-bar input { width: 100%; padding: 12px 40px 12px 20px; border-radius: 20px; border: none; background-color: var(--background-color); font-size: 14px; }
        .admin-search-bar svg { position: absolute; right: 15px; top: 50%; transform: translateY(-50%); color: var(--text-light); }
        .employee-list { flex-grow: 1; overflow-y: auto; }
        .employee-list ul { list-style-type: none; padding: 0;}
        .employee-item { display: flex; align-items: center; padding: 15px; border-radius: 20px; margin-bottom: 10px; cursor: pointer; transition: background-color 0.2s ease; position: relative; }
        .employee-item:hover { background-color: var(--background-color); }
        .employee-item.active { background-color: var(--primary-color); color: var(--text-white); box-shadow: 0 5px 15px rgba(254, 58, 130, 0.2); }
        .employee-item.active .employee-name, .employee-item.active .employee-last-message { color: var(--text-white); }
        .employee-item img, .employee-item .group-avatar { width: 50px; height: 50px; border-radius: 50%; margin-right: 15px; object-fit: cover; }
        .group-avatar { background-color: #e0e0e0; display: flex; align-items: center; justify-content: center; color: #555; }
        .employee-details { display: flex; flex-direction: column; }
        .employee-name { font-weight: 600; color: var(--text-dark); }
        .employee-last-message { font-size: 12px; color: var(--text-light); }
        .unread-badge { margin-left: auto; background-color: var(--primary-color); color: white; font-size: 12px; font-weight: 600; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; }
        .employee-item.active .unread-badge { background-color: white; color: var(--primary-color); }
        .icon-btn { background: none; border: none; cursor: pointer; color: var(--text-light); padding: 8px; display: flex; align-items: center; justify-content: center;}
        
        .admin-chat-panel { flex-grow: 1; display: flex; flex-direction: column; background-color: var(--chat-panel-bg); }
        .admin-chat-header { padding: 20px 30px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-color); background-color: var(--container-bg); }
        .admin-chat-header .contact-info { display: flex; align-items: center; }
        .admin-chat-header .contact-info .group-avatar-header { width: 40px; height: 40px; border-radius: 50%; margin-right: 15px; background-color: #e0e0e0; display: flex; align-items: center; justify-content: center; color: #555;}
        .admin-chat-header .contact-info img { width: 40px; height: 40px; border-radius: 50%; margin-right: 15px; object-fit: cover; }
        .admin-chat-header .contact-details { display: flex; flex-direction: column; }
        .admin-chat-header .contact-name { font-weight: 600; }
        .admin-chat-header .contact-status { font-size: 13px; color: var(--text-light); }
        .admin-message-area { flex-grow: 1; padding: 30px; overflow-y: auto; display: flex; flex-direction: column; gap: 5px; }
        .message { display: flex; gap: 15px; max-width: 65%; margin-bottom: 15px; }
        .message.incoming { align-self: flex-start; }
        .message.outgoing { align-self: flex-end; flex-direction: row-reverse; }
        .message-content { padding: 15px 20px; border-radius: 25px; font-size: 15px; box-shadow: 0 4px 10px var(--shadow-color); }
        .message.incoming .message-content { background-color: var(--incoming-msg-bg); border-top-left-radius: 5px; }
        .message.outgoing .message-content { background-color: var(--outgoing-msg-bg); color: var(--text-white); border-top-right-radius: 5px; }
        .message-time { font-size: 11px; margin-top: 8px; text-align: right; color: var(--text-light); }
        .message.outgoing .message-time { color: rgba(255, 255, 255, 0.7); }
        .message-avatar { width: 40px; height: 40px; border-radius: 50%; align-self: flex-end; font-weight: 600; display: flex; justify-content: center; align-items: center; background-color: #ccc; color: #333;}
        .admin-chat-footer { padding: 15px 30px; background-color: var(--container-bg); border-top: 1px solid var(--border-color); }
        .message-form { display: flex; align-items: center; gap: 15px; background-color: var(--chat-panel-bg); padding: 8px; border-radius: 25px; }
        .message-form input { flex-grow: 1; border: none; background: transparent; padding: 10px; font-size: 15px; outline: none; }
        .send-btn { background-color: var(--primary-color); color: var(--text-white); border-radius: 50%; width: 45px; height: 45px;}
        .no-chat-selected { display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%; color: var(--text-light); }
        .no-chat-selected h2 { font-size: 22px; font-weight: 600; margin-bottom: 10px; }
        .date-separator { text-align: center; margin: 20px 0; color: var(--text-light); font-size: 12px; position: relative; }
        .date-separator span { background-color: var(--chat-panel-bg); padding: 0 10px; position: relative; z-index: 1; }
        .date-separator::before { content: ''; position: absolute; left: 0; top: 50%; width: 100%; height: 1px; background-color: var(--border-color); z-index: 0; }
        .attachment { margin-top: 5px; }
        .attachment-preview { max-width: 100%; border-radius: 15px; cursor: pointer; }

        /* Dropdown Styles */
        .header-actions, .chat-header-actions { position: relative; }
        .dropdown-menu {
            position: absolute; top: calc(100% + 5px); right: 0; background-color: var(--container-bg);
            border: 1px solid var(--border-color); border-radius: 12px; box-shadow: 0 5px 20px var(--shadow-color);
            width: 180px; z-index: 10; overflow: hidden; padding: 8px 0;
        }
        .dropdown-menu ul { list-style: none; padding: 0; margin: 0; }
        .dropdown-item { padding: 12px 20px; cursor: pointer; font-size: 14px; font-weight: 500; color: var(--text-dark); transition: background-color 0.2s ease; }
        .dropdown-item:hover { background-color: var(--background-color); }

        /* "New Group" Modal Styles */
        .new-group-worker-list { list-style: none; padding: 0; margin: 0; max-height: 40vh; overflow-y: auto; }
        .new-group-worker-item { display: flex; align-items: center; padding: 10px 5px; border-bottom: 1px solid var(--border-color); cursor: pointer; }
        .new-group-worker-item:last-child { border-bottom: none; }
        .new-group-worker-item img { width: 40px; height: 40px; border-radius: 50%; margin-right: 15px; object-fit: cover; }
        .new-group-worker-item span { font-weight: 500; color: var(--text-dark); flex-grow: 1; }
        .new-group-worker-item input[type="checkbox"] { width: 18px; height: 18px; accent-color: var(--primary-color); margin-left: 15px; }
        .modal-footer { padding-top: 15px; text-align: right; }
        .create-group-btn { background-color: var(--primary-color); color: white; padding: 10px 20px; border-radius: 8px; border: none; font-weight: 600; cursor: pointer; }
        .create-group-btn:disabled { background-color: #ccc; cursor: not-allowed; }
        .group-name-input { width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 16px; margin-bottom: 15px; }
    `}
    </style>
);

const CommentManagement = () => {
    const [comments, setComments] = useState([]);
    const [chatList, setChatList] = useState([]);
    const [allWorkers, setAllWorkers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedChat, setSelectedChat] = useState(null);
    const [chatMessages, setChatMessages] = useState([]);
    const [replyText, setReplyText] = useState('');
    const { subdomain } = useContext(appContext);
    const chatContainerRef = useRef(null);
    const [searchTerm, setSearchTerm] = useState('');

    // State for dropdowns and modals
    const [isSidebarDropdownOpen, setIsSidebarDropdownOpen] = useState(false);
    const sidebarDropdownRef = useRef(null);
    const [isChatDropdownOpen, setIsChatDropdownOpen] = useState(false);
    const chatDropdownRef = useRef(null);
    const [isNewGroupModalOpen, setIsNewGroupModalOpen] = useState(false);
    const [isGroupNameModalOpen, setIsGroupNameModalOpen] = useState(false);
    const [selectedWorkersForGroup, setSelectedWorkersForGroup] = useState([]);
    const [groupName, setGroupName] = useState('');

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (sidebarDropdownRef.current && !sidebarDropdownRef.current.contains(event.target)) {
                setIsSidebarDropdownOpen(false);
            }
            if (chatDropdownRef.current && !chatDropdownRef.current.contains(event.target)) {
                setIsChatDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => { document.removeEventListener('mousedown', handleClickOutside); };
    }, []);

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [commentsData, workersData] = await Promise.all([
                getAllComments({ subdomain }),
                getWorkers({ subdomain })
            ]);

            const safeComments = Array.isArray(commentsData) ? commentsData : [];
            const safeWorkers = Array.isArray(workersData) ? workersData : [];

            setComments(safeComments);
            setAllWorkers(safeWorkers);

            const commentingWorkersMap = new Map();
            safeComments.forEach(comment => {
                if (comment.worker && comment.worker.name && comment.worker.name.trim().toLowerCase() !== 'unknown' && !commentingWorkersMap.has(comment.worker._id)) {
                    commentingWorkersMap.set(comment.worker._id, { ...comment.worker, isGroup: false });
                }
            });
            
            const savedGroups = JSON.parse(localStorage.getItem(`chatGroups_${subdomain}`) || '[]');
            const combinedList = [...savedGroups, ...Array.from(commentingWorkersMap.values())];
            setChatList(combinedList);

        } catch (error) {
            toast.error('Failed to load data');
        } finally {
            setIsLoading(false);
        }
    }, [subdomain]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useEffect(() => {
        if (selectedChat && !selectedChat.isGroup) {
            const workerComments = comments.filter(c => c.worker?._id === selectedChat._id);
            const messages = [];
            workerComments.forEach(comment => {
                messages.push({
                    id: comment._id, text: comment.text, createdAt: new Date(comment.createdAt),
                    isWorker: true, attachment: comment.attachment
                });
                comment.replies?.forEach(reply => {
                    messages.push({
                        id: reply._id, text: reply.text, createdAt: new Date(reply.createdAt),
                        isWorker: false
                    });
                });
            });
            messages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
            setChatMessages(messages);
        } else {
            setChatMessages([]);
        }
    }, [selectedChat, comments]);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chatMessages]);

    const handleProceedToGroupName = () => {
        if (selectedWorkersForGroup.length === 0) {
            toast.warn('Please select at least one worker.');
            return;
        }
        setIsNewGroupModalOpen(false);
        setIsGroupNameModalOpen(true);
    };

    const handleFinalizeGroup = () => {
        if (!groupName.trim()) {
            toast.warn('Please enter a group name.');
            return;
        }
        
        const newGroup = {
            _id: `group_${Date.now()}`,
            name: groupName.trim(),
            isGroup: true,
            members: allWorkers.filter(worker => selectedWorkersForGroup.includes(worker._id))
        };

        const updatedChatList = [newGroup, ...chatList];
        setChatList(updatedChatList);
        setSelectedChat(newGroup);

        const currentGroups = updatedChatList.filter(chat => chat.isGroup);
        localStorage.setItem(`chatGroups_${subdomain}`, JSON.stringify(currentGroups));

        toast.success(`Group "${groupName}" created successfully!`);
        
        setIsGroupNameModalOpen(false);
        setSelectedWorkersForGroup([]);
        setGroupName('');
    };
    
    const handleToggleWorkerSelection = (workerId) => {
        setSelectedWorkersForGroup(prevSelected => {
            if (prevSelected.includes(workerId)) {
                return prevSelected.filter(id => id !== workerId);
            } else {
                return [...prevSelected, workerId];
            }
        });
    };

    const handleSubmitReply = async (e) => {
        e.preventDefault();
        if (!replyText.trim() || !selectedChat || selectedChat.isGroup) return;
        try {
            const commentToReplyTo = comments.find(c => c.worker?._id === selectedChat._id);
            if (!commentToReplyTo) {
                toast.error("Could not find a conversation thread to reply to.");
                return;
            }
            await addReply(commentToReplyTo._id, { text: replyText, isAdminReply: true });
            setReplyText('');
            toast.success('Reply sent!');
            loadData();
        } catch (error) {
            toast.error(error.message || "Failed to send reply.");
        }
    };

    const formatDateHeader = (date) => format(new Date(date), 'MMMM dd, yyyy');
    const formatTime = (date) => format(new Date(date), 'h:mm a');

    const visibleChatList = chatList.filter(chat =>
        chat.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const groupedMessages = chatMessages.reduce((acc, message) => {
        const date = formatDateHeader(message.createdAt);
        if (!acc[date]) acc[date] = [];
        acc[date].push(message);
        return acc;
    }, {});
    
    return (
    <>
        <div className="admin-chat-container">
            <ComponentStyles />
            <aside className="admin-sidebar">
                <div className="admin-sidebar-header">
                    <h2>Chat</h2>
                    <div className="header-actions" ref={sidebarDropdownRef}>
                        <button onClick={() => setIsSidebarDropdownOpen(!isSidebarDropdownOpen)} className="icon-btn">
                            <MoreIcon />
                        </button>
                        {isSidebarDropdownOpen && (
                            <div className="dropdown-menu">
                                <ul>
                                    <li className="dropdown-item" onClick={() => { setIsNewGroupModalOpen(true); setIsSidebarDropdownOpen(false); }}>New Group</li>
                                    <li className="dropdown-item" onClick={() => toast.info('Theme feature coming soon!')}>Theme</li>
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
                <div className="admin-search-bar">
                    <input 
                        type="text" 
                        placeholder="Search Name" 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <SearchIcon />
                </div>
                <nav className="employee-list">
                    {isLoading ? <Spinner /> : (
                        <ul>
                            {visibleChatList.map(chat => (
                                <li key={chat._id} className={`employee-item ${selectedChat?._id === chat._id ? 'active' : ''}`} onClick={() => setSelectedChat(chat)}>
                                    {chat.isGroup ? (
                                        <div className="group-avatar"><GroupIcon /></div>
                                    ) : (
                                        <img src={chat.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(chat.name)}&background=random`} alt={chat.name} />
                                    )}
                                    <div className="employee-details">
                                        <span className="employee-name">{chat.name}</span>
                                        <span className="employee-last-message">
                                            {chat.isGroup ? `${chat.members.length} members` : (chat.department?.name || 'No Department')}
                                        </span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </nav>
            </aside>
            <main className="admin-chat-panel">
                {selectedChat ? (
                    <>
                        <header className="admin-chat-header">
                            <div className="contact-info">
                                {selectedChat.isGroup ? (
                                    <div className="group-avatar-header"><GroupIcon /></div>
                                ) : (
                                    <img src={selectedChat.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedChat.name || 'A')}&background=random`} alt={selectedChat.name}/>
                                )}
                                <div className="contact-details">
                                    <span className="contact-name">{selectedChat.name}</span>
                                    <span className="contact-status">
                                        {selectedChat.isGroup ? 
                                            selectedChat.members.map(m => m.name.split(' ')[0]).join(', ') :
                                            `Department: ${selectedChat.department?.name || 'N/A'}`
                                        }
                                    </span>
                                </div>
                            </div>
                            <div className="chat-header-actions" ref={chatDropdownRef}>
                                <button onClick={() => setIsChatDropdownOpen(!isChatDropdownOpen)} className="icon-btn">
                                    <MoreIcon />
                                </button>
                                {isChatDropdownOpen && (
                                    <div className="dropdown-menu">
                                        <ul>
                                            <li className="dropdown-item" onClick={() => toast.info('Contact Info clicked')}>Contact Info</li>
                                            <li className="dropdown-item" onClick={() => toast.info('Close Chat clicked')}>Close Chat</li>
                                            <li className="dropdown-item" onClick={() => toast.info('Delete Chat clicked')}>Delete Chat</li>
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </header>
                        <div className="admin-message-area" ref={chatContainerRef}>
                            {Object.entries(groupedMessages).map(([date, dayMessages]) => (
                                <React.Fragment key={date}>
                                    <div className="date-separator"><span>{date}</span></div>
                                    {dayMessages.map((msg) => (
                                        <div key={msg.id} className={`message ${msg.isWorker ? 'incoming' : 'outgoing'}`}>
                                            <div className="message-content">
                                                {!(msg.attachment && msg.text === 'Image') && <p>{msg.text}</p>}
                                                
                                                {msg.isWorker && msg.attachment && (
                                                    <div className="attachment">
                                                        <img src={msg.attachment.data} alt={msg.attachment.name || 'attachment'} className="attachment-preview" />
                                                    </div>
                                                )}

                                                <div className="message-time">{formatTime(msg.createdAt)}</div>
                                            </div>
                                            {!msg.isWorker && <div className="message-avatar admin-avatar">A</div>}
                                        </div>
                                    ))}
                                </React.Fragment>
                            ))}
                        </div>
                        <footer className="admin-chat-footer">
                            <form onSubmit={handleSubmitReply} className="message-form">
                                <input type="text" placeholder="Type a message here..." value={replyText} onChange={(e) => setReplyText(e.target.value)} />
                                <button type="submit" className="icon-btn send-btn"><SendIcon /></button>
                            </form>
                        </footer>
                    </>
                ) : (
                    <div className="no-chat-selected">
                        <h2>Select a Conversation</h2>
                        <p>Choose a person or group from the left to start chatting.</p>
                    </div>
                )}
            </main>
        </div>

        {/* Modal 1: Select Workers */}
        <Modal isOpen={isNewGroupModalOpen} onClose={() => setIsNewGroupModalOpen(false)} title="Add Group Participants">
            <ul className="new-group-worker-list">
                {isLoading ? <Spinner /> : (
                    allWorkers.map(worker => (
                        <li key={worker._id} className="new-group-worker-item" onClick={() => handleToggleWorkerSelection(worker._id)}>
                            <img src={worker.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(worker.name)}&background=random`} alt={worker.name} />
                            <span>{worker.name}</span>
                            <input
                                type="checkbox"
                                checked={selectedWorkersForGroup.includes(worker._id)}
                                readOnly
                            />
                        </li>
                    ))
                )}
            </ul>
            <div className="modal-footer">
                <button 
                    className="create-group-btn" 
                    onClick={handleProceedToGroupName} 
                    disabled={selectedWorkersForGroup.length === 0}
                >
                    Next
                </button>
            </div>
        </Modal>

        {/* Modal 2: Enter Group Name */}
        <Modal isOpen={isGroupNameModalOpen} onClose={() => setIsGroupNameModalOpen(false)} title="New Group">
            <input
                type="text"
                className="group-name-input"
                placeholder="Group Name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
            />
            <div className="modal-footer">
                <button 
                    className="create-group-btn" 
                    onClick={handleFinalizeGroup}
                >
                    Create Group
                </button>
            </div>
        </Modal>
    </>
    );
};

export default CommentManagement;