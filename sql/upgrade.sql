-- DawaTrack v2 upgrade: run this ONCE on an existing dawatrack database.
-- phpMyAdmin: click the dawatrack database > Import > choose this file > Go.
USE dawatrack;

-- 1. User accounts (owner sees everything; sellers only record sales)
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
-- !! CHANGE THIS PASSWORD after first login (Sellers page > your account) !!
INSERT INTO users (name, username, password_hash, role)
SELECT 'Owner', 'admin', '$2a$10$WfEWoTJ.7w6g2tcvUolRM.efc5X10MUZ2l.r0TfRCnOCt4Ip6ONJe', 'owner'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin');

-- 2. Track WHO recorded each sale (old rows stay NULL = "before user tracking")
ALTER TABLE sales ADD COLUMN IF NOT EXISTS user_id INT NULL AFTER product_id;
ALTER TABLE sales ADD CONSTRAINT fk_sales_user
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- 3. Owner-controlled selling price per product (sellers cannot change it)
ALTER TABLE products ADD COLUMN IF NOT EXISTS selling_price DECIMAL(12,2) NULL AFTER unit;

-- 4. Preset selling prices for the sample products (matches the seed data).
--    Harmless if you did not load seed.sql.
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
