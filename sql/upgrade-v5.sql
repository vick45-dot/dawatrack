-- DawaTrack v4 -> v5: bank payment option with owner-configured account details.
-- Safe to run more than once. MySQL 8 + MariaDB compatible.
USE dawatrack;

ALTER TABLE receipts MODIFY payment_method
  ENUM('cash','mpesa','card','paypal','applepay','bank','other') NOT NULL;

INSERT IGNORE INTO settings (name, value) VALUES
('pay.bank.enabled',   '0'),
('bank.name',          ''),
('bank.account_name',  ''),
('bank.account_number','');
