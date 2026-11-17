-- Member roster from the facilitator spreadsheet ("Untitledspreadsheet.xlsx").
--
-- Sheet 1 lists 44 people. Fatma Namanda Webbo and Alphonce Akileng are excluded
-- from membership per the programme's instruction, so 43 members are seeded
-- (Alphonce never appears on the roster sheet; Fatma's row is skipped here).
--
-- Sheet 2 assigns each member to Pioneer Group or Cohort 1; the spelling
-- variants in that sheet are normalized to the official roster name.
--
-- Re-runnable: members are matched on email, so an existing row keeps its id and
-- any live attendance tied to it, and only the roster fields are refreshed.

with roster (id, email, full_name, national_id, phone, cohort, member_code) as (
  values
  (md5('miguellewis575@gmail.com')::uuid, 'miguellewis575@gmail.com', 'Miguel Karomo', '299253361', '0116103175', 'Pioneer Group', 'miguellewis575'),
  (md5('armstrongouma28@gmail.com')::uuid, 'armstrongouma28@gmail.com', 'Armstrong Ouma Otsyula', '560716646', '0700087940', 'Cohort 1', 'armstrongouma28'),
  (md5('neemakmwangi@gmail.com')::uuid, 'neemakmwangi@gmail.com', 'Neema Karimi', '477819557', '0110044794', 'Cohort 1', 'neemakmwangi'),
  (md5('elsiewmunge@gmail.com')::uuid, 'elsiewmunge@gmail.com', 'Elsie Wanjiru Munge', '532732214', '0791346021', 'Pioneer Group', 'elsiewmunge'),
  (md5('mulatiryan75@gmail.com')::uuid, 'mulatiryan75@gmail.com', 'Ryan Mulati', '170947105', '0727722907', 'Pioneer Group', 'mulatiryan75'),
  (md5('resonhilda@gmail.com')::uuid, 'resonhilda@gmail.com', 'Hilda Reson', '167899868', '0791839615', 'Cohort 1', 'resonhilda'),
  (md5('benedictfelicity7@gmail.com')::uuid, 'benedictfelicity7@gmail.com', 'Felicity John Benedict', '321363294', '0795538566', 'Pioneer Group', 'benedictfelicity7'),
  (md5('hopendanu283@gmail.com')::uuid, 'hopendanu283@gmail.com', 'Hope Sila', '554978177', '0748698453', 'Cohort 1', 'hopendanu283'),
  (md5('esthernganyi9@gmail.com')::uuid, 'esthernganyi9@gmail.com', 'Esther Nganyi', '578328033', '0757679484', 'Cohort 1', 'esthernganyi9'),
  (md5('gloriahadassah58@gmail.com')::uuid, 'gloriahadassah58@gmail.com', 'Gloria Hadassah', '156608243', '0113654614', 'Cohort 1', 'gloriahadassah58'),
  (md5('fellydestiny@gmail.com')::uuid, 'fellydestiny@gmail.com', 'Destiny Felly', '42158152', '0796057886', 'Pioneer Group', 'fellydestiny'),
  (md5('selinawferuzi@gmail.com')::uuid, 'selinawferuzi@gmail.com', 'Selina Feruzi', '375181147', '0741865975', 'Pioneer Group', 'selinawferuzi'),
  (md5('wigwa9657@gmail.com')::uuid, 'wigwa9657@gmail.com', 'Pepetual Muthoni Wigwa', '214155174', '0799158749', 'Cohort 1', 'wigwa9657'),
  (md5('charlesotsyula65@gmail.com')::uuid, 'charlesotsyula65@gmail.com', 'Charles Otsyula', '188197118', '0768668571', 'Pioneer Group', 'charlesotsyula65'),
  (md5('soitamukambi@gmail.com')::uuid, 'soitamukambi@gmail.com', 'Mukambi Mark Soita', '228203814', '0113570420', 'Cohort 1', 'soitamukambi'),
  (md5('whitmakambi@gmail.com')::uuid, 'whitmakambi@gmail.com', 'Whitney Makambi', '747514046', '0790695207', 'Cohort 1', 'whitmakambi'),
  (md5('brian.miloh@gmail.com')::uuid, 'brian.miloh@gmail.com', 'Milo Brian', '745077406', '0791441659', 'Pioneer Group', 'brian-miloh'),
  (md5('nyoherovicky@gmail.com')::uuid, 'nyoherovicky@gmail.com', 'Vicky Nyohero', '993049172', '0111397738', 'Pioneer Group', 'nyoherovicky'),
  (md5('b3877901@gmail.com')::uuid, 'b3877901@gmail.com', 'Betty Nyambura Wanjiru', '42267760', '0797190526', 'Pioneer Group', 'b3877901'),
  (md5('christellehope.ella@gmail.com')::uuid, 'christellehope.ella@gmail.com', 'Oyugi Christelle Hope', '418360523', '0713216317', 'Pioneer Group', 'christellehope-ella'),
  (md5('gitongakeziah21@gmail.com')::uuid, 'gitongakeziah21@gmail.com', 'Keziah Gitonga', '615600165', '0717633103', 'Pioneer Group', 'gitongakeziah21'),
  (md5('misianimakori@gmail.com')::uuid, 'misianimakori@gmail.com', 'Samuel Makori Misiani', '792183890', '0704019676 / 0789428967', 'Pioneer Group', 'misianimakori'),
  (md5('berthaonyango23@gmail.com')::uuid, 'berthaonyango23@gmail.com', 'Natalie Bertha Akinyi Onyango', '40039518', '0100309209', 'Pioneer Group', 'berthaonyango23'),
  (md5('joanitakarenwanjiru@gmail.com')::uuid, 'joanitakarenwanjiru@gmail.com', 'Joanita Karen Wanjiru Wangui', '42022233', '0794817130', 'Pioneer Group', 'joanitakarenwanjiru'),
  (md5('gathuaryan67@gmail.com')::uuid, 'gathuaryan67@gmail.com', 'Ryan Nyange', '21441848', '0114379996', 'Cohort 1', 'gathuaryan67'),
  (md5('hopekuria06@gmail.com')::uuid, 'hopekuria06@gmail.com', 'Gracehope Wanjiku Kuria', '763065623', '0702148626', 'Pioneer Group', 'hopekuria06'),
  (md5('mwangivictorywanjugu@gmail.com')::uuid, 'mwangivictorywanjugu@gmail.com', 'Victory Mwangi', '538398616', '0799542197', 'Pioneer Group', 'mwangivictorywanjugu'),
  (md5('tuniezei@gmail.com')::uuid, 'tuniezei@gmail.com', 'Olive Gala Enane', '42578431', '0740714411', 'Pioneer Group', 'tuniezei'),
  (md5('issackbasma@gmail.com')::uuid, 'issackbasma@gmail.com', 'Basma Issack Osman', '149715449', '0797447709', 'Pioneer Group', 'issackbasma'),
  (md5('mariwa.tandy@gmail.com')::uuid, 'mariwa.tandy@gmail.com', 'Tandy Mariwa Owino', '288235223', '0111386172', 'Pioneer Group', 'mariwa-tandy'),
  (md5('awuormichelle07@gmail.com')::uuid, 'awuormichelle07@gmail.com', 'Michelle Awour', '806735357', '0769806282', 'Pioneer Group', 'awuormichelle07'),
  (md5('ashitsachelsea@gmail.com')::uuid, 'ashitsachelsea@gmail.com', 'Chelsea Ashitsa', '658550320', '0798626351', 'Cohort 1', 'ashitsachelsea'),
  (md5('mwende.natalie06@gmail.com')::uuid, 'mwende.natalie06@gmail.com', 'Natalie Mwende Musyoki', '235626036', '0758858126', 'Pioneer Group', 'mwende-natalie06'),
  (md5('keishanyawira@gmail.com')::uuid, 'keishanyawira@gmail.com', 'Keisha Nyawira Wahome', '142466710', '0708726844', 'Pioneer Group', 'keishanyawira'),
  (md5('armonkiprotich@gmail.com')::uuid, 'armonkiprotich@gmail.com', 'Armon Kiprotich', '191960311', '0703266118', 'Pioneer Group', 'armonkiprotich'),
  (md5('lavettenoelah@gmail.com')::uuid, 'lavettenoelah@gmail.com', 'Lavette Noelah Onene', '403792838', '0717738153', 'Cohort 1', 'lavettenoelah'),
  (md5('barrackalusa@gmail.com')::uuid, 'barrackalusa@gmail.com', 'Barrack Alusa', '150573025', '0711698640', 'Pioneer Group', 'barrackalusa'),
  (md5('chesoni.belinda@gmail.com')::uuid, 'chesoni.belinda@gmail.com', 'Angel Chesoni', '361951345', '0759228081', 'Pioneer Group', 'chesoni-belinda'),
  (md5('hamiltonmwaila06@gmail.com')::uuid, 'hamiltonmwaila06@gmail.com', 'Hamilton Mwaila', '642801883', '0116811764', 'Cohort 1', 'hamiltonmwaila06'),
  (md5('ivanrayodundo@gmail.com')::uuid, 'ivanrayodundo@gmail.com', 'Ivan Ray Omondi', '583093929', '0110760401', 'Cohort 1', 'ivanrayodundo'),
  (md5('ishwaaqabdiwahabali@gmail.com')::uuid, 'ishwaaqabdiwahabali@gmail.com', 'Ishwaaq Abdiwahab', '355256474', '0726768433', 'Pioneer Group', 'ishwaaqabdiwahabali'),
  (md5('rabasaandrew@gmail.com')::uuid, 'rabasaandrew@gmail.com', 'Andrew Rabasa', '956933012', '0118331299', 'Pioneer Group', 'rabasaandrew'),
  (md5('iteyokhaisia@gmail.com')::uuid, 'iteyokhaisia@gmail.com', 'Iteyo Khaisia', '486744909', '0748047581', 'Pioneer Group', 'iteyokhaisia')
)
insert into public.users (id, email, full_name, role, national_id, phone, cohort, member_code, status, source)
select id,
       lower(email),
       full_name,
       'student',
       national_id,
       phone,
       cohort,
       member_code,
       'active',
       'daraja-member-roster'
from roster
on conflict (email) do update set
  full_name = excluded.full_name,
  national_id = excluded.national_id,
  phone = excluded.phone,
  cohort = excluded.cohort,
  member_code = excluded.member_code,
  source = excluded.source;
