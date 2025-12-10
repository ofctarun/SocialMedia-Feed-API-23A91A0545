const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const postController = require('../controllers/postController');
const { User } = require('../models');

// --- Helper Route to Create Users (For Testing) ---
router.post('/auth/signup', async (req, res) => {
    try {
        const user = await User.create(req.body);
        res.status(201).json(user);
    } catch (e) { res.status(400).json({ error: e.message }); }
});

// --- User Management ---
router.post('/users/:user_id/follow', userController.followUser);
router.delete('/users/:user_id/unfollow', userController.unfollowUser);

// --- Post Management ---
router.post('/posts', postController.createPost);
router.get('/posts/:post_id', postController.getPostDetails);
router.post('/posts/:post_id/like', postController.likePost);
router.delete('/posts/:post_id/unlike', postController.unlikePost);
router.post('/posts/:post_id/comments', postController.commentOnPost);

// --- The Feed Endpoint ---
router.get('/feed', postController.getFeed);

module.exports = router;