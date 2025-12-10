# High-Performance Social Media Feed API

## Overview
A scalable REST API designed to handle high-throughput social media feeds using a **Fan-Out-On-Write** architecture and **Redis** caching. This project minimizes read latency by pre-computing feeds during post creation.

## Architecture
![Architecture Diagram](./architecture.png)

### Feed Generation Algorithm: Fan-Out-On-Write (Push Model)
We utilize a "Push" model to ensure low latency during feed retrieval (the most frequent operation in social media).

1.  **Write Path (Async Fan-Out):**
    * When a user creates a post, the transaction is committed to MySQL (Source of Truth).
    * Simultaneously, we fetch all the user's followers.
    * We "push" the new Post ID into a Redis Sorted Set (`ZSET`) for *each* follower.
    * This ensures that when a user opens their feed, the data is already pre-calculated.

2.  **Read Path (Cache Hit):**
    * When a user requests `GET /feed`, we query their specific Redis key (`feed:{userId}`).
    * We retrieve the top Post IDs based on the timestamp score.
    * We then "hydrate" these IDs by fetching the full content (text, image, user info) from MySQL in a single batch query.

### Caching Strategy
* **Technology:** Redis
* **Data Structure:** **Sorted Sets (ZSET)**.
    * **Key:** `feed:{userId}`
    * **Score:** Unix Timestamp (ensures chronological order).
    * **Value:** `postId`.
* **Why ZSET?** It allows for O(log(N)) retrieval by time range, which is critical for efficient **cursor-based pagination** (e.g., "Give me posts older than timestamp X").
* **Optimization:** We limit the ZSET size to the most recent 100 posts to conserve memory (`ZREMRANGEBYRANK`).

### Database Schema & Denormalization
* **Database:** MySQL (v8.0)
* **Denormalization Decisions:**
    * **Post Table:** Includes `like_count` and `comment_count`.
    * **User Table:** Includes `follower_count` and `following_count`.
    * **Reasoning:** In a read-heavy system, calculating `COUNT(*)` on the `Likes` table for every post in a feed is too slow. We increment these counters atomically during writes so reads are instant.

## Setup Instructions

### Prerequisites
* Docker & Docker Compose
* Node.js (v18+)
* Git

### Step-by-Step Installation
1.  **Clone the repository:**
    ```bash
    git clone <your-repo-url>
    cd social-feed-api
    ```

2.  **Configure Environment:**
    Create a `.env` file in the root directory:
    ```ini
    PORT=3000
    DB_HOST=localhost
    DB_USER=root
    DB_PASS=root
    DB_NAME=social_feed
    REDIS_HOST=localhost
    ```

3.  **Start Infrastructure (MySQL & Redis):**
    ```bash
    docker-compose up -d
    ```

4.  **Install Dependencies & Run:**
    ```bash
    npm install
    npm start
    ```
    *The server will start on http://localhost:3000.*

## API Endpoints & Documentation

### 1. Authentication & Users
* **Create User:** `POST /auth/signup`
    * Body: `{ "username": "tarun", "password": "password" }`
* **Follow User:** `POST /users/:user_id/follow`
    * Body: `{ "currentUserId": 1 }`
* **Unfollow User:** `DELETE /users/:user_id/unfollow`
    * Body: `{ "currentUserId": 1 }`

### 2. Posts & Interactions
* **Create Post:** `POST /posts`
    * Body: `{ "userId": 1, "content": "Hello World" }`
    * *Note: This triggers the Fan-Out process.*
* **Like Post:** `POST /posts/:post_id/like`
    * Body: `{ "userId": 2 }`
* **Comment:** `POST /posts/:post_id/comments`
    * Body: `{ "userId": 2, "content": "Nice post!" }`

### 3. The Feed (Core Feature)
* **Get Feed:** `GET /feed`
    * Query Params:
        * `userId`: The ID of the user viewing the feed.
        * `cursor`: (Optional) The timestamp of the last post seen (for pagination).
    * Example: `GET /feed?userId=2&cursor=1701234567890`

## Testing
To verify functionality:
1.  Create User A and User B.
2.  Have User B follow User A.
3.  Have User A create a post.
4.  Call `GET /feed?userId=B_ID`.
5.  **Result:** You should see User A's post in User B's feed instantly via Redis.