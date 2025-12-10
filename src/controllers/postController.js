const feedService = require('../services/feedService');
const { Post, Like, Comment, sequelize } = require('../models');

// 1. Create Post
exports.createPost = async (req, res) => {
    try {
        const { userId, content } = req.body;
        // Call the service we wrote in Step 4
        const post = await feedService.createPost(userId, content);
        res.status(201).json(post);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// 2. Get Feed
exports.getFeed = async (req, res) => {
    try {
        // In a real app, userId comes from the JWT Token
        const { userId } = req.query; // e.g., ?userId=1
        const { cursor } = req.query; // e.g., ?cursor=1700000000
        
        const data = await feedService.getFeed(userId, cursor);
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// 3. Like a Post (Idempotent & Atomic)
exports.likePost = async (req, res) => {
    const { post_id } = req.params;
    const { userId } = req.body;

    const t = await sequelize.transaction();
    try {
        // Check if already liked to ensure Idempotency
        const existingLike = await Like.findOne({ 
            where: { userId, postId: post_id }, 
            transaction: t 
        });

        if (existingLike) {
            await t.rollback();
            return res.json({ message: "Post already liked" });
        }

        await Like.create({ userId, postId: post_id }, { transaction: t });
        // Denormalization: Increment count on Post table
        await Post.increment('like_count', { where: { id: post_id }, transaction: t });

        await t.commit();
        res.json({ message: "Post liked" });
    } catch (e) {
        await t.rollback();
        res.status(500).json({ error: e.message });
    }
};

// 4. Comment on a Post
exports.commentOnPost = async (req, res) => {
    const { post_id } = req.params;
    const { userId, content } = req.body;

    const t = await sequelize.transaction();
    try {
        const comment = await Comment.create({ userId, postId: post_id, content }, { transaction: t });
        // Denormalization: Increment count on Post table
        await Post.increment('comment_count', { where: { id: post_id }, transaction: t });

        await t.commit();
        res.json(comment);
    } catch (e) {
        await t.rollback();
        res.status(500).json({ error: e.message });
    }
};

// 5. Get Single Post Details
exports.getPostDetails = async (req, res) => {
    try {
        const { post_id } = req.params;
        const post = await Post.findOne({
            where: { id: post_id },
            include: [
                { model: User, attributes: ['username'] },
                // Include recent likes/comments if needed, or just counts
                { model: Comment, limit: 3, order: [['createdAt', 'DESC']] } 
            ]
        });
        if (!post) return res.status(404).json({ error: "Post not found" });
        res.json(post);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// 6. Unlike a Post
exports.unlikePost = async (req, res) => {
    const { post_id } = req.params;
    const { userId } = req.body;

    const t = await sequelize.transaction();
    try {
        const deleted = await Like.destroy({
            where: { userId, postId: post_id },
            transaction: t
        });

        if (deleted) {
            await Post.decrement('like_count', { where: { id: post_id }, transaction: t });
        }

        await t.commit();
        res.json({ message: "Post unliked" });
    } catch (e) {
        await t.rollback();
        res.status(500).json({ error: e.message });
    }
};