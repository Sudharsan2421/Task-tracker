import { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { getAllComments, addReply, markCommentsAsRead } from '../../services/commentService';
import Card from '../common/Card';
import Button from '../common/Button';
import Modal from '../common/Modal';
import Spinner from '../common/Spinner';
import appContext from '../../context/AppContext';

const CommentManagement = () => {
  const [comments, setComments] = useState([]);
  const [filteredComments, setFilteredComments] = useState([]);
  const [filteredWorkers, setFilteredWorkers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [selectedAttachment, setSelectedAttachment] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [isViewAttachmentModalOpen, setIsViewAttachmentModalOpen] = useState(false);
  const { subdomain } = useContext(appContext);
  const chatContainerRef = useRef(null);
  const lastViewedTime = useRef({}); // Track last viewed time per worker

  // Calculate unread count for a specific worker based on last viewed time
  const calculateUnreadCount = useCallback((workerId, commentsArray) => {
    const lastViewed = lastViewedTime.current[workerId] || new Date(0);
    return commentsArray
      .filter(comment => comment.worker?._id === workerId)
      .reduce((total, comment) => {
        const unreadComment = new Date(comment.createdAt) > lastViewed && comment.isNew ? 1 : 0;
        const unreadReplies = comment.replies?.filter(r => new Date(r.createdAt) > lastViewed && r.isNew).length || 0;
        return total + unreadComment + unreadReplies;
      }, 0);
  }, []);

  // Update filtered workers with current unread counts
  const updateFilteredWorkers = useCallback((commentsArray) => {
    if (!Array.isArray(commentsArray) || commentsArray.length === 0) {
      setFilteredWorkers([]);
      return;
    }

    const workersWithCounts = [
      ...new Map(
        commentsArray
          .filter(comment => comment.worker && comment.worker._id && comment.worker.name)
          .map(comment => [comment.worker._id, {
            _id: comment.worker._id,
            name: comment.worker.name,
            department: comment.worker.department?.name || 'Unassigned',
            unreadCount: calculateUnreadCount(comment.worker._id, commentsArray)
          }])
      ).values()
    ].sort((a, b) => getFirstName(a.name).localeCompare(getFirstName(b.name)));

    setFilteredWorkers(workersWithCounts);
  }, [calculateUnreadCount]);

  // Load all comments
  useEffect(() => {
    const loadComments = async () => {
      setIsLoading(true);
      try {
        console.log('Loading comments for subdomain:', subdomain);
        const commentsData = await getAllComments({ subdomain });
        const safeComments = Array.isArray(commentsData) ? commentsData : [];
        console.log('Comments with worker data:', safeComments);
        setComments(safeComments);
        setFilteredComments(safeComments);
        updateFilteredWorkers(safeComments);
      } catch (error) {
        toast.error('Failed to load comments');
        console.error(error);
        setComments([]);
        setFilteredComments([]);
        setFilteredWorkers([]);
      } finally {
        setIsLoading(false);
      }
    };
    loadComments();
  }, [subdomain, updateFilteredWorkers]);

  // Filter comments and sort messages, and auto-scroll
  useEffect(() => {
    if (!Array.isArray(comments)) {
      console.error('Comments is not an array:', comments);
      setFilteredComments([]);
      return;
    }

    let filtered = comments.filter(comment => {
      if (!selectedWorker) return false;
      return comment.worker?._id === selectedWorker;
    });

    const allMessagesForSelectedWorker = [];
    filtered.forEach(comment => {
      allMessagesForSelectedWorker.push({
        id: comment._id,
        text: comment.text,
        createdAt: new Date(comment.createdAt),
        isWorker: true,
        attachment: comment.attachment,
        type: 'comment',
        isNew: comment.isNew
      });
      comment.replies?.forEach(reply => {
        allMessagesForSelectedWorker.push({
          id: reply._id,
          text: reply.text,
          createdAt: new Date(reply.createdAt),
          isWorker: reply.isWorker,
          type: 'reply',
          parentId: comment._id,
          isNew: reply.isNew
        });
      });
    });

    allMessagesForSelectedWorker.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    setFilteredComments(allMessagesForSelectedWorker);

    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [comments, selectedWorker]);

  // Mark comments and replies as read and update last viewed time
  const markWorkerCommentsAsRead = async (workerId) => {
    try {
      const now = new Date();
      await markCommentsAsRead(workerId, { subdomain });
      
      lastViewedTime.current[workerId] = now; // Update last viewed time
      
      const updatedComments = comments.map(comment => {
        if (comment.worker?._id === workerId) {
          return {
            ...comment,
            isNew: false,
            replies: comment.replies?.map(reply => ({
              ...reply,
              isNew: false
            })) || []
          };
        }
        return comment;
      });
      
      setComments(updatedComments);
      updateFilteredWorkers(updatedComments);
      
      console.log(`All messages for worker ${workerId} marked as read at ${now}.`);
    } catch (error) {
      toast.error('Failed to mark messages as read');
      console.error('Error marking messages as read:', error);
    }
  };

  // Handle worker selection
  const handleWorkerClick = (workerId) => {
    const isSelectingSameWorker = workerId === selectedWorker;
    setSelectedWorker(isSelectingSameWorker ? null : workerId);
    
    if (!isSelectingSameWorker && workerId !== selectedWorker) {
      markWorkerCommentsAsRead(workerId);
    }
  };

  // Open attachment modal
  const openAttachmentModal = (attachment) => {
    setSelectedAttachment(attachment);
    setIsViewAttachmentModalOpen(true);
  };

  // Submit reply
  const handleSubmitReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim()) {
      toast.error('Please enter a reply');
      return;
    }

    try {
      const commentToReplyTo = comments.find(c => c.worker?._id === selectedWorker);
      
      if (!commentToReplyTo || !commentToReplyTo._id) {
        toast.error('Could not find a comment to reply to.');
        console.error('Debug - Selected Worker:', selectedWorker);
        console.error('Debug - Available Comments:', comments.map(c => ({ id: c._id, workerId: c.worker?._id, workerName: c.worker?.name })));
        return;
      }

      const replyPayload = {
        text: replyText,
        isWorker: false
      };

      console.log('Replying to comment:', commentToReplyTo._id);
      const updatedComment = await addReply(commentToReplyTo._id, replyPayload);
      
      const updatedComments = comments.map(comment =>
        comment._id === commentToReplyTo._id ? updatedComment : comment
      );
      
      setComments(updatedComments);
      updateFilteredWorkers(updatedComments);
      
      setReplyText('');
      toast.success('Reply sent successfully');
    } catch (error) {
      console.error('Reply error:', error);
      toast.error(error.message || 'Failed to send reply');
    }
  };

  // Format date and time
  const formatDateHeader = (dateString) => {
    try {
      return format(new Date(dateString), 'EEEE, MMMM dd, yyyy');
    } catch (error) {
      return dateString;
    }
  };

  const formatTime = (dateString) => {
    try {
      return format(new Date(dateString), 'h:mm a');
    } catch (error) {
      return dateString;
    }
  };

  // Get first name
  const getFirstName = (fullName) => {
    if (!fullName) return 'Unknown';
    return fullName.split(' ')[0];
  };

  return (
    <div className="flex h-screen">
      {/* Left Sidebar - Employee List */}
      <div className="w-1/4 bg-gray-100 p-4 overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">Employees</h2>
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Spinner size="md" />
          </div>
        ) : filteredWorkers.length === 0 ? (
          <div className="text-center text-gray-500 py-4">
            No employees with comments found.
          </div>
        ) : (
          <div className="space-y-2">
            {filteredWorkers.map(worker => (
              <div
                key={worker._id}
                className={`p-3 rounded-md cursor-pointer ${
                  selectedWorker === worker._id ? 'bg-blue-500 text-white' : 'hover:bg-gray-200'
                } flex justify-between items-center`}
                onClick={() => handleWorkerClick(worker._id)}
              >
                <div>
                  <p className="font-medium">{getFirstName(worker.name)}</p>
                  <p className={`text-xs ${selectedWorker === worker._id ? 'text-blue-100' : 'text-gray-500'}`}>
                    {worker.department}
                  </p>
                </div>
                {worker.unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {worker.unreadCount}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right Panel - Chat Area */}
      <div className="w-3/4 bg-white flex flex-col">
        {selectedWorker ? (
          filteredComments.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
              <h2 className="text-lg font-semibold mb-2">No Comments Yet</h2>
              <p>Start a conversation with this employee.</p>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              {/* Chat Header with Blue Background */}
              <div className="bg-blue-600 text-white p-4 rounded-t-lg shadow-md">
                <h2 className="text-xl font-bold">
                  {getFirstName(comments.find(c => c.worker?._id === selectedWorker)?.worker?.name)}
                </h2>
                <p className="text-sm">
                  {comments.find(c => c.worker?._id === selectedWorker)?.worker?.department?.name || 'Unassigned'} Department
                </p>
              </div>

              <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto p-4"
                style={{ maxHeight: 'calc(100vh - 200px)' }}
              >
                {Object.entries(
                  filteredComments.reduce((acc, message) => {
                    const date = formatDateHeader(message.createdAt);
                    if (!acc[date]) acc[date] = [];
                    acc[date].push(message);
                    return acc;
                  }, {})
                ).map(([date, dayMessages]) => (
                  <div key={date}>
                    <div className="text-center text-gray-500 py-2">{date}</div>
                    {dayMessages.map((message) => (
                      <div key={message.id}>
                        {message.isWorker ? (
                          <div
                            className={`p-3 rounded-lg mb-2 max-w-[45%] ${message.isNew ? 'bg-gray-100' : 'bg-gray-50'} ml-auto text-gray-800`}
                          >
                            <div className="flex justify-between items-baseline mb-1">
                              <p className="font-medium text-sm">{getFirstName(comments.find(c => c._id === (message.type === 'reply' ? message.parentId : message.id))?.worker?.name)}</p>
                              <p className="text-xs text-gray-500">{formatTime(message.createdAt)}</p>
                            </div>
                            <p className="text-sm">{message.text || 'No message text'}</p>
                            {message.attachment && message.type === 'comment' && (
                              <div className="mt-2">
                                <div className="flex items-center mb-1">
                                  <p className="text-sm font-medium text-gray-700">
                                    {getFirstName(comments.find(c => c._id === message.id)?.worker?.name)} sent an attachment
                                  </p>
                                </div>
                                <div className="flex items-center">
                                  {message.attachment.type?.startsWith('image/') ? (
                                    <img
                                      src={message.attachment.data}
                                      alt={message.attachment.name || 'Attachment'}
                                      className="max-h-40 max-w-full object-cover rounded-md mr-2"
                                    />
                                  ) : (
                                    <span className="text-gray-500 mr-2 flex items-center">
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="h-5 w-5 mr-2"
                                        viewBox="0 0 20 20"
                                        fill="currentColor"
                                      >
                                        <path
                                          fillRule="evenodd"
                                          d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                                          clipRule="evenodd"
                                        />
                                      </svg>
                                      {message.attachment.name || 'Unnamed File'}
                                    </span>
                                  )}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openAttachmentModal(message.attachment)}
                                  >
                                    View
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div
                            className={`p-3 rounded-lg mb-2 max-w-[45%] bg-blue-100 text-gray-800`}
                          >
                            <div className="flex justify-between items-baseline mb-1">
                              <p className="font-medium text-sm">Admin</p>
                              <p className="text-xs text-gray-500 text-right">{formatTime(message.createdAt)}</p>
                            </div>
                            <p className="text-sm">{message.text}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              {/* WhatsApp-style Reply Input */}
              <div className="sticky bottom-0 bg-white p-2 border-t border-gray-200">
                <form onSubmit={handleSubmitReply} className="flex items-center space-x-2">
                  <textarea
                    className="flex-1 p-2 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    rows="1"
                    placeholder="Type a message..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    style={{ minHeight: '40px', maxHeight: '100px' }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmitReply(e);
                      }
                    }}
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    className="rounded-full p-2"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                      />
                    </svg>
                  </Button>
                </form>
              </div>
            </div>
          )
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
            <h2 className="text-lg font-semibold mb-2">Select an Employee</h2>
            <p>Choose an employee from the left sidebar to start chatting.</p>
          </div>
        )}
      </div>

      {/* View Attachment Modal */}
      <Modal
        isOpen={isViewAttachmentModalOpen}
        onClose={() => setIsViewAttachmentModalOpen(false)}
        title="Attachment"
        size="lg"
      >
        {selectedAttachment && (
          <div className="text-center">
            {selectedAttachment.type.startsWith('image/') ? (
              <img
                src={selectedAttachment.data}
                alt={selectedAttachment.name}
                className="max-w-full max-h-[70vh] mx-auto"
              />
            ) : (
              <div className="p-8 text-center">
                <p className="text-xl mb-4">{selectedAttachment.name}</p>
                <p className="mb-4 text-gray-500">File type: {selectedAttachment.type}</p>
                <a
                  href={selectedAttachment.data}
                  download={selectedAttachment.name}
                  className="btn btn-primary"
                >
                  Download File
                </a>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CommentManagement;