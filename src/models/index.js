const { Sequelize, DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

// 1. User Model with Denormalized Counts
const User = sequelize.define('User', {
    username: { type: DataTypes.STRING, unique: true, allowNull: false },
    // These are required Denormalized Fields
    follower_count: { type: DataTypes.INTEGER, defaultValue: 0 },
    following_count: { type: DataTypes.INTEGER, defaultValue: 0 }
});

// 2. Post Model with Denormalized Counts
const Post = sequelize.define('Post', {
    content: { type: DataTypes.TEXT, allowNull: false },
    // These are required Denormalized Fields
    like_count: { type: DataTypes.INTEGER, defaultValue: 0 },
    comment_count: { type: DataTypes.INTEGER, defaultValue: 0 }
});

// 3. Follow Model (Composite Primary Key to enforce uniqueness)
const Follow = sequelize.define('Follow', {
    followerId: { type: DataTypes.INTEGER, primaryKey: true },
    followingId: { type: DataTypes.INTEGER, primaryKey: true }
});

// 4. Like Model (Used for checking idempotency and history)
const Like = sequelize.define('Like', {
    userId: { type: DataTypes.INTEGER, primaryKey: true },
    postId: { type: DataTypes.INTEGER, primaryKey: true }
});

// 5. Comment Model
const Comment = sequelize.define('Comment', {
    content: { type: DataTypes.TEXT, allowNull: false },
});

// --- Relationships (Foreign Keys) ---

// Posts
User.hasMany(Post, { foreignKey: 'user_id' });
Post.belongsTo(User, { foreignKey: 'user_id' });

// Follows
User.belongsToMany(User, { as: 'Followers', through: Follow, foreignKey: 'followingId', otherKey: 'followerId' });
User.belongsToMany(User, { as: 'Following', through: Follow, foreignKey: 'followerId', otherKey: 'followingId' });

// Likes
Post.hasMany(Like, { foreignKey: 'postId' });
Like.belongsTo(Post, { foreignKey: 'postId' });
User.hasMany(Like, { foreignKey: 'userId' });
Like.belongsTo(User, { foreignKey: 'userId' });

// Comments
Post.hasMany(Comment, { foreignKey: 'postId' });
Comment.belongsTo(Post, { foreignKey: 'postId' });
User.hasMany(Comment, { foreignKey: 'userId' });
Comment.belongsTo(User, { foreignKey: 'userId' });


module.exports = { sequelize, User, Post, Follow, Like, Comment };