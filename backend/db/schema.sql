CREATE TABLE IF NOT EXISTS users (
 id uuid PRIMARY KEY, name varchar(50) NOT NULL CHECK(length(trim(name)) > 0),
 email text NOT NULL UNIQUE, password text NOT NULL,
 role text NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')), avatar text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS categories (
 id uuid PRIMARY KEY, slug text UNIQUE NOT NULL, name varchar(80) NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS posts (
 id uuid PRIMARY KEY, title varchar(200) NOT NULL CHECK(length(trim(title)) > 0), slug text UNIQUE NOT NULL,
 content text NOT NULL CHECK(length(trim(content)) > 0), summary varchar(500) NOT NULL DEFAULT '',
 category_id uuid NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
 author_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 tags text[] NOT NULL DEFAULT '{}', image text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
 views integer NOT NULL DEFAULT 0 CHECK(views >= 0), is_featured boolean NOT NULL DEFAULT false,
 published_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(status <> 'published' OR published_at IS NOT NULL)
);
CREATE TABLE IF NOT EXISTS comments (
 id uuid PRIMARY KEY, content varchar(1000) NOT NULL CHECK(length(trim(content)) > 0),
 post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 parent_id uuid REFERENCES comments(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 is_edited boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS post_likes (post_id uuid REFERENCES posts(id) ON DELETE CASCADE, user_id uuid REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY(post_id,user_id));
CREATE TABLE IF NOT EXISTS favorites (post_id uuid REFERENCES posts(id) ON DELETE CASCADE, user_id uuid REFERENCES users(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(post_id,user_id));
CREATE TABLE IF NOT EXISTS comment_likes (comment_id uuid REFERENCES comments(id) ON DELETE CASCADE, user_id uuid REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY(comment_id,user_id));
CREATE INDEX IF NOT EXISTS posts_published_idx ON posts(published_at DESC, id) WHERE status='published';
CREATE INDEX IF NOT EXISTS posts_category_idx ON posts(category_id,status);
CREATE INDEX IF NOT EXISTS comments_moderation_idx ON comments(status,created_at DESC);
CREATE INDEX IF NOT EXISTS comments_post_idx ON comments(post_id,parent_id,status);

-- Additive migration: existing users and content are preserved.
CREATE TABLE IF NOT EXISTS revoked_tokens (
 token_hash char(64) PRIMARY KEY,
 expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS revoked_tokens_expiry_idx ON revoked_tokens(expires_at);
