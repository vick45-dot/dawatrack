-- DawaTrack v2 -> v3: POS receipts, payment methods, cash shifts.
-- Safe to run more than once. MySQL 8 + MariaDB compatible.
USE dawatrack;

-- Cash shifts: float in, cash sales accumulate, declared count at close
CREATE TABLE IF NOT EXISTS shifts (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  user_id        INT NOT NULL,
  opening_float  DECIMAL(12,2) NOT NULL DEFAULT 0,
  opened_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at      DATETIME NULL,
  expected_cash  DECIMAL(12,2) NULL,
  declared_cash  DECIMAL(12,2) NULL,
  variance       DECIMAL(12,2) NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_shifts_user (user_id),
  INDEX idx_shifts_open (closed_at)
) ENGINE=InnoDB;

-- Receipts: one checkout = one receipt (many sale lines), with payment info
CREATE TABLE IF NOT EXISTS receipts (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  user_id             INT NULL,
  shift_id            INT NULL,
  payment_method      ENUM('cash','mpesa','card','paypal','applepay','other') NOT NULL,
  payment_ref         VARCHAR(80) NULL,
  status              ENUM('pending','paid','failed') NOT NULL DEFAULT 'paid',
  total               DECIMAL(12,2) NOT NULL DEFAULT 0,
  customer_phone      VARCHAR(20) NULL,
  checkout_request_id VARCHAR(80) NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at             DATETIME NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE SET NULL,
  INDEX idx_receipts_status (status),
  INDEX idx_receipts_checkout (checkout_request_id),
  INDEX idx_receipts_date (created_at)
) ENGINE=InnoDB;

-- Pending M-Pesa receipts carry their cart here until the callback confirms
CREATE TABLE IF NOT EXISTS receipt_items (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  receipt_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity   INT NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB;

-- sales.receipt_id (only if missing)
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sales' AND COLUMN_NAME = 'receipt_id');
SET @q := IF(@c = 0, 'ALTER TABLE sales ADD COLUMN receipt_id INT NULL AFTER user_id', 'SELECT 1');
PREPARE st FROM @q; EXECUTE st; DEALLOCATE PREPARE st;

SET @c := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sales' AND CONSTRAINT_NAME = 'fk_sales_receipt');
SET @q := IF(@c = 0, 'ALTER TABLE sales ADD CONSTRAINT fk_sales_receipt FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE SET NULL', 'SELECT 1');
PREPARE st FROM @q; EXECUTE st; DEALLOCATE PREPARE st;
