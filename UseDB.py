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

def find_user_by_username_passwd(username, passwd_hash):   # FIND user by requs
    conn = connect_to_db()
    with conn.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute("SELECT * FROM users WHERE username = %s AND passwd_hash = %s", (username, passwd_hash,))
        row = cursor.fetchone()
        return row
    conn.close()

def find_user_by_cookie_token(token):   # FIND user by token
    conn = connect_to_db()
    with conn.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute("SELECT * FROM users WHERE cookie = %s", (token,))
        row = cursor.fetchone()
        return row
    conn.close()

def user_cookie_token_update(username, token):   # Edit cookie users
    conn = connect_to_db()
    with conn.cursor() as cursor:
        cursor.execute("UPDATE users SET cookie = %s WHERE username = %s;", (token, username))  
        conn.commit()
        print("update cookie to " + str(username))
    conn.close()

def add_event(username, type, time):   # ADD event
    conn = connect_to_db()
    with conn.cursor() as cursor:
        cursor.execute("INSERT INTO events (username, type, time) VALUES (%s, %s, %s);", (username, type, time))  
        conn.commit()
        print(f"user {username}, created event type {type}, at {time}")
    conn.close()

def select_user_events(username): #SELECT ALL events for user  
    conn = connect_to_db()
    with conn.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute("SELECT * FROM events WHERE username = %s", (username,))
        row = cursor.fetchall()
        return row
    conn.close()

# def transaction_status_update(discription, status):   # Edit dates users
#     conn = connect_to_db()
#     with conn.cursor() as cursor:
#         cursor.execute("UPDATE transactions SET status = %s WHERE discription = %s;", (status, discription))  
#         conn.commit()
#         print("update transac status discription: " + str(discription))
#     conn.close()
