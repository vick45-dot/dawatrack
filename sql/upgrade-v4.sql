-- DawaTrack v3 -> v4: in-app payment settings (owner-configurable).
-- Safe to run more than once. MySQL 8 + MariaDB compatible.
USE dawatrack;

CREATE TABLE IF NOT EXISTS settings (
  name       VARCHAR(64) PRIMARY KEY,
  value      TEXT,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Defaults (INSERT IGNORE keeps any values the owner already saved)
INSERT IGNORE INTO settings (name, value) VALUES
('pay.cash.enabled',     '1'),
('pay.mpesa.enabled',    '1'),
('pay.card.enabled',     '0'),
('pay.paypal.enabled',   '0'),
('pay.applepay.enabled', '0'),
('pay.other.enabled',    '0'),
('mpesa.kind',           'paybill'),   -- paybill | till | pochi
('mpesa.shortcode',      ''),
('mpesa.party_b',        ''),          -- till number (Buy Goods); blank = same as shortcode
('mpesa.pochi_phone',    ''),
('mpesa.consumer_key',   ''),
('mpesa.consumer_secret',''),
('mpesa.passkey',        ''),
('mpesa.env',            'sandbox'),   -- sandbox | production
('mpesa.simulate',       '0'),
('app.public_url',       '');
