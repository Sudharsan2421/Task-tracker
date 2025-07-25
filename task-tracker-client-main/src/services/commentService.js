import api from '../hooks/useAxios';
import { getAuthToken } from '../utils/authUtils';

// Get all comments (admin)
export const getAllComments = async (commentData) => {
  try {
    if (!commentData.subdomain || commentData.subdomain == 'main') {
      throw new Error('Subdomain is missing, check the URL');
    }

    const token = getAuthToken();
    const response = await api.get(`/comments/${commentData.subdomain}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Comments response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch comments:', error);
    throw error.response ? error.response.data : new Error('Failed to fetch comments');
  }
};

// Get my comments (worker)
export const getMyComments = async () => {
  try {
    const token = getAuthToken();
    console.log('Getting my comments with token:', token ? 'Token exists' : 'No token');

    const response = await api.get('/comments/me', {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('getMyComments response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch my comments:', error);
    console.error('Error response:', error.response?.data);
    throw error.response ? error.response.data : new Error('Failed to fetch comments');
  }
};

// Get worker comments (admin)
export const getWorkerComments = async (workerId) => {
  try {
    const token = getAuthToken();
    const response = await api.get(`/comments/worker/${workerId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    throw error.response ? error.response.data : new Error('Failed to fetch comments');
  }
};

// Create comment
export const createComment = async (commentData) => {
  try {
    const token = getAuthToken();

    const response = await api.post('/comments', commentData, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    return response.data;
  } catch (error) {
    console.error('Failed to create comment:', error);
    throw error.response ? error.response.data : new Error('Failed to create comment');
  }
};

// Add reply to comment
export const addReply = async (commentId, replyData) => {
  try {
    const token = getAuthToken();
    const response = await api.post(`/comments/${commentId}/replies`, replyData, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    console.error('Failed to add reply:', error);
    throw error.response ? error.response.data : new Error('Failed to add reply');
  }
};

// Mark comment as read
export const markCommentAsRead = async (commentId) => {
  try {
    const token = getAuthToken();
    const response = await api.put(`/comments/${commentId}/read`, null, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    console.error('Failed to mark comment as read:', error);
    throw error.response ? error.response.data : new Error('Failed to mark comment as read');
  }
};

// Mark all comments and their replies for a specific worker as read
export const markCommentsAsRead = async (workerId, { subdomain }) => {
  try {
    if (!subdomain || subdomain === 'main') {
      throw new Error('Subdomain is missing or invalid for marking comments as read.');
    }

    const token = getAuthToken();
    // Assuming your backend has an endpoint like /comments/worker/:workerId/mark-read/:subdomain
    const response = await api.put(`/comments/worker/${workerId}/mark-read/${subdomain}`, null, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(`Successfully marked comments as read for worker ${workerId} under subdomain ${subdomain}.`);
    return response.data;
  } catch (error) {
    console.error('Failed to mark comments as read for worker:', error);
    throw error.response ? error.response.data : new Error('Failed to mark comments as read for worker');
  }
};


// Get unread admin replies count
export const getUnreadAdminReplies = async () => {
  try {
    const token = getAuthToken();
    const response = await api.get('/comments/unread-admin-replies', {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    console.error('Failed to fetch unread admin replies:', error);
    return [];
  }
};

// Mark admin replies as read for the current user
export const markAdminRepliesAsRead = async () => {
  try {
    const token = getAuthToken();
    const response = await api.put('/comments/mark-admin-replies-read', null, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    console.error('Failed to mark admin replies as read:', error);
    throw error.response ? error.response.data : new Error('Failed to mark admin replies as read');
  }
};

// Mark specific comment's admin replies as read
export const markCommentAdminRepliesAsRead = async (commentId) => {
  try {
    const token = getAuthToken();
    const response = await api.put(`/comments/${commentId}/mark-admin-replies-read`, null, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    console.error('Failed to mark comment admin replies as read:', error);
    throw error.response ? error.response.data : new Error('Failed to mark comment admin replies as read');
  }
};