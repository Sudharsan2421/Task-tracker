import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { getAllComments, addReply } from '../../services/commentService';
import { getWorkers } from '../../services/workerService';
import Spinner from '../common/Spinner';
import Modal from '../common/Modal';
import appContext from '../../context/AppContext';

// --- SVG Icons for the UI ---
const SendIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>;
const SearchIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>;
const MoreIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>;
const GroupIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>;
const CloseIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>;
const NewMessageIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path><line x1="8" y1="9" x2="16" y2="9"></line><line x1="8" y1="13" x2="14" y2="13"></line></svg>;

const WorkerProfilePanel = ({ worker, onClose }) => (
    <aside className="worker-profile-panel">
        <div className="profile-header">
            <h2>Profile</h2>
            <button onClick={onClose} className="icon-btn close-btn">
                <CloseIcon />
            </button>
        </div>
        <div className="profile-content">
            <div className="profile-avatar-large">
                {worker.name ? worker.name.charAt(0).toUpperCase() : '?'}
            </div>
            <div className="profile-info">
                <h3>{worker.name || 'Worker Name'}</h3>
                <p className="profile-username">{worker.username || 'No username'}</p>
            </div>
            <div className="profile-details-list">
                <div>
                    <p className="detail-label">Employee ID</p>
                    <p className="detail-value">{worker.employeeId || 'N/A'}</p>
                </div>
                <div>
                    <p className="detail-label">Department</p>
                    <p className="detail-value">{worker.department?.name || 'N/A'}</p>
                </div>
                <div>
                    <p className="detail-label">Email</p>
                    <p className="detail-value">{worker.email || 'N/A'}</p>
                </div>
                <div>
                    <p className="detail-label">Status</p>
                    <p className="detail-value status-active">Active</p>
                </div>
            </div>
        </div>
    </aside>
);

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
            --active-status-bg: #E0F2F1;
            --active-status-text: #00796B;
        }
        .admin-chat-container * { box-sizing: border-box; }
        .admin-chat-container {
            font-family: 'Poppins', sans-serif; display: flex; width: 100%; max-width: 1400px; height: 90vh; max-height: 800px;
            background-color: var(--container-bg); border-radius: 40px; box-shadow: 0 10px 40px var(--shadow-color); overflow: hidden; margin: auto; transition: background-color 0.3s;
        }
        .admin-sidebar { width: 30%; max-width: 320px; padding: 30px; display: flex; flex-direction: column; align-items: flex-start; border-right: 1px solid var(--border-color); transition: background-color 0.3s, border-color 0.3s; flex-shrink: 0; }
        .admin-sidebar-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; width: 100%; }
        .admin-sidebar-header h2 { font-size: 24px; font-weight: 600; color: var(--text-dark); }
        .admin-search-bar { position: relative; margin-bottom: 20px; width: 100%; max-width: 300px; }
        .admin-search-bar input { width: 100%; padding: 10px 40px 10px 20px; border-radius: 20px; border: none; background-color: var(--background-color); font-size: 14px; text-align: center; color: var(--text-dark); }
        .admin-search-bar svg { position: absolute; right: 15px; top: 50%; transform: translateY(-50%); color: var(--text-light); }
        .admin-filter-bar { display: flex; justify-content: flex-start; gap: 10px; margin-bottom: 20px; width: 100%; }
        .admin-filter-bar button { background: none; border: none; color: var(--text-light); font-weight: 500; cursor: pointer; padding: 5px 10px; border-radius: 15px; font-size: 12px; }
        .admin-filter-bar button.active { background-color: var(--primary-color); color: var(--text-white); }
        .employee-list { flex-grow: 1; overflow-y: auto; width: 100%; }
        .employee-list ul { list-style-type: none; padding: 0; width: 100%; }
        .employee-item { display: flex; align-items: center; padding: 15px; border-radius: 20px; margin-bottom: 10px; cursor: pointer; transition: background-color 0.2s ease; position: relative; width: 100%; }
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
        
        /* Selection mode styles */
        .selection-checkbox {
            margin-right: 12px;
            width: 18px;
            height: 18px;
            accent-color: var(--primary-color);
        }
        .delete-selected-btn {
            background: none;
            border: none;
            color: var(--primary-color);
            font-weight: 600;
            cursor: pointer;
            margin-right: 10px;
            padding: 5px 10px;
            border-radius: 4px;
        }
        .delete-selected-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .delete-selected-btn:hover:not(:disabled) {
            background-color: rgba(254, 58, 130, 0.1);
        }
        
        .admin-chat-panel { flex-grow: 1; display: flex; flex-direction: column; background-color: var(--chat-panel-bg); position: relative; }
        .admin-chat-header { padding: 20px 30px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-color); background-color: var(--container-bg); transition: background-color 0.3s, border-color 0.3s; }
        .admin-chat-header .contact-info { display: flex; align-items: center; }
        .admin-chat-header .contact-info .group-avatar-header { width: 40px; height: 40px; border-radius: 50%; margin-right: 15px; background-color: #e0e0e0; display: flex; align-items: center; justify-content: center; color: #555;}
        .admin-chat-header .contact-info img { width: 40px; height: 40px; border-radius: 50%; margin-right: 15px; object-fit: cover; }
        .admin-chat-header .contact-details { display: flex; flex-direction: column; }
        .admin-chat-header .contact-name { font-weight: 600; color: var(--text-dark); }
        .admin-chat-header .contact-status { font-size: 13px; color: var(--text-light); }
        .admin-message-area { flex-grow: 1; padding: 30px; overflow-y: auto; display: flex; flex-direction: column; gap: 5px; }
        .message { display: flex; gap: 15px; max-width: 65%; margin-bottom: 15px; }
        .message.incoming { align-self: flex-start; }
        .message.outgoing { align-self: flex-end; flex-direction: row-reverse; }
        .message-content { padding: 15px 20px; border-radius: 25px; font-size: 15px; box-shadow: 0 4px 10px var(--shadow-color); color: var(--text-dark); }
        .message.incoming .message-content { background-color: var(--incoming-msg-bg); border-top-left-radius: 5px; }
        .message.outgoing .message-content { background-color: var(--outgoing-msg-bg); color: var(--text-white); border-top-right-radius: 5px; }
        .message-time { font-size: 11px; margin-top: 8px; text-align: right; color: var(--text-light); }
        .message.outgoing .message-time { color: rgba(255, 255, 255, 0.7); }
        .message-avatar { width: 40px; height: 40px; border-radius: 50%; align-self: flex-end; font-weight: 600; display: flex; justify-content: center; align-items: center; background-color: #ccc; color: #333;}
        .admin-chat-footer { padding: 15px 30px; background-color: var(--container-bg); border-top: 1px solid var(--border-color); }
        .message-form { display: flex; align-items: center; gap: 15px; background-color: var(--chat-panel-bg); padding: 8px; border-radius: 15px; }
        .message-form input { flex-grow: 1; border: none; background: transparent; padding: 10px; font-size: 15px; outline: none; color: var(--text-dark); }
        .send-btn { background-color: var(--primary-color); color: var(--text-white); border-radius: 50%; width: 45px; height: 45px;}
        .no-chat-selected { display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%; color: var(--text-light); }
        .no-chat-selected h2 { font-size: 22px; font-weight: 600; margin-bottom: 10px; }
        .date-separator { text-align: center; margin: 20px 0; color: var(--text-light); font-size: 12px; position: relative; }
        .date-separator span { background-color: var(--chat-panel-bg); padding: 0 10px; position: relative; z-index: 1; }
        .date-separator::before { content: ''; position: absolute; left: 0; top: 50%; width: 100%; height: 1px; background-color: var(--border-color); z-index: 0; }
        .attachment { margin-top: 5px; }
        .attachment-preview { max-width: 100%; border-radius: 15px; cursor: pointer; }
        
        .new-chat-button {
            margin-top: 20px;
            background-color: var(--primary-color);
            color: var(--text-white);
            border-radius: 50%;
            width: 60px;
            height: 60px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(254, 58, 130, 0.4);
            cursor: pointer;
            border: none;
            transition: transform 0.2s ease-in-out;
            align-self: flex-end;
        }

        .new-chat-button:hover {
            transform: scale(1.1);
        }

        /* Dropdown Styles */
        .header-actions, .chat-header-actions { position: relative; }
        .dropdown-menu {
            position: absolute; top: calc(100% + 5px); right: 0; background-color: var(--container-bg);
            border: 1px solid var(--border-color); border-radius: 12px; box-shadow: 0 5px 20px var(--shadow-color);
            width: 180px; z-index: 10; overflow: visible; padding: 8px 0;
        }
        .dropdown-menu ul { list-style: none; padding: 0; margin: 0; }
        .dropdown-item { padding: 12px 20px; cursor: pointer; font-size: 14px; font-weight: 500; color: var(--text-dark); transition: background-color 0.2s ease; display: flex; justify-content: space-between; align-items: center; }
        .dropdown-item:hover { background-color: var(--background-color); }
        .dropdown-item.has-submenu { position: relative; }

        /* Theme Submenu Styles */
        .dropdown-submenu {
            position: absolute; left: 100%; top: -8px; 
            background-color: var(--container-bg); border: 1px solid var(--border-color); border-radius: 12px;
            box-shadow: 0 5px 20px var(--shadow-color); width: 150px; z-index: 11; padding: 8px 0;
        }

        /* --- Worker Profile Panel Styles --- */
        .worker-profile-panel {
            width: 30%; max-width: 320px; padding: 30px; display: flex; flex-direction: column;
            background-color: var(--sidebar-bg); border-left: 1px solid var(--border-color);
            transition: all 0.3s ease; flex-shrink: 0;
        }
        .profile-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
        .profile-header h2 { font-size: 24px; font-weight: 600; color: var(--text-dark); }
        .close-btn { color: var(--text-light); }
        .profile-content { display: flex; flex-direction: column; align-items: center; text-align: center; }
        .profile-avatar-large {
            width: 90px; height: 90px; border-radius: 50%; background-color: var(--primary-color);
            display: flex; align-items: center; justify-content: center; color: white;
            font-size: 40px; font-weight: bold; margin-bottom: 16px;
        }
        .profile-info h3 { font-size: 20px; font-weight: 600; color: var(--text-dark); }
        .profile-username { font-size: 14px; color: var(--text-light); margin-bottom: 24px; }
        .profile-details-list { width: 100%; text-align: left; }
        .profile-details-list > div { margin-bottom: 18px; }
        .detail-label { font-size: 13px; color: var(--text-light); margin-bottom: 4px; }
        .detail-value { font-weight: 500; color: var(--text-dark); font-size: 15px;}
        .status-active { 
            background-color: var(--active-status-bg); color: var(--active-status-text); 
            font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 12px; display: inline-block;
        }

        /* Dark Theme Styles */
        .admin-chat-container.dark-theme {
            --background-color: #1a1a1a; --container-bg: #242424; --sidebar-bg: #242424;
            --chat-panel-bg: #1e1e1e; --incoming-msg-bg: #3a3a3a; --text-dark: #FFFFFF;
            --text-light: #b0b0b0; --border-color: #3f3f3f; 
            --active-status-bg: #004D40; --active-status-text: #B2DFDB;
        }

        /* "New Chat" Modal Styles */
        .new-chat-modal .modal-content {
            width: 90%;
            max-width: 600px;
        }
        
        .new-chat-worker-list { list-style: none; padding: 0; margin: 0; max-height: 40vh; overflow-y: auto; }
        .new-chat-worker-item { display: flex; align-items: center; padding: 10px 5px; border-bottom: 1px solid var(--border-color); cursor: pointer; }
        .new-chat-worker-item:last-child { border-bottom: none; }
        .new-chat-worker-item img { width: 40px; height: 40px; border-radius: 50%; margin-right: 15px; object-fit: cover; }
        .new-chat-worker-item span { font-weight: 500; color: var(--text-dark); flex-grow: 1; }
        .new-chat-worker-item:hover { background-color: var(--background-color); border-radius: 8px;}
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
    const [filter, setFilter] = useState('All');
    const [unreadCounts, setUnreadCounts] = useState({});
    const [lastReadTimestamps, setLastReadTimestamps] = useState({});
    const [isSidebarDropdownOpen, setIsSidebarDropdownOpen] = useState(false);
    const sidebarDropdownRef = useRef(null);
    const [isChatDropdownOpen, setIsChatDropdownOpen] = useState(false);
    const chatDropdownRef = useRef(null);
    const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
    const [isProfileVisible, setIsProfileVisible] = useState(false);
    const [theme, setTheme] = useState(localStorage.getItem('chatTheme') || 'light');
    const [isThemeSubmenuOpen, setIsThemeSubmenuOpen] = useState(false);
    
    // State for selection mode and persistent deletion
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedWorkers, setSelectedWorkers] = useState([]);
    const [deletedWorkerIds, setDeletedWorkerIds] = useState(
        JSON.parse(localStorage.getItem(`deletedWorkerIds_${subdomain}`) || '[]')
    );

    useEffect(() => {
        const chatContainer = document.querySelector('.admin-chat-container');
        if (chatContainer) {
            chatContainer.classList.remove('light-theme', 'dark-theme');
            chatContainer.classList.add(`${theme}-theme`);
        }
        localStorage.setItem('chatTheme', theme);
    }, [theme]);

    useEffect(() => {
        const savedTimestamps = JSON.parse(localStorage.getItem(`lastReadTimestamps_${subdomain}`) || '{}');
        setLastReadTimestamps(savedTimestamps);
    }, [subdomain]);

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

    const calculateUnreadCounts = useCallback(() => {
        const counts = {};
        
        chatList.forEach(chat => {
            if (chat.isGroup) {
                counts[chat._id] = 0;
            } else {
                const workerComments = comments.filter(c => c.worker?._id === chat._id);
                const lastReadTime = lastReadTimestamps[chat._id] || 0;
                let unreadCount = 0;
                workerComments.forEach(comment => {
                    const commentTime = new Date(comment.createdAt).getTime();
                    if (commentTime > lastReadTime) unreadCount++;
                    comment.replies?.forEach(reply => {
                        const replyTime = new Date(reply.createdAt).getTime();
                        if (replyTime > lastReadTime && reply.isAdminReply !== true) unreadCount++;
                    });
                });
                counts[chat._id] = unreadCount;
            }
        });
        
        setUnreadCounts(counts);
    }, [chatList, comments, lastReadTimestamps]);

    useEffect(() => {
        calculateUnreadCounts();
    }, [calculateUnreadCounts]);

    const markChatAsRead = useCallback((chatId) => {
        const now = Date.now();
        const updatedTimestamps = { ...lastReadTimestamps, [chatId]: now };
        setLastReadTimestamps(updatedTimestamps);
        localStorage.setItem(`lastReadTimestamps_${subdomain}`, JSON.stringify(updatedTimestamps));
        setUnreadCounts(prev => ({ ...prev, [chatId]: 0 }));
    }, [lastReadTimestamps, subdomain]);

    const handleChatSelect = (chat) => {
        if (isSelectionMode) return;
        if (deletedWorkerIds.includes(chat._id)) {
            setSelectedChat(null);
            return;
        }
        setSelectedChat(chat);
        setIsProfileVisible(false);
        setIsNewChatModalOpen(false);
        if (!chat.isGroup && unreadCounts[chat._id] > 0) {
            markChatAsRead(chat._id);
        }
    };

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [commentsData, workersData] = await Promise.all([
                getAllComments({ subdomain }),
                getWorkers({ subdomain })
            ]);
            
            const safeComments = Array.isArray(commentsData) ? commentsData : [];
            const safeWorkers = Array.isArray(workersData) ? workersData : [];
            
            setAllWorkers(safeWorkers);

            const currentDeletedIds = JSON.parse(localStorage.getItem(`deletedWorkerIds_${subdomain}`) || '[]');
            const filteredComments = safeComments.filter(c => c.worker && !currentDeletedIds.includes(c.worker._id));

            setComments(filteredComments);
            
            const commentingWorkersMap = new Map();
            filteredComments.forEach(comment => {
                if (comment.worker && !commentingWorkersMap.has(comment.worker._id)) {
                    if (comment.worker.name !== "Unknown Worker") {
                        commentingWorkersMap.set(comment.worker._id, { ...comment.worker, isGroup: false });
                    }
                }
            });
            
            const savedGroups = JSON.parse(localStorage.getItem(`chatGroups_${subdomain}`) || '[]');
            setChatList([...savedGroups, ...Array.from(commentingWorkersMap.values())]);
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
                    id: comment._id, 
                    text: comment.text, 
                    createdAt: new Date(comment.createdAt),
                    isWorker: true, 
                    attachment: comment.attachment
                });
                comment.replies?.forEach(reply => {
                    messages.push({
                        id: reply._id, 
                        text: reply.text, 
                        createdAt: new Date(reply.createdAt),
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

    const handleReadAll = () => {
        const updatedTimestamps = { ...lastReadTimestamps };
        const now = Date.now();

        chatList.forEach(chat => {
            if (!chat.isGroup) {
                updatedTimestamps[chat._id] = now;
            }
        });

        setLastReadTimestamps(updatedTimestamps);
        localStorage.setItem(`lastReadTimestamps_${subdomain}`, JSON.stringify(updatedTimestamps));

        setIsSidebarDropdownOpen(false);
        toast.success("All messages marked as read.");
    };

    const handleDeleteSelected = () => {
        if (selectedWorkers.length === 0) {
            toast.warn('No workers selected');
            return;
        }

        const newDeletedWorkerIds = [...deletedWorkerIds, ...selectedWorkers];
        setDeletedWorkerIds(newDeletedWorkerIds);
        localStorage.setItem(`deletedWorkerIds_${subdomain}`, JSON.stringify(newDeletedWorkerIds));
        
        const updatedChatList = chatList.filter(chat => !selectedWorkers.includes(chat._id));
        const updatedAllWorkers = allWorkers.filter(worker => !selectedWorkers.includes(worker._id));
        const updatedComments = comments.filter(comment => comment.worker && !selectedWorkers.includes(comment.worker._id));
        
        setChatList(updatedChatList);
        setAllWorkers(updatedAllWorkers);
        setComments(updatedComments);

        setSelectedWorkers([]);
        setIsSelectionMode(false);
        
        if (selectedChat && selectedWorkers.includes(selectedChat._id)) {
            setSelectedChat(null);
        }
        
        toast.success(`Deleted ${selectedWorkers.length} worker(s)`);
    };

    const handleWorkerSelection = (workerId) => {
        setSelectedWorkers(prev => 
            prev.includes(workerId) 
                ? prev.filter(id => id !== workerId) 
                : [...prev, workerId]
        );
    };

    const toggleSelectionMode = () => {
        setIsSelectionMode(!isSelectionMode);
        if (!isSelectionMode) {
            setSelectedWorkers([]);
        }
        setIsSidebarDropdownOpen(false);
    };

    const handleNewChatClick = () => {
        setIsNewChatModalOpen(true);
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

    const filteredChatList = chatList.filter(chat => {
        if (!chat.isGroup && chat.name === "Unknown Worker") return false;
        if (filter === 'Unread') return !chat.isGroup && unreadCounts[chat._id] > 0;
        if (filter === 'Groups') return chat.isGroup;
        return true;
    }).filter(chat =>
        (chat.name || '').toLowerCase().includes(searchTerm.toLowerCase())
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
                            {isSelectionMode && (
                                <button 
                                    className="delete-selected-btn"
                                    onClick={handleDeleteSelected}
                                    disabled={selectedWorkers.length === 0}
                                >
                                    Delete ({selectedWorkers.length})
                                </button>
                            )}
                            <button 
                                onClick={() => setIsSidebarDropdownOpen(!isSidebarDropdownOpen)} 
                                className="icon-btn"
                            >
                                <MoreIcon />
                            </button>
                            {isSidebarDropdownOpen && (
                                <div className="dropdown-menu">
                                    <ul>
                                        <li className="dropdown-item" onClick={handleNewChatClick}>New Chat</li>
                                        <li className="dropdown-item" onClick={handleReadAll}>Read All</li>
                                        <li className="dropdown-item has-submenu" onClick={() => setIsThemeSubmenuOpen(!isThemeSubmenuOpen)}>
                                            <span>Theme</span>
                                            <span>&gt;</span>
                                            {isThemeSubmenuOpen && (
                                                <div className="dropdown-submenu" onClick={(e) => e.stopPropagation()}>
                                                    <ul>
                                                        <li className="dropdown-item" onClick={() => { setTheme('light'); setIsSidebarDropdownOpen(false); }}>Light Mode</li>
                                                        <li className="dropdown-item" onClick={() => { setTheme('dark'); setIsSidebarDropdownOpen(false); }}>Dark Mode</li>
                                                    </ul>
                                                </div>
                                            )}
                                        </li>
                                        <li className="dropdown-item" onClick={toggleSelectionMode}>
                                            {isSelectionMode ? 'Cancel Selection' : 'Select'}
                                        </li>
                                        <li className="dropdown-item" onClick={() => toast.info('Setting feature coming soon!')}>Setting</li>
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="admin-search-bar">
                        <input type="text" placeholder="Search Name" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        <SearchIcon />
                    </div>
                    <div className="admin-filter-bar">
                        <button className={filter === 'All' ? 'active' : ''} onClick={() => setFilter('All')}>All</button>
                        <button className={filter === 'Unread' ? 'active' : ''} onClick={() => setFilter('Unread')}>Unread</button>
                        <button className={filter === 'Groups' ? 'active' : ''} onClick={() => setFilter('Groups')}>Groups</button>
                    </div>
                    <nav className="employee-list">
                        {isLoading ? <Spinner /> : (
                            <ul>
                                {filteredChatList.map(chat => (
                                    <li 
                                        key={chat._id} 
                                        className={`employee-item ${selectedChat?._id === chat._id ? 'active' : ''}`}
                                        onClick={() => handleChatSelect(chat)}
                                    >
                                        {isSelectionMode && (
                                            <input
                                                type="checkbox"
                                                className="selection-checkbox"
                                                checked={selectedWorkers.includes(chat._id)}
                                                onChange={() => handleWorkerSelection(chat._id)}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        )}
                                        {chat.isGroup ? 
                                            <div className="group-avatar"><GroupIcon /></div> : 
                                            <img src={chat.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(chat.name || '')}&background=random`} alt={chat.name || ''} />
                                        }
                                        <div className="employee-details">
                                            <span className="employee-name">{chat.name || ''}</span>
                                            <span className="employee-last-message">
                                                {chat.isGroup ? `${chat.members.length} members` : (chat.department?.name || 'Unassigned')}
                                            </span>
                                        </div>
                                        {!chat.isGroup && !isSelectionMode && unreadCounts[chat._id] > 0 && 
                                            <div className="unread-badge">{unreadCounts[chat._id] > 99 ? '99+' : unreadCounts[chat._id]}</div>
                                        }
                                    </li>
                                ))}
                            </ul>
                        )}
                    </nav>
                    <button onClick={handleNewChatClick} className="new-chat-button">
                        <NewMessageIcon />
                    </button>
                </aside>
                <main className="admin-chat-panel">
                    {selectedChat ? (
                        <>
                            <header className="admin-chat-header">
                                <div className="contact-info">
                                    {selectedChat.isGroup ? 
                                        <div className="group-avatar-header"><GroupIcon /></div> : 
                                        <img src={selectedChat.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedChat.name || '')}&background=random`} alt={selectedChat.name || ''}/>
                                    }
                                    <div className="contact-details">
                                        <span className="contact-name">{selectedChat.name || ''}</span>
                                        <span className="contact-status">
                                            {selectedChat.isGroup ? 
                                                selectedChat.members.map(m => m.name.split(' ')[0]).join(', ') : 
                                                `Department: ${selectedChat.department?.name || 'N/A'}`
                                            }
                                        </span>
                                    </div>
                                </div>
                                <div className="chat-header-actions" ref={chatDropdownRef}>
                                    <button onClick={() => setIsChatDropdownOpen(!isChatDropdownOpen)} className="icon-btn"><MoreIcon /></button>
                                    {isChatDropdownOpen && (
                                        <div className="dropdown-menu">
                                            <ul>
                                                <li className="dropdown-item" onClick={() => {
                                                    if (selectedChat && !selectedChat.isGroup) {
                                                        setIsProfileVisible(true);
                                                    } else {
                                                        toast.info("Profile available for individual workers only.");
                                                    }
                                                    setIsChatDropdownOpen(false);
                                                }}>Worker Info</li>
                                                <li className="dropdown-item" onClick={() => toast.info('Delete Chat feature coming soon.')}>Delete Chat</li>
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
                                                    {msg.isWorker && msg.attachment && <div className="attachment"><img src={msg.attachment.data} alt={msg.attachment.name || 'attachment'} className="attachment-preview" /></div>}
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
                                    <input type="text" placeholder="Type a message here..." value={replyText} onChange={(e) => setReplyText(e.target.value)} disabled={selectedChat.isGroup} />
                                    <button type="submit" className="icon-btn send-btn" disabled={selectedChat.isGroup}><SendIcon /></button>
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
                
                {isProfileVisible && selectedChat && <WorkerProfilePanel worker={selectedChat} onClose={() => setIsProfileVisible(false)} />}
            </div>
            
            <Modal isOpen={isNewChatModalOpen} onClose={() => setIsNewChatModalOpen(false)} title="New Chat" className="new-chat-modal">
                <ul className="new-chat-worker-list">
                    {isLoading ? <Spinner /> : allWorkers.map(worker => (
                        <li key={worker._id} className="new-chat-worker-item" onClick={() => handleChatSelect(worker)}>
                            <img src={worker.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(worker.name || '')}&background=random`} alt={worker.name || ''} />
                            <span>{worker.name || ''}</span>
                        </li>
                    ))}
                </ul>
            </Modal>
        </>
    );
};

export default CommentManagement;