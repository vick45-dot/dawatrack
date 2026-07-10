-- Preset counter selling prices for the sample seed products.
-- For fresh v2 installs that loaded seed.sql. Safe to run repeatedly.
USE dawatrack;
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
