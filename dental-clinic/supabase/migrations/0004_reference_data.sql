-- ============================================================================
-- Reference data only.
--
-- This is configuration the clinic needs on day one — treatment price list,
-- medicine categories, clinic settings. There are deliberately NO sample
-- patients, treatments or payments: the clinic's real records are the only
-- data that should ever exist in this database.
-- ============================================================================

insert into clinic_settings (id) values (true) on conflict (id) do nothing;

insert into treatment_types (code, name, category, default_price, sort_order) values
  ('CONSULT',    'Consultation',              'general',       5,   10),
  ('EXAM',       'Dental examination',        'general',       5,   20),
  ('SCALING',    'Scaling / cleaning',        'preventive',    20,  30),
  ('FILLING',    'Filling',                   'restorative',   25,  40),
  ('EXTRACT',    'Tooth extraction',          'surgical',      15,  50),
  ('EXTRACT_S',  'Surgical extraction',       'surgical',      40,  60),
  ('RCT',        'Root canal treatment',      'endodontic',    120, 70),
  ('CROWN',      'Crown',                     'prosthetic',    150, 80),
  ('BRIDGE',     'Bridge',                    'prosthetic',    300, 90),
  ('IMPLANT',    'Implant',                   'surgical',      600, 100),
  ('DENTURE',    'Denture',                   'prosthetic',    250, 110),
  ('WHITENING',  'Teeth whitening',           'cosmetic',      80,  120),
  ('ORTHO',      'Orthodontics / braces',     'orthodontic',   500, 130),
  ('ORTHO_ADJ',  'Braces adjustment',         'orthodontic',   10,  140),
  ('RETAINER',   'Retainer',                  'orthodontic',   90,  150),
  ('PEDO',       'Pediatric dental treatment','pediatric',     20,  160),
  ('GUM',        'Gum treatment',             'periodontal',   35,  170),
  ('OTHER',      'Other',                     'general',       0,   999)
on conflict (code) do nothing;

insert into medicine_categories (name) values
  ('Antibiotic'), ('Analgesic'), ('Anaesthetic'), ('Anti-inflammatory'),
  ('Antiseptic / mouthwash'), ('Fluoride / preventive'), ('Disposable'), ('Other')
on conflict (name) do nothing;
