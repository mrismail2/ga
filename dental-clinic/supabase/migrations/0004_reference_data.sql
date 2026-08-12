-- ============================================================================
-- Reference data only.
--
-- This is configuration the clinic needs on day one — treatment price list,
-- medicine categories, clinic settings. There are deliberately NO sample
-- patients, treatments or payments: the clinic's real records are the only
-- data that should ever exist in this database.
-- ============================================================================

insert into clinic_settings (id) values (true) on conflict (id) do nothing;

-- Names are in Af-Soomaali because that is the language the clinic works in.
-- The codes stay in English so they read the same in exports and receipts, and
-- every name can be edited from Settings → Treatments & prices.
insert into treatment_types (code, name, category, default_price, sort_order) values
  ('CONSULT',    'La-talin',                     'general',       5,   10),
  ('EXAM',       'Baaritaan ilkeed',             'general',       5,   20),
  ('SCALING',    'Nadiifin ilkeed',              'preventive',    20,  30),
  ('FILLING',    'Buuxin ilig',                  'restorative',   25,  40),
  ('EXTRACT',    'Siibid ilig',                  'surgical',      15,  50),
  ('EXTRACT_S',  'Siibid qalliin ah',            'surgical',      40,  60),
  ('RCT',        'Daaweynta xididka iliga',      'endodontic',    120, 70),
  ('CROWN',      'Koron (dhar ilig)',            'prosthetic',    150, 80),
  ('BRIDGE',     'Buundo ilkeed',                'prosthetic',    300, 90),
  ('IMPLANT',    'Ilig la beero',                'surgical',      600, 100),
  ('DENTURE',    'Ilko rakiban',                 'prosthetic',    250, 110),
  ('WHITENING',  'Caddeynta ilkaha',             'cosmetic',      80,  120),
  ('ORTHO',      'Qalinka ilkaha',               'orthodontic',   500, 130),
  ('ORTHO_ADJ',  'Hagaajinta qalinka',           'orthodontic',   10,  140),
  ('RETAINER',   'Hayaha ilkaha',                'orthodontic',   90,  150),
  ('PEDO',       'Daaweynta ilkaha carruurta',   'pediatric',     20,  160),
  ('GUM',        'Daaweynta xanjada',            'periodontal',   35,  170),
  ('OTHER',      'Kale',                         'general',       0,   999)
on conflict (code) do nothing;

insert into medicine_categories (name) values
  ('Antibiyootig'), ('Xanuun-joojiye'), ('Suuxin'), ('Barar-joojiye'),
  ('Antiseptig / af-dhaqe'), ('Fluoride / ka-hortag'), ('Hal-mar isticmaal'), ('Kale')
on conflict (name) do nothing;
