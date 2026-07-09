-- DawaTrack v2: Chemist Stock & Profit Management (fresh install)
-- phpMyAdmin: SQL tab > paste > Go. Or: mysql -u root -p < sql/schema.sql
-- Existing v1 database? Use sql/upgrade.sql instead.

CREATE DATABASE IF NOT EXISTS dawatrack CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE dawatrack;

-- User accounts. Owner sees everything; sellers only record sales.
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

-- Default owner account. Username: admin  Password: admin123
-- !! CHANGE THIS PASSWORD after first login !!
INSERT INTO users (name, username, password_hash, role)
SELECT 'Owner', 'admin', '$2a$10$WfEWoTJ.7w6g2tcvUolRM.efc5X10MUZ2l.r0TfRCnOCt4Ip6ONJe', 'owner'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin');

-- Master list of products. Stock on hand is NEVER stored;
-- it is always (total purchased) - (total sold).
-- selling_price is the owner-set counter price sellers must use.
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

-- Stock IN: every delivery/purchase from a supplier.
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

-- Stock OUT: every sale, tagged with WHO sold it.
-- cost_price is locked at sale time (weighted average buying cost).
CREATE TABLE IF NOT EXISTS sales (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  product_id    INT NOT NULL,
  user_id       INT NULL,
  quantity      INT NOT NULL,
  selling_price DECIMAL(12,2) NOT NULL,
  cost_price    DECIMAL(12,2) NOT NULL,
  sold_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_sales_product (product_id),
  INDEX idx_sales_user (user_id),
  INDEX idx_sales_date (sold_at)
) ENGINE=InnoDB;
