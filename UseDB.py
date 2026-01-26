from helpers import *
from config import *

def connect_to_db():   # connect to db
    conn = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD
    )
    return conn

def find_user_by_id(user_id):   # FIND user by id
    conn = connect_to_db()
    with conn.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
        row = cursor.fetchone()
        return row
    conn.close()

def add_user(tg_id, username):   # ADD user
    conn = connect_to_db()
    with conn.cursor() as cursor:
        cursor.execute("INSERT INTO users (tg_id, tg_username, balance, use) VALUES (%s, %s, %s, %s);", (tg_id, username, 0, False))  
        conn.commit()
        print("new user with id: " + str(tg_id))
    conn.close()

def transaction_status_update(discription, status):   # Edit dates users
    conn = connect_to_db()
    with conn.cursor() as cursor:
        cursor.execute("UPDATE transactions SET status = %s WHERE discription = %s;", (status, discription))  
        conn.commit()
        print("update transac status discription: " + str(discription))
    conn.close()
