from helpers import *
from UseDB import *

app = FastAPI()

@app.post("/login")
def login(username: Union[str, None] = Header(...), passwd: Union[str, None] = Header(...)):
    user = find_user_by_username_passwd(str(username), hashlib.sha256(str(passwd).encode('utf-8')).hexdigest())

    if user:
        cookie_token = generate_cookie_token()
        user_cookie_token_update(username, cookie_token)
        #print(cookie_token)

        response = JSONResponse(content={"message": "Logged in"}, status_code=201)
        response.set_cookie(key="session_token", value=cookie_token)
        return response
    else:
        return JSONResponse(status_code=403, content={"message": "invalid you"})
    

@app.post("/create_event") #for esp, not cookie
def create_event(type: Union[str, None] = None, username: Union[str, None] = Header(None), passwd: Union[str, None] = Header(None)):
    user = find_user_by_username_passwd(str(username), hashlib.sha256(str(passwd).encode('utf-8')).hexdigest())

    if user:
        add_event(user["username"], type, str(get_current_time_iso()))
        return JSONResponse(status_code=201, content={"message": "added"})
    else:
        return JSONResponse(status_code=403, content={"message": "invalid you"})
    
@app.get("/me")
def get_all_events_my(request: Request):
    token = request.cookies.get("session_token")
    #print(token)
    user = find_user_by_cookie_token(token)

    if user:
        events = select_user_events(user.get("username"))
        events_list = [dict(event) for event in events]
        return JSONResponse(status_code=200, content=events_list)
    else:
        return JSONResponse(status_code=403, content={"message": "invalid you"})


app.mount("/", StaticFiles(directory="static", html=True), name="static")