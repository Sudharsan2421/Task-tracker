import React, { useState, useEffect, useContext, useRef } from 'react';
import { toast } from 'react-toastify';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import {
  getMyComments,
  createComment,
  markCommentAdminRepliesAsRead,
} from '../../services/commentService';
import appContext from '../../context/AppContext';
import Spinner from '../common/Spinner';
import { useAuth } from '../../hooks/useAuth';

const Comments = () => {
  const { user } = useAuth(); 
  const { subdomain, worker } = useContext(appContext);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [unreadAdminCount, setUnreadAdminCount] = useState(0);
  const chatEndRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    fetchMessages();
  }, [subdomain, user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const interval = setInterval(fetchMessages, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchMessages = async () => {
    try {
      setIsLoading(true);
      const comments = await getMyComments();
      const flatMessages = [];

      comments.forEach((comment) => {
        flatMessages.push({
          _id: comment._id,
          sender: 'worker',
          text: comment.text,
          createdAt: comment.createdAt,
          commentId: comment._id,
          image: comment.workerImage || user?.imageUrl || null,
        });

        comment.replies?.forEach((reply) => {
          flatMessages.push({
            _id: `${comment._id}-${reply._id}`,
            sender: reply.isAdminReply ? 'admin' : 'worker',
            text: reply.text,
            createdAt: reply.createdAt,
            isNew: reply.isAdminReply && reply.isNew,
            commentId: comment._id,
            image: reply.adminImage || null,
          });
        });
      });

      const sorted = flatMessages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      setMessages(sorted);

      const unreadCount = sorted.filter((m) => m.sender === 'admin' && m.isNew).length;
      setUnreadAdminCount(unreadCount);
    } catch (err) {
      toast.error('Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    if (!subdomain || subdomain === 'main') {
      return toast.error('Invalid subdomain');
    }

    setIsSending(true);
    try {
      await createComment({ text: newMessage.trim(), subdomain });
      setNewMessage('');
      fetchMessages();
    } catch (err) {
      toast.error('Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const handleMarkAsRead = async (commentId) => {
    try {
      await markCommentAdminRepliesAsRead(commentId);
      fetchMessages();
    } catch (err) {
      toast.error('Failed to mark replies read');
    }
  };

  const formatTime = (d) => format(new Date(d), 'h:mm a');
  const formatDateLabel = (d) => {
    const date = parseISO(d);
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'dd MMM yyyy');
  };

  const getUserFirstLetter = () => {
    return user?.name ? user.name.charAt(0).toUpperCase() : '?';
  };
  
  const lastLoginTime = format(new Date(), "'Today,' h:mm a");

  const groupedMessages = messages.reduce((acc, msg) => {
    const day = formatDateLabel(msg.createdAt);
    if (!acc[day]) acc[day] = [];
    acc[day].push(msg);
    return acc;
  }, {});

  return (
    <div className="h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-7xl flex flex-row gap-6 h-[92vh]">
        
        {/* Profile Container */}
        <div className="w-1/3 bg-white rounded-xl shadow-lg p-8 border border-gray-200 flex flex-col">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Profile</h2>
            <div className="flex flex-col items-center text-center">
                <div className="w-24 h-24 rounded-full bg-purple-500 flex items-center justify-center text-white text-4xl font-bold mb-4">
                    {getUserFirstLetter()}
                </div>
                <h3 className="text-xl font-semibold text-gray-900">{user?.name || 'Employee Name'}</h3>
                <p className="text-md text-gray-600">{user?.username || ''}</p>
            </div>
            <div className="mt-8 space-y-5">
                <div>
                    <p className="text-sm text-gray-500">Employee ID</p>
                    <p className="font-semibold text-gray-700">{user?.rfid || 'N/A'}</p>
                </div>
                <div>
                    <p className="text-sm text-gray-500">Department</p>
                    {/* CORRECTION: Changed from user.department.name to user.department to display the value correctly. */}
                    <p className="font-semibold text-gray-700">{user?.department || 'N/A'}</p>
                </div>
                <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-semibold text-gray-700">{user?.email || 'N/A'}</p>
                </div>
                <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <p className="font-semibold text-gray-700">
                        <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-1 rounded-full">Active</span>
                    </p>
                </div>
                <div>
                    <p className="text-sm text-gray-500">Last Login</p>
                    <p className="font-semibold text-gray-700">{lastLoginTime}</p>
                </div>
            </div>
        </div>

        {/* Chat Container */}
        <div className="w-2/3 h-full bg-white rounded-xl shadow-lg flex flex-col overflow-hidden border border-gray-200">
          <div className="px-6 py-4 bg-white border-b border-gray-200 flex justify-between items-center rounded-t-xl">
            <h2 className="text-xl font-semibold text-gray-800">Chat with Admin</h2>
            {unreadAdminCount > 0 && (
              <div className="bg-green-500 text-white text-xs px-2 py-1 rounded-full shadow">
                {unreadAdminCount} New
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 bg-white">
            {isLoading ? (
              <div className="flex justify-center items-center h-full">
                <Spinner size="lg" />
              </div>
            ) : Object.keys(groupedMessages).length === 0 ? (
              <p className="text-gray-500 text-center py-10">No messages yet. Start a conversation!</p>
            ) : (
              Object.entries(groupedMessages).map(([date, msgs]) => (
                <div key={date}>
                  <div className="relative my-6 text-center">
                    <span className="inline-block bg-white px-3 text-xs text-gray-400 z-10 relative">
                      {date}
                    </span>
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                      <div className="w-full border-t border-gray-200" />
                    </div>
                  </div>
                  {msgs.map((msg) => (
                    <div
                      key={msg._id}
                      className={`mb-3 flex items-start ${msg.sender === 'worker' ? 'justify-end' : 'justify-start'}`}
                      onClick={() =>
                        msg.sender === 'admin' && msg.isNew && handleMarkAsRead(msg.commentId)
                      }
                    >
                      {msg.sender === 'admin' && (
                        <div className="w-8 h-8 rounded-full mr-2 bg-gray-300 flex items-center justify-center text-gray-600 text-sm font-bold flex-shrink-0">
                          A
                        </div>
                      )}
                      <div
                        className={`max-w-[75%] px-3 py-2 rounded-xl text-sm shadow-sm ${
                          msg.sender === 'worker'
                            ? 'bg-blue-500 text-white rounded-br-none'
                            : 'bg-gray-200 text-gray-800 rounded-bl-none'
                        }`}
                      >
                        <p className="break-words">{msg.text}</p>
                        <p
                          className={`text-[10px] text-right mt-1 ${
                            msg.sender === 'worker' ? 'text-blue-200' : 'text-gray-500'
                          }`}
                        >
                          {formatTime(msg.createdAt)}
                        </p>
                      </div>
                      {msg.sender === 'worker' && (
                        <div className="w-8 h-8 rounded-full ml-2 bg-purple-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                          {getUserFirstLetter()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-200 flex items-center space-x-3">
            <input
              type="text"
              className="flex-1 bg-gray-100 border border-gray-300 px-4 py-2 rounded-full focus:outline-none focus:border-blue-400 text-gray-700 placeholder-gray-400 text-sm"
              placeholder="Write your message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || isSending}
              className="bg-blue-500 text-white p-2 rounded-full shadow-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              aria-label="Send message"
            >
              {isSending ? (
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l.684-.275a1 1 0 00.579-.933V8.5a1 1 0 011-1h6.5a1 1 0 011 1v7.167a1 1 0 00.579.933l.684.275a1 1 0 001.169-1.409l-7-14z" />
                </svg>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Comments;