-- Optional sample data so the dashboard and analytics are not empty.
-- Run AFTER schema.sql:  mysql -u root -p dawatrack < sql/seed.sql
USE dawatrack;

INSERT INTO products (name, category, unit, reorder_level) VALUES
('Panadol 500mg (24s)',        'Painkillers',   'packet', 15),
('Amoxicillin 500mg (21s)',    'Antibiotics',   'packet', 10),
('Piriton 4mg (28s)',          'Antihistamine', 'packet', 10),
('Mara Moja Tabs (12s)',       'Painkillers',   'packet', 20),
('Zinc + ORS Sachets',         'Rehydration',   'sachet', 25),
('Benylin Cough Syrup 100ml',  'Cough & Cold',  'bottle', 8),
('Deep Heat Rub 35g',          'Topical',       'tube',   6),
('Surgical Spirit 100ml',      'First Aid',     'bottle', 10),
('Cotton Wool 100g',           'First Aid',     'roll',   12),
('Vitamin C 1000mg (20s)',     'Supplements',   'packet', 10);

-- Purchases (stock in) spread over the last ~10 months
INSERT INTO purchases (product_id, supplier, batch_number, expiry_date, quantity, buying_price, received_at) VALUES
(1,'Dawa Pharma Ltd','PAN-2401', DATE_ADD(CURDATE(), INTERVAL 14 MONTH), 120,  60.00, DATE_SUB(NOW(), INTERVAL 300 DAY)),
(2,'Kenya Meds Supply','AMX-2402', DATE_ADD(CURDATE(), INTERVAL 10 MONTH),  80, 180.00, DATE_SUB(NOW(), INTERVAL 290 DAY)),
(3,'Dawa Pharma Ltd','PIR-2403', DATE_ADD(CURDATE(), INTERVAL 18 MONTH),  60,  55.00, DATE_SUB(NOW(), INTERVAL 280 DAY)),
(4,'Nakuru Wholesale Chemists','MMJ-2404', DATE_ADD(CURDATE(), INTERVAL 12 MONTH), 150,  35.00, DATE_SUB(NOW(), INTERVAL 260 DAY)),
(5,'Kenya Meds Supply','ORS-2405', DATE_ADD(CURDATE(), INTERVAL 20 MONTH), 200,  15.00, DATE_SUB(NOW(), INTERVAL 250 DAY)),
(6,'Dawa Pharma Ltd','BEN-2406', DATE_ADD(CURDATE(), INTERVAL 8 MONTH),   40, 240.00, DATE_SUB(NOW(), INTERVAL 220 DAY)),
(7,'Nakuru Wholesale Chemists','DHR-2407', DATE_ADD(CURDATE(), INTERVAL 16 MONTH), 30, 210.00, DATE_SUB(NOW(), INTERVAL 200 DAY)),
(8,'Kenya Meds Supply','SSP-2408', DATE_ADD(CURDATE(), INTERVAL 24 MONTH),  50,  70.00, DATE_SUB(NOW(), INTERVAL 180 DAY)),
(9,'Dawa Pharma Ltd','CTW-2409', DATE_ADD(CURDATE(), INTERVAL 30 MONTH),   70,  45.00, DATE_SUB(NOW(), INTERVAL 170 DAY)),
(10,'Kenya Meds Supply','VTC-2410', DATE_ADD(CURDATE(), INTERVAL 11 MONTH), 90, 110.00, DATE_SUB(NOW(), INTERVAL 160 DAY)),
-- restocks (note higher buying prices later - average cost handles this)
(1,'Dawa Pharma Ltd','PAN-2411', DATE_ADD(CURDATE(), INTERVAL 16 MONTH), 100,  65.00, DATE_SUB(NOW(), INTERVAL 120 DAY)),
(4,'Nakuru Wholesale Chemists','MMJ-2412', DATE_ADD(CURDATE(), INTERVAL 14 MONTH), 100,  38.00, DATE_SUB(NOW(), INTERVAL 100 DAY)),
(5,'Kenya Meds Supply','ORS-2413', DATE_ADD(CURDATE(), INTERVAL 22 MONTH), 150,  16.00, DATE_SUB(NOW(), INTERVAL 90 DAY)),
(2,'Kenya Meds Supply','AMX-2414', DATE_ADD(CURDATE(), INTERVAL 12 MONTH),  60, 190.00, DATE_SUB(NOW(), INTERVAL 60 DAY)),
(6,'Dawa Pharma Ltd','BEN-2415', DATE_ADD(CURDATE(), INTERVAL 2 MONTH),    25, 250.00, DATE_SUB(NOW(), INTERVAL 30 DAY));

-- Sales (stock out) spread across days, weeks and months.
-- cost_price mirrors the weighted average buying cost at the time.
INSERT INTO sales (product_id, quantity, selling_price, cost_price, sold_at) VALUES
(1, 10, 100.00, 60.00, DATE_SUB(NOW(), INTERVAL 280 DAY)),
(4, 20,  60.00, 35.00, DATE_SUB(NOW(), INTERVAL 255 DAY)),
(2,  6, 300.00,180.00, DATE_SUB(NOW(), INTERVAL 240 DAY)),
(5, 30,  30.00, 15.00, DATE_SUB(NOW(), INTERVAL 230 DAY)),
(3,  8, 100.00, 55.00, DATE_SUB(NOW(), INTERVAL 210 DAY)),
(6,  5, 380.00,240.00, DATE_SUB(NOW(), INTERVAL 190 DAY)),
(1, 15, 100.00, 60.00, DATE_SUB(NOW(), INTERVAL 175 DAY)),
(7,  4, 320.00,210.00, DATE_SUB(NOW(), INTERVAL 150 DAY)),
(8, 10, 120.00, 70.00, DATE_SUB(NOW(), INTERVAL 140 DAY)),
(9, 12,  80.00, 45.00, DATE_SUB(NOW(), INTERVAL 130 DAY)),
(10, 9, 180.00,110.00, DATE_SUB(NOW(), INTERVAL 115 DAY)),
(1, 20, 100.00, 62.27, DATE_SUB(NOW(), INTERVAL 100 DAY)),
(4, 25,  60.00, 36.20, DATE_SUB(NOW(), INTERVAL 85 DAY)),
(5, 40,  30.00, 15.43, DATE_SUB(NOW(), INTERVAL 70 DAY)),
(2, 10, 300.00,184.29, DATE_SUB(NOW(), INTERVAL 50 DAY)),
(3, 10, 100.00, 55.00, DATE_SUB(NOW(), INTERVAL 40 DAY)),
(6,  8, 380.00,243.85, DATE_SUB(NOW(), INTERVAL 25 DAY)),
(1, 12, 105.00, 62.27, DATE_SUB(NOW(), INTERVAL 14 DAY)),
(5, 25,  30.00, 15.43, DATE_SUB(NOW(), INTERVAL 10 DAY)),
(4, 15,  60.00, 36.20, DATE_SUB(NOW(), INTERVAL 7 DAY)),
(10, 6, 180.00,110.00, DATE_SUB(NOW(), INTERVAL 5 DAY)),
(2,  4, 310.00,184.29, DATE_SUB(NOW(), INTERVAL 3 DAY)),
(1,  8, 105.00, 62.27, DATE_SUB(NOW(), INTERVAL 1 DAY)),
(9,  5,  80.00, 45.00, NOW());
