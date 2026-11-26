-- The programme has one cohort; normalize existing roster assignments.
update public.users
   set cohort = 'Cohort 1'
 where member_code is not null
    or cohort is not null;
