SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'offboarding_processes' 
ORDER BY ordinal_position;
