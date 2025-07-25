const asyncHandler = require('express-async-handler');
const Comment = require('../models/Comment');
const Worker = require('../models/Worker');

// @desc    Get comments for a worker
// @route   GET /api/comments/worker/:workerId
// @access  Private
const getWorkerComments = asyncHandler(async (req, res) => {
  const comments = await Comment.find({ worker: req.params.workerId })
    .sort({ createdAt: -1 });

  res.json(comments);
});

// @desc    Get my comments
// @route   GET /api/comments/me
// @access  Private
const getMyComments = asyncHandler(async (req, res) => {
  const comments = await Comment.find({ worker: req.user._id })
    .populate({
      path: 'worker',
      populate: {
        path: 'department',
        select: 'name'
      },
      select: 'name department photo username'
    })
    .sort({ createdAt: -1 });

  console.log(`Found ${comments.length} comments for worker ${req.user._id}`);
  
  // DO NOT automatically mark as read - let the frontend control this
  // Only return the comments without modifying their read status
  res.json(comments);
});

// @desc    Get all comments (admin)
// @route   GET /api/comments/:subdomain
// @access  Private/Admin
const getAllComments = asyncHandler(async (req, res) => {
  const { subdomain } = req.params;

  if (!subdomain || subdomain == 'main') {
    res.status(400);
    throw new Error('Company name is missing, login again.');
  }

  const comments = await Comment.find({ subdomain })
    .populate({
      path: 'worker',
      populate: {
        path: 'department',
        select: 'name'
      },
      select: 'name department photo username'
    })
    .sort({ createdAt: -1 });

  // More detailed transformation
  const transformedComments = comments.map(comment => {
    const commentObj = comment.toObject();

    // Provide fallback values
    commentObj.worker = commentObj.worker || {
      name: 'Unknown Worker',
      department: { name: 'Unassigned' }
    };

    return commentObj;
  });

  res.json(transformedComments);
});

const createComment = asyncHandler(async (req, res) => {
  const { text, subdomain } = req.body;
  const workerId = req.user._id;

  // Validate input
  if (!text) {
    res.status(400);
    throw new Error('Comment text is missing');
  }

  if (!subdomain || subdomain == 'main') {
    res.status(400);
    throw new Error('Company name is missing, login again.');
  }

  try {
    const comment = await Comment.create({
      worker: workerId,
      subdomain,
      text,
      isNew: true
    });

    // Populate worker details
    await comment.populate({
      path: 'worker',
      populate: {
        path: 'department',
        select: 'name'
      },
      select: 'name department photo username'
    });

    console.log('Comment Created Successfully:', comment);

    res.status(201).json(comment);
  } catch (error) {
    console.error('Comment Creation Error:', error);
    res.status(500);
    throw new Error('Failed to create comment');
  }
});

// @desc    Add reply to comment
// @route   POST /api/comments/:id/replies
// @access  Private
const addReply = asyncHandler(async (req, res) => {
  const { text } = req.body;

  if (!text) {
    res.status(400);
    throw new Error('Please add text to your reply');
  }

  const comment = await Comment.findById(req.params.id)
    .populate({
      path: 'worker',
      populate: {
        path: 'department',
        select: 'name'
      },
      select: 'name department photo username'
    });

  if (!comment) {
    res.status(404);
    throw new Error('Comment not found');
  }

  // Create new reply - Include subdomain from the parent comment
  const newReply = {
    text,
    isAdminReply: req.user.role === 'admin',
    isNew: true,
    subdomain: comment.subdomain // Add subdomain from parent comment
  };

  // Add reply to comment
  comment.replies = comment.replies || [];
  comment.replies.push(newReply);

  // If admin reply, set notification flag
  if (req.user.role === 'admin') {
    comment.hasUnreadAdminReply = true;
    comment.lastReplyTimestamp = new Date();
  }

  // Mark comment as having new activity
  comment.isNew = true;

  await comment.save();

  res.status(201).json(comment);
});

// @desc    Mark comment as read
// @route   PUT /api/comments/:id/read
// @access  Private
const markCommentAsRead = asyncHandler(async (req, res) => {
  const comment = await Comment.findById(req.params.id);

  if (!comment) {
    res.status(404);
    throw new Error('Comment not found');
  }

  comment.isNew = false;

  if (comment.replies && comment.replies.length > 0) {
    comment.replies.forEach(reply => {
      reply.isNew = false;
    });
  }

  await comment.save();

  res.json({ message: 'Comment marked as read' });
});

// @desc    Get unread admin replies
// @route   GET /api/comments/unread-admin-replies
// @access  Private
const getUnreadAdminReplies = asyncHandler(async (req, res) => {
  const comments = await Comment.find({
    worker: req.user._id,
    hasUnreadAdminReply: true
  });

  res.json(comments);
});

// @desc    Mark admin replies as read
// @route   PUT /api/comments/mark-admin-replies-read
// @access  Private
const markAdminRepliesAsRead = asyncHandler(async (req, res) => {
  // Update all comments for this worker that have unread admin replies
  const result = await Comment.updateMany(
    {
      worker: req.user._id,
      hasUnreadAdminReply: true
    },
    {
      $set: {
        hasUnreadAdminReply: false,
        'replies.$[reply].isNew': false
      }
    },
    {
      arrayFilters: [{ 'reply.isAdminReply': true }]
    }
  );

  console.log('Marked admin replies as read:', result);
  res.json({ message: 'Admin replies marked as read' });
});

// @desc    Mark specific comment's admin replies as read
// @route   PUT /api/comments/:id/mark-admin-replies-read
// @access  Private
const markCommentAdminRepliesAsRead = asyncHandler(async (req, res) => {
  const comment = await Comment.findById(req.params.id);

  if (!comment) {
    res.status(404);
    throw new Error('Comment not found');
  }

  // Mark only admin replies as read
  if (comment.replies && comment.replies.length > 0) {
    comment.replies.forEach(reply => {
      if (reply.isAdminReply) {
        reply.isNew = false;
      }
    });
  }

  comment.hasUnreadAdminReply = false;
  await comment.save();

  res.json({ message: 'Admin replies marked as read for this comment' });
});

module.exports = {
  getWorkerComments,
  getMyComments,
  getAllComments,
  createComment,
  addReply,
  markAdminRepliesAsRead,
  getUnreadAdminReplies,
  markCommentAsRead,
  markCommentAdminRepliesAsRead
};