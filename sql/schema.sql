-- DawaTrack v3: Chemist Stock & Profit Management (fresh install)
-- phpMyAdmin: SQL tab > paste > Go. Or: node load-sql.js sql/schema.sql
-- Existing database? Run sql/upgrade.sql (v1->v2) then sql/upgrade-v3.sql (v2->v3).

CREATE DATABASE IF NOT EXISTS dawatrack CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE dawatrack;

-- User accounts. Owner sees everything; sellers run the POS.
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  username      VARCHAR(60)  NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  role          ENUM('owner','seller') NOT NULL DEFAULT 'seller',
  active        TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_username (username)
) ENGINE=InnoDB;

-- Default owner. Username: admin  Password: admin123 - CHANGE AFTER FIRST LOGIN
INSERT INTO users (name, username, password_hash, role)
SELECT 'Owner', 'admin', '$2a$10$WfEWoTJ.7w6g2tcvUolRM.efc5X10MUZ2l.r0TfRCnOCt4Ip6ONJe', 'owner'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin');

-- Product master list. Stock on hand is NEVER stored; always purchases - sales.
CREATE TABLE IF NOT EXISTS products (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(150) NOT NULL,
  category      VARCHAR(80)  NOT NULL DEFAULT 'General',
  unit          VARCHAR(40)  NOT NULL DEFAULT 'piece',
  selling_price DECIMAL(12,2) NULL,
  reorder_level INT          NOT NULL DEFAULT 10,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_product_name (name)
) ENGINE=InnoDB;

-- Stock IN: deliveries from suppliers.
CREATE TABLE IF NOT EXISTS purchases (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  product_id   INT NOT NULL,
  supplier     VARCHAR(150),
  batch_number VARCHAR(80),
  expiry_date  DATE,
  quantity     INT NOT NULL,
  buying_price DECIMAL(12,2) NOT NULL,
  received_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  INDEX idx_purchases_product (product_id),
  INDEX idx_purchases_date (received_at),
  INDEX idx_purchases_expiry (expiry_date)
) ENGINE=InnoDB;

-- Cash shifts: opening float in, cash receipts accumulate, counted at close.
-- variance = declared - expected, stamped permanently per seller.
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

-- Receipts: one checkout = one receipt (many sale lines) with payment info.
-- M-Pesa STK receipts stay 'pending' until Safaricom's callback confirms.
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

-- Cart lines belonging to a receipt (held here until payment confirms).
CREATE TABLE IF NOT EXISTS receipt_items (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  receipt_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity   INT NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB;

-- Stock OUT: confirmed sale lines. cost_price locked at sale time.
CREATE TABLE IF NOT EXISTS sales (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  product_id    INT NOT NULL,
  user_id       INT NULL,
  receipt_id    INT NULL,
  quantity      INT NOT NULL,
  selling_price DECIMAL(12,2) NOT NULL,
  cost_price    DECIMAL(12,2) NOT NULL,
  sold_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE SET NULL,
  INDEX idx_sales_product (product_id),
  INDEX idx_sales_user (user_id),
  INDEX idx_sales_date (sold_at)
) ENGINE=InnoDB;
