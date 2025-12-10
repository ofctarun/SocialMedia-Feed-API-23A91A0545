const { User, Follow, sequelize } = require('../models');

// 1. Follow a User
exports.followUser = async (req, res) => {
    const { user_id } = req.params; // The person being followed
    const { currentUserId } = req.body; // The person doing the following (Simulated Auth)

    if (user_id == currentUserId) return res.status(400).json({ error: "Cannot follow self" });

    const t = await sequelize.transaction();
    try {
        // Create the Follow relationship
        await Follow.create(
            { followerId: currentUserId, followingId: user_id }, 
            { transaction: t }
        );

        // Atomically increment counts
        await User.increment('following_count', { where: { id: currentUserId }, transaction: t });
        await User.increment('follower_count', { where: { id: user_id }, transaction: t });

        await t.commit();
        res.json({ message: "Followed successfully" });
    } catch (e) {
        await t.rollback();
        // Handle "UniqueConstraintError" if already following
        res.status(400).json({ error: e.message });
    }
};

// 2. Unfollow a User
exports.unfollowUser = async (req, res) => {
    const { user_id } = req.params;
    const { currentUserId } = req.body;

    const t = await sequelize.transaction();
    try {
        const deleted = await Follow.destroy({
            where: { followerId: currentUserId, followingId: user_id },
            transaction: t
        });

        if (deleted) {
            await User.decrement('following_count', { where: { id: currentUserId }, transaction: t });
            await User.decrement('follower_count', { where: { id: user_id }, transaction: t });
        }

        await t.commit();
        res.json({ message: "Unfollowed successfully" });
    } catch (e) {
        await t.rollback();
        res.status(500).json({ error: e.message });
    }
};