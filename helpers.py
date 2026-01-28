import fastapi
import psycopg2
from psycopg2.extras import RealDictCursor, Json
from fastapi import FastAPI, Path, Query, Body, Header, Depends, HTTPException, status, Request, Response, Cookie
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import time
from datetime import datetime, timedelta
import secrets
import hashlib
from typing import Union, Optional
import json

def generate_cookie_token(nbytes=32):
    return secrets.token_urlsafe(nbytes)

def get_current_time_iso():
    return str(datetime.now().isoformat(timespec='minutes'))