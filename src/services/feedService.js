const { User, Post, Follow, sequelize } = require('../models');
const { redisClient } = require('../config/db');

// 1. Logic to Create a Post and "Fan-Out" to followers
exports.createPost = async (userId, content) => {
    const t = await sequelize.transaction();
    try {
        // A. Save Post to MySQL (Source of Truth)
        const post = await Post.create({ user_id: userId, content }, { transaction: t });
        await t.commit(); // Commit DB first to ensure data integrity

        // B. Fan-Out Strategy (Push to Redis)
        // Find all users following this creator
        const followers = await Follow.findAll({ 
            where: { followingId: userId },
            attributes: ['followerId'] 
        });

        // Use Redis Pipeline for high performance (Atomic batch write)
        const timestamp = post.createdAt.getTime();
        const pipeline = redisClient.multi();

        // 1. Add to Creator's own feed
        pipeline.zAdd(`feed:${userId}`, { score: timestamp, value: post.id.toString() });

        // 2. Add to every Follower's feed
        followers.forEach(f => {
            const key = `feed:${f.followerId}`;
            // ZADD: Add to Sorted Set
            pipeline.zAdd(key, { score: timestamp, value: post.id.toString() });
            // Optimization: Keep only the latest 100 posts in cache to save RAM
            pipeline.zRemRangeByRank(key, 0, -101); 
        });

        await pipeline.exec();
        return post;

    } catch (err) {
        await t.rollback();
        throw err;
    }
};

// 2. Logic to Read Feed (Cache-First Strategy)
exports.getFeed = async (userId, cursor, limit = 10) => {
    const key = `feed:${userId}`;
    // If cursor is provided, use it; otherwise, use current time (newest posts)
    const currentCursor = cursor ? parseInt(cursor) : Date.now();

    // A. Fetch Post IDs from Redis (Very Fast)
    // ZREVRANGEBYSCORE: Get items with score <= cursor, ordered by newest
    const postIds = await redisClient.zRangeByScore(key, '-inf', currentCursor, {
        REV: true,
        LIMIT: { offset: 0, count: limit + 1 } // Fetch 1 extra to check if there's a next page
    });

    if (!postIds.length) return { posts: [], nextCursor: null };

    // B. Hydrate content from MySQL (Efficient Batch Lookup)
    const posts = await Post.findAll({
        where: { id: postIds },
        include: [
            { model: User, attributes: ['id', 'username'] }
        ],
        // Ensure the order matches the Redis order (Newest first)
        order: [['createdAt', 'DESC']]
    });

    // C. Calculate Next Cursor for pagination
    const nextCursor = posts.length > limit ? posts[posts.length - 1].createdAt.getTime() - 1 : null;
    
    // Return the data (sliced to the requested limit)
    return { 
        posts: posts.slice(0, limit), 
        nextCursor 
    };
};