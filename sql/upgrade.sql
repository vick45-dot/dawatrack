-- DawaTrack v1 -> v2 upgrade. Safe to run more than once.
-- Compatible with both MySQL 8.x and MariaDB.
USE dawatrack;

-- 1. User accounts
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

-- 2. sales.user_id column (only if missing)
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sales' AND COLUMN_NAME = 'user_id');
SET @q := IF(@c = 0, 'ALTER TABLE sales ADD COLUMN user_id INT NULL AFTER product_id', 'SELECT 1');
PREPARE st FROM @q; EXECUTE st; DEALLOCATE PREPARE st;

-- 3. foreign key sales.user_id -> users.id (only if missing)
SET @c := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sales' AND CONSTRAINT_NAME = 'fk_sales_user');
SET @q := IF(@c = 0, 'ALTER TABLE sales ADD CONSTRAINT fk_sales_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL', 'SELECT 1');
PREPARE st FROM @q; EXECUTE st; DEALLOCATE PREPARE st;

-- 4. products.selling_price column (only if missing)
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'selling_price');
SET @q := IF(@c = 0, 'ALTER TABLE products ADD COLUMN selling_price DECIMAL(12,2) NULL AFTER unit', 'SELECT 1');
PREPARE st FROM @q; EXECUTE st; DEALLOCATE PREPARE st;

-- 5. Preset prices for sample products (harmless if seed.sql was not loaded)
UPDATE products SET selling_price = 105.00 WHERE name = 'Panadol 500mg (24s)'       AND selling_price IS NULL;
UPDATE products SET selling_price = 310.00 WHERE name = 'Amoxicillin 500mg (21s)'   AND selling_price IS NULL;
UPDATE products SET selling_price = 100.00 WHERE name = 'Piriton 4mg (28s)'         AND selling_price IS NULL;
UPDATE products SET selling_price =  60.00 WHERE name = 'Mara Moja Tabs (12s)'      AND selling_price IS NULL;
UPDATE products SET selling_price =  30.00 WHERE name = 'Zinc + ORS Sachets'        AND selling_price IS NULL;
UPDATE products SET selling_price = 380.00 WHERE name = 'Benylin Cough Syrup 100ml' AND selling_price IS NULL;
UPDATE products SET selling_price = 320.00 WHERE name = 'Deep Heat Rub 35g'         AND selling_price IS NULL;
UPDATE products SET selling_price = 120.00 WHERE name = 'Surgical Spirit 100ml'     AND selling_price IS NULL;
UPDATE products SET selling_price =  80.00 WHERE name = 'Cotton Wool 100g'          AND selling_price IS NULL;
UPDATE products SET selling_price = 180.00 WHERE name = 'Vitamin C 1000mg (20s)'    AND selling_price IS NULL;
