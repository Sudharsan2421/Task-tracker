import React, { useState, useEffect, useRef, useContext } from 'react';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import {
  getMyComments,
  createComment,
  addReply,
  markAdminRepliesAsRead,
  markCommentAsRead,
  markCommentAdminRepliesAsRead
} from '../../services/commentService';
import Card from '../common/Card';
import Button from '../common/Button';
import Spinner from '../common/Spinner';
import appContext from '../../context/AppContext';

const Comments = () => {
  const [comments, setComments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyTexts, setReplyTexts] = useState({});
  const [unreadRepliesCount, setUnreadRepliesCount] = useState(0);

  const { subdomain } = useContext(appContext);

  // Load comments
  useEffect(() => {
    const fetchComments = async () => {
      try {
        setIsLoading(true);
        console.log('Fetching comments for worker...');
        const fetchedComments = await getMyComments();
        console.log('Fetched comments:', fetchedComments);
        
        // Ensure we have an array
        const safeComments = Array.isArray(fetchedComments) ? fetchedComments : [];
        setComments(safeComments);
        
        // Count unread admin replies
        const unreadCount = safeComments.reduce((count, comment) => {
          const unreadAdminReplies = comment.replies?.filter(reply => 
            reply.isAdminReply && reply.isNew
          ) || [];
          return count + unreadAdminReplies.length;
        }, 0);
        
        setUnreadRepliesCount(unreadCount);
      } catch (error) {
        console.error('Failed to fetch comments:', error);
        toast.error('Failed to load comments');
        setComments([]); // Set empty array on error
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchComments();
  }, [subdomain]);

  // Auto-refresh comments every 30 seconds to check for new admin replies
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        console.log('Auto-refreshing comments...');
        const fetchedComments = await getMyComments();
        console.log('Auto-refresh fetched comments:', fetchedComments);
        
        const safeComments = Array.isArray(fetchedComments) ? fetchedComments : [];
        setComments(safeComments);
        
        // Count unread admin replies
        const unreadCount = safeComments.reduce((count, comment) => {
          const unreadAdminReplies = comment.replies?.filter(reply => 
            reply.isAdminReply && reply.isNew
          ) || [];
          return count + unreadAdminReplies.length;
        }, 0);
        
        setUnreadRepliesCount(unreadCount);
      } catch (error) {
        console.error('Failed to refresh comments:', error);
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Handle comment submission
  const handleSubmitComment = async (e) => {
    e.preventDefault();

    if (!subdomain || subdomain == 'main') {
      toast.error('Subdomain is missing, check the URL.');
      return;
    }

    if (!commentText.trim()) {
      toast.error('Please enter a comment');
      return;
    }

    setIsSubmitting(true);

    try {
      const commentData = {
        text: commentText.trim(),
        subdomain
      };

      const newComment = await createComment(commentData);

      setComments(prev => [newComment, ...prev]);

      // Reset form
      setCommentText('');

      toast.success('Comment added successfully!');
    } catch (error) {
      toast.error(error.message || 'Failed to add comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle reply submission
  const handleSubmitReply = async (commentId) => {
    const replyText = replyTexts[commentId];

    if (!replyText || !replyText.trim()) {
      toast.error('Please enter a reply');
      return;
    }

    try {
      const updatedComment = await addReply(commentId, { text: replyText.trim() });

      setComments(prev =>
        prev.map(comment =>
          comment._id === commentId ? updatedComment : comment
        )
      );

      setReplyTexts(prev => ({
        ...prev,
        [commentId]: ''
      }));

      toast.success('Reply added successfully!');
    } catch (error) {
      toast.error(error.message || 'Failed to add reply');
    }
  };

  // Mark admin replies as read when user views them
  const handleMarkAdminRepliesAsRead = async (commentId) => {
    try {
      await markCommentAdminRepliesAsRead(commentId);
      
      // Update local state to mark admin replies as read
      setComments(prev =>
        prev.map(comment => {
          if (comment._id === commentId) {
            return {
              ...comment,
              hasUnreadAdminReply: false,
              replies: comment.replies?.map(reply => 
                reply.isAdminReply ? { ...reply, isNew: false } : reply
              ) || []
            };
          }
          return comment;
        })
      );
      
      // Update unread count
      const newUnreadCount = comments.reduce((count, comment) => {
        if (comment._id === commentId) return count;
        const unreadAdminReplies = comment.replies?.filter(reply => 
          reply.isAdminReply && reply.isNew
        ) || [];
        return count + unreadAdminReplies.length;
      }, 0);
      
      setUnreadRepliesCount(newUnreadCount);
      
      toast.success('Marked as read');
    } catch (error) {
      console.error('Failed to mark admin replies as read:', error);
      toast.error('Failed to mark as read');
    }
  };

  // Update reply text for a specific comment
  const handleReplyTextChange = (commentId, text) => {
    setReplyTexts(prev => ({
      ...prev,
      [commentId]: text
    }));
  };

  // Format date
  const formatDate = (dateString) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy h:mm a');
    } catch (error) {
      return dateString;
    }
  };

  // View attachment
  const viewAttachment = (attachment) => {
    if (attachment.type.startsWith('image/')) {
      window.open(attachment.data, '_blank');
    } else {
      const link = document.createElement('a');
      link.href = attachment.data;
      link.download = attachment.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Comments & Communication</h1>
        {unreadRepliesCount > 0 && (
          <div className="bg-red-500 text-white px-3 py-1 rounded-full text-sm">
            {unreadRepliesCount} New Reply{unreadRepliesCount > 1 ? 'ies' : ''}
          </div>
        )}
      </div>

      <Card className="mb-6">
        <form onSubmit={handleSubmitComment}>
          <div className="form-group">
            <label htmlFor="commentText" className="form-label">New Comment</label>
            <textarea
              id="commentText"
              className="form-input"
              rows="4"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Type your comment here..."
              required
            ></textarea>
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting || !commentText.trim()}
            >
              {isSubmitting ? <Spinner size="sm" /> : 'Submit Comment'}
            </Button>
          </div>
        </form>
      </Card>

      <Card title="Comment History">
        {/* Debug Information - Remove this in production */}
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-800">
            Debug: Comments count: {comments.length} | Loading: {isLoading.toString()} | Subdomain: {subdomain}
          </p>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner size="lg" />
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>You haven't posted any comments yet.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {comments.map((comment, index) => {
              console.log('Rendering comment:', comment); // Debug log
              const hasUnreadAdminReplies = comment.replies?.some(reply => 
                reply.isAdminReply && reply.isNew
              ) || false;

              return (
                <div
                  key={comment._id || `comment-${index}`}
                  className={`border rounded-lg overflow-hidden ${
                    hasUnreadAdminReplies 
                      ? 'border-red-400 shadow-lg' 
                      : comment.isNew 
                        ? 'border-blue-400' 
                        : 'border-gray-200'
                  }`}
                >
                  <div className={`px-4 py-3 border-b border-gray-200 ${
                    hasUnreadAdminReplies ? 'bg-red-50' : 'bg-gray-50'
                  }`}>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center">
                        <h3 className="font-medium text-gray-700">Your Comment</h3>
                        {hasUnreadAdminReplies && (
                          <span className="ml-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs">
                            New Reply!
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-gray-500">
                        {formatDate(comment.createdAt)}
                      </span>
                    </div>
                  </div>

                  <div className="p-4">
                    <p className="mb-4">{comment.text || 'No comment text'}</p>

                    {comment.attachment && (
                      <div className="mb-4 p-3 bg-gray-50 rounded-md">
                        <div className="flex items-center">
                          <span className="text-gray-700 mr-2">
                            Attachment: {comment.attachment.name}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => viewAttachment(comment.attachment)}
                          >
                            View
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Replies */}
                    {comment.replies && comment.replies.length > 0 && (
                      <div className="mt-4 space-y-3">
                        <div className="flex justify-between items-center">
                          <h4 className="text-sm font-medium text-gray-700">Replies:</h4>
                          {hasUnreadAdminReplies && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleMarkAdminRepliesAsRead(comment._id)}
                            >
                              Mark as Read
                            </Button>
                          )}
                        </div>

                        {comment.replies.map((reply, index) => (
                          <div
                            key={`${comment._id}-reply-${index}`}
                            className={`p-3 rounded-md ${
                              reply.isAdminReply
                                ? reply.isNew 
                                  ? 'bg-red-50 border-l-4 border-red-400 border-2 border-red-300 animate-pulse'
                                  : 'bg-blue-50 border-l-4 border-blue-400'
                                : 'bg-gray-50'
                            }`}
                          >
                            <div className="flex justify-between items-center mb-1">
                              <div className="flex items-center">
                                <p className="text-sm font-medium">
                                  {reply.isAdminReply ? 'Admin' : 'You'}
                                </p>
                                {reply.isAdminReply && reply.isNew && (
                                  <span className="ml-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs">
                                    NEW
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-gray-500">
                                {formatDate(reply.createdAt)}
                              </span>
                            </div>
                            <p className="text-sm">{reply.text}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Reply form */}
                    <div className="mt-4">
                      <textarea
                        className="form-input mb-2"
                        rows="2"
                        value={replyTexts[comment._id] || ''}
                        onChange={(e) => handleReplyTextChange(comment._id, e.target.value)}
                        placeholder="Type your reply..."
                      ></textarea>

                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleSubmitReply(comment._id)}
                          disabled={!replyTexts[comment._id]?.trim()}
                        >
                          Reply
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

export default Comments;