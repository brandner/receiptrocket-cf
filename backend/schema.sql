CREATE TABLE receipts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  company_name TEXT,
  description TEXT,
  total_amount REAL,
  gst REAL,
  pst REAL,
  date DATETIME DEFAULT CURRENT_TIMESTAMP,
  image_url TEXT,
  image_path TEXT
);

CREATE INDEX idx_user_id ON receipts(user_id);
