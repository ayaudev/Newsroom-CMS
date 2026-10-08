-- Keep the legacy author_id for existing imports, with a stored author_user_id alias.
ALTER TABLE posts ADD COLUMN IF NOT EXISTS author_user_id uuid GENERATED ALWAYS AS (author_id) STORED;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS reviewed_by_admin_id uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS rejection_reason varchar(1000);
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_status_check;
ALTER TABLE posts ADD CONSTRAINT posts_status_check CHECK(status IN ('draft','PENDING_REVIEW','published','rejected','archived'));
CREATE TABLE IF NOT EXISTS post_revisions (
 id uuid PRIMARY KEY,
 post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
 version integer NOT NULL CHECK(version > 0),
 title varchar(200) NOT NULL CHECK(length(trim(title)) > 0),
 summary varchar(500) NOT NULL DEFAULT '',
 content text NOT NULL CHECK(length(trim(content)) > 0),
 category_id uuid NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
 image text NOT NULL DEFAULT '',
 tags text[] NOT NULL DEFAULT '{}',
 status text NOT NULL CHECK(status IN ('draft','PENDING_REVIEW','published','rejected')),
 original_submission jsonb,
 submitted_at timestamptz,
 reviewed_by_admin_id uuid REFERENCES users(id) ON DELETE SET NULL,
 reviewed_at timestamptz,
 rejection_reason varchar(1000),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(post_id,version),
 CHECK(status <> 'PENDING_REVIEW' OR (original_submission IS NOT NULL AND submitted_at IS NOT NULL)),
 CHECK(status NOT IN ('published','rejected') OR reviewed_at IS NOT NULL)
);
ALTER TABLE posts ADD COLUMN IF NOT EXISTS active_revision_id uuid REFERENCES post_revisions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS post_revisions_queue_idx ON post_revisions(submitted_at,id) WHERE status='PENDING_REVIEW';
CREATE INDEX IF NOT EXISTS posts_author_idx ON posts(author_user_id,created_at DESC);
CREATE OR REPLACE FUNCTION newsroom_preserve_author() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.author_id IS DISTINCT FROM OLD.author_id THEN
  RAISE EXCEPTION 'Original authorship cannot be changed' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS newsroom_preserve_author ON posts;
CREATE TRIGGER newsroom_preserve_author BEFORE UPDATE OF author_id ON posts FOR EACH ROW EXECUTE FUNCTION newsroom_preserve_author();
CREATE OR REPLACE FUNCTION newsroom_preserve_submission() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.post_id IS DISTINCT FROM OLD.post_id OR
    (OLD.original_submission IS NOT NULL AND
     (NEW.original_submission IS DISTINCT FROM OLD.original_submission OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at)) THEN
  RAISE EXCEPTION 'Original submission cannot be changed' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS newsroom_preserve_submission ON post_revisions;
CREATE TRIGGER newsroom_preserve_submission BEFORE UPDATE ON post_revisions FOR EACH ROW EXECUTE FUNCTION newsroom_preserve_submission();
