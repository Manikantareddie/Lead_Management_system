import os
import getpass
import psycopg

host = os.getenv("SUPABASE_HOST")
port = int(os.getenv("SUPABASE_PORT", "5432"))
dbname = os.getenv("SUPABASE_DBNAME", "postgres")
user = os.getenv("SUPABASE_USER")

if not host or not user:
    raise SystemExit("Set SUPABASE_HOST and SUPABASE_USER before testing the connection.")

password = getpass.getpass("Enter your Supabase database password: ")

try:
    with psycopg.connect(
        host=host,
        port=port,
        dbname=dbname,
        user=user,
        password=password,
        sslmode="require",
        connect_timeout=15,
    ) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT current_database(), current_user;")
            print("Connection successful!")
            print("Database and user:", cur.fetchone())

except Exception as error:
    print("Connection failed:", error)
