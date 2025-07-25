const express = require('express');
const router = express.Router();
const { 
  getWorkerComments, 
  getMyComments, 
  getAllComments, 
  createComment, 
  addReply, 
  markAdminRepliesAsRead,
  getUnreadAdminReplies,
  markCommentAsRead,
  markCommentAdminRepliesAsRead
} = require('../controllers/commentController');

const { protect, adminOnly, adminOrWorker, workerOnly } = require('../middleware/authMiddleware');

// Create comment
router.route('/').post(protect, createComment);

// Worker routes - These should come BEFORE parameterized routes
router.get('/me', protect, workerOnly, getMyComments);
router.get('/unread-admin-replies', protect, workerOnly, getUnreadAdminReplies);
router.put('/mark-admin-replies-read', protect, markAdminRepliesAsRead);

// Admin routes
router.route('/:subdomain').get(protect, adminOnly, getAllComments);
router.get('/worker/:workerId', protect, adminOnly, getWorkerComments);

// Comment-specific routes
router.post('/:id/replies', protect, addReply);
router.put('/:id/read', protect, markCommentAsRead);
router.put('/:id/mark-admin-replies-read', protect, markCommentAdminRepliesAsRead);

module.exports = router;