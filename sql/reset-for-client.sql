-- DawaTrack: RESET FOR CLIENT HANDOVER
-- Wipes ALL demo/test data and returns the system to a factory-fresh state:
-- no products, no sales, no shifts, only the default admin account and
-- default settings. THIS CANNOT BE UNDONE - export a backup first if unsure.
--
-- Run: node load-sql.js sql/reset-for-client.sql   (or phpMyAdmin Import)
USE dawatrack;

-- Order matters: children before parents (foreign keys)
DELETE FROM receipt_items;
DELETE FROM sales;
DELETE FROM receipts;
DELETE FROM shifts;
DELETE FROM purchases;
DELETE FROM products;
DELETE FROM users;

-- Reset auto-increment counters so the client's data starts from #1
ALTER TABLE receipt_items AUTO_INCREMENT = 1;
ALTER TABLE sales         AUTO_INCREMENT = 1;
ALTER TABLE receipts      AUTO_INCREMENT = 1;
ALTER TABLE shifts        AUTO_INCREMENT = 1;
ALTER TABLE purchases     AUTO_INCREMENT = 1;
ALTER TABLE products      AUTO_INCREMENT = 1;
ALTER TABLE users         AUTO_INCREMENT = 1;

-- Fresh default owner. Username: admin  Password: admin123
-- Change it together with the client at handover.
INSERT INTO users (name, username, password_hash, role)
VALUES ('Owner', 'admin', '$2a$10$WfEWoTJ.7w6g2tcvUolRM.efc5X10MUZ2l.r0TfRCnOCt4Ip6ONJe', 'owner');

-- Settings back to factory defaults (client configures their own payments)
DELETE FROM settings;
INSERT INTO settings (name, value) VALUES
('pay.cash.enabled','1'),('pay.mpesa.enabled','1'),('pay.card.enabled','0'),
('pay.paypal.enabled','0'),('pay.applepay.enabled','0'),('pay.bank.enabled','0'),('pay.other.enabled','0'),
('bank.name',''),('bank.account_name',''),('bank.account_number',''),
('mpesa.kind','paybill'),('mpesa.shortcode',''),('mpesa.party_b',''),
('mpesa.pochi_phone',''),('mpesa.consumer_key',''),('mpesa.consumer_secret',''),
('mpesa.passkey',''),('mpesa.env','sandbox'),('mpesa.simulate','0'),('app.public_url','');
