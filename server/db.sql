CREATE TABLE IF NOT EXISTS applications (
  id SERIAL PRIMARY KEY, ref_no TEXT UNIQUE NOT NULL, name TEXT NOT NULL, age INT NOT NULL,
  village TEXT NOT NULL, income INT NOT NULL, bpl BOOLEAN NOT NULL, docs JSONB NOT NULL,
  stage INT NOT NULL DEFAULT 1 CHECK (stage BETWEEN 1 AND 3),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','returned')),
  submitted_at DATE NOT NULL DEFAULT CURRENT_DATE, due_at DATE NOT NULL, field_notes TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS history (
  id SERIAL PRIMARY KEY, application_id INT NOT NULL REFERENCES applications(id),
  stage INT NOT NULL, action TEXT NOT NULL, remark TEXT DEFAULT '', ai_used BOOLEAN DEFAULT false,
  at TIMESTAMPTZ NOT NULL DEFAULT now());
-- Sample data (docs: a=age proof, i=income cert, b=bank passbook, p=photo)
INSERT INTO applications (ref_no,name,age,village,income,bpl,docs,stage,status,submitted_at,due_at) VALUES
('SSY-0141','ಲಕ್ಷ್ಮಮ್ಮ',72,'ಚಿಕ್ಕನಹಳ್ಳಿ',12000,true,'{"a":true,"i":true,"b":true,"p":true}',1,'pending',CURRENT_DATE-33,CURRENT_DATE-3),
('SSY-0152','ಬಸವರಾಜ',68,'ಹೆಬ್ಬಾಳ',18000,true,'{"a":true,"i":true,"b":false,"p":true}',1,'pending',CURRENT_DATE-27,CURRENT_DATE+3),
('SSY-0160','ಸಾವಿತ್ರಮ್ಮ',81,'ಕೆಂಗೇರಿ',9000,true,'{"a":true,"i":true,"b":true,"p":true}',2,'pending',CURRENT_DATE-20,CURRENT_DATE+10),
('SSY-0171','ಹನುಮಂತಪ್ಪ',63,'ಮಾದನಾಯಕನಹಳ್ಳಿ',15000,true,'{"a":true,"i":true,"b":true,"p":true}',1,'pending',CURRENT_DATE-12,CURRENT_DATE+18),
('SSY-0175','ಗಂಗಮ್ಮ',70,'ಯಲಹಂಕ',45000,false,'{"a":true,"i":true,"b":true,"p":false}',3,'pending',CURRENT_DATE-25,CURRENT_DATE+5),
('SSY-0180','ರಂಗಣ್ಣ',77,'ಹೊಸಕೋಟೆ',10000,true,'{"a":true,"i":true,"b":true,"p":true}',3,'pending',CURRENT_DATE-8,CURRENT_DATE+22)
ON CONFLICT (ref_no) DO NOTHING;
