#THIS CODE IS AI OPTIMISATION OF esp-main.py

import network
from machine import Pin, Timer
import time
import urequests
import socket
import gc
import json
import tm1637
import os

API_HOST = "http://192.168.0.9:8000"
API_USERNAME = "admin"
API_PASSWD = "1234"
WIFI_SSID = "Keenetic-4568"
WIFI_PASSWD = "rCYPpYmu"

config = {
    'API_HOST': "http://192.168.0.9:8000",
    'API_USERNAME': "admin",
    'API_PASSWD': "1234",
    'WIFI_SSID': "Keenetic-4568",
    'WIFI_PASSWD': "rCYPpYmu"
}

button_d1 = Pin(5, Pin.IN, Pin.PULL_UP)
button_d2 = Pin(4, Pin.IN, Pin.PULL_UP)
button_d3 = Pin(0, Pin.IN, Pin.PULL_UP)
button_d4 = Pin(2, Pin.IN, Pin.PULL_UP)

last_d1 = 1
last_d2 = 1
last_d3 = 1
last_d4 = 1
d2_press_time = 0

sta_if = network.WLAN(network.STA_IF)
ap_if = network.WLAN(network.AP_IF)

tm = tm1637.TM1637(clk=Pin(14), dio=Pin(12))
tm.numbers(00, 00)

timer_running = False
start_time = 0
elapsed_time = 0
colon_state = True
display_timer = Timer(-1)

def load_timer_state():
    print("load timer disp time-----++++")
    try:
        with open('time.txt', 'r') as f:
            data = f.read().strip()
            if data:
                print("data timer disp loadred and return----++++")
                return int(data)
    except:
        pass
    return 0

def save_timer_state():
    print("saving timer disp-----++++")
    with open('time.txt', 'w') as f:
        f.write(str(elapsed_time))
        print("timer disp saved-----+++++")

elapsed_time = load_timer_state()

def update_display(t=None):
    global colon_state
    current_elapsed = elapsed_time
    if timer_running:
        current_elapsed += (time.ticks_ms() - start_time) // 1000
    
    hours = current_elapsed // 3600
    minutes = (current_elapsed % 3600) // 60
    tm.numbers(hours, minutes, colon_state)
    colon_state = not colon_state

def start_timer():
    print("start timer disp------++++")
    global timer_running, start_time
    if not timer_running:
        timer_running = True
        start_time = time.ticks_ms()
        display_timer.init(period=500, mode=Timer.PERIODIC, callback=update_display)

def stop_timer():
    print("stop timer disp-----++++")
    global timer_running, elapsed_time
    if timer_running:
        timer_running = False
        elapsed_time += (time.ticks_ms() - start_time) // 1000
        display_timer.deinit()
        save_timer_state()
        hours = elapsed_time // 3600
        minutes = (elapsed_time % 3600) // 60
        tm.numbers(hours, minutes, False)

def reset_timer():
    print("reset timer disp----+++++")
    global elapsed_time
    elapsed_time = 0
    if timer_running:
        global start_time
        start_time = time.ticks_ms()
    save_timer_state()
    tm.numbers(0, 0, False)

def save_config():
    with open('config.json', 'w') as f:
        json.dump(config, f)
        print("config saved")

def load_config():
    global config, API_HOST, API_USERNAME, API_PASSWD, WIFI_SSID, WIFI_PASSWD
    try:
        with open('config.json', 'r') as f:
            config = json.load(f)
            print(f"config: {config}")
            API_HOST = config["API_HOST"]
            API_USERNAME = config["API_USERNAME"]
            API_PASSWD = config["API_PASSWD"]
            WIFI_SSID = config["WIFI_SSID"]
            WIFI_PASSWD = config["WIFI_PASSWD"]
            print("data loaded")
            print(f"""
                API_HOST = {API_HOST}
                API_USERNAME = {API_USERNAME}
                API_PASSWD = {API_PASSWD}
                WIFI_SSID = {WIFI_SSID}
                WIFI_PASSWD = {WIFI_PASSWD}
                """)
    except:
        save_config()

def setup_ap():
    sta_if.active(False)
    ap_if.active(True)
    ap_if.config(essid='ESP8266_Config', password='12345678', authmode=network.AUTH_WPA_WPA2_PSK)
    ap_if.ifconfig(('192.168.1.1', '255.255.255.0', '192.168.1.1', '8.8.8.8'))

def connect_wifi():
    if not sta_if.isconnected():
        print('connecting to network...')
        sta_if.active(True)
        sta_if.connect(WIFI_SSID, WIFI_PASSWD)
        for _ in range(50):
            if sta_if.isconnected():
                break
            time.sleep(0.1)
    print('network config:', sta_if.ifconfig())

def handle_request(client):
    try:
        request = client.recv(1024).decode('utf-8')
        headers_end = request.find('\r\n\r\n')
        if headers_end == -1:
            client.close()
            return
        headers = request[:headers_end]
        body = request[headers_end + 4:]
        
        if headers.startswith('POST'):
            print("POST request")
            
            content_length = 0
            for line in headers.split('\r\n'):
                if line.lower().startswith('content-length:'):
                    content_length = int(line.split(':')[1].strip())
                    break
            
            if len(body) < content_length:
                body += client.recv(content_length - len(body)).decode('utf-8')
            
            body = body.strip()
            print("Body received:", body[:100] + "..." if len(body) > 100 else body)
            
            if body:
                try:
                    body = body.replace('\x00', '').strip()
                    
                    data = json.loads(body)
                    print("Parsed JSON:", data)
                    
                    changed = False
                    for key in ['API_HOST', 'API_USERNAME', 'API_PASSWD', 'WIFI_SSID', 'WIFI_PASSWD']:
                        if key in data:
                            new_val = str(data[key]).strip()
                            if new_val != config.get(key, ''):
                                config[key] = new_val
                                changed = True
                    
                    if changed:
                        save_config()
                        global API_HOST, API_USERNAME, API_PASSWD, WIFI_SSID, WIFI_PASSWD
                        API_HOST = config.get("API_HOST", "")
                        API_USERNAME = config.get("API_USERNAME", "")
                        API_PASSWD = config.get("API_PASSWD", "")
                        WIFI_SSID = config.get("WIFI_SSID", "")
                        WIFI_PASSWD = config.get("WIFI_PASSWD", "")
                        
                        response = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nConnection: close\r\n\r\n"
                        response += json.dumps({"ok": True, "msg": "Configuration saved"})
                        client.sendall(response.encode())
                        client.close()
                        
                        import machine
                        time.sleep(1)
                        machine.reset()
                        return
                    else:
                        response = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nConnection: close\r\n\r\n"
                        response += json.dumps({"ok": True, "msg": "No changes detected"})
                        client.sendall(response.encode())
                        
                except ValueError as e:
                    print("JSON parsing error:", e)
                    response = "HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\nConnection: close\r\n\r\n"
                    response += json.dumps({"ok": False, "msg": "Invalid JSON format"})
                    client.sendall(response.encode())
                except Exception as e:
                    print("Error processing request:", e)
                    response = "HTTP/1.1 500 Internal Server Error\r\nContent-Type: application/json\r\nConnection: close\r\n\r\n"
                    response += json.dumps({"ok": False, "msg": "Server error"})
                    client.sendall(response.encode())
            else:
                response = "HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\nConnection: close\r\n\r\n"
                response += json.dumps({"ok": False, "msg": "Empty request body"})
                client.sendall(response.encode())
        
        elif headers.startswith('GET'):
            if '/config' in headers:
                response = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nConnection: close\r\n\r\n"
                response += json.dumps(config)
                client.sendall(response.encode())
            else:
                html = """HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nConnection: close\r\n\r\n"""
                html += """<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>ESP32 Config</title><style>body{font-family:Arial;margin:20px}form{max-width:400px}input[type="text"],input[type="password"]{width:100%;padding:8px;margin:5px 0 15px;box-sizing:border-box}input[type="submit"]{background:#4CAF50;color:white;padding:12px 20px;border:none;cursor:pointer;width:100%}input[type="submit"]:hover{background:#45a049}</style><script>
function load(){fetch('/config').then(r=>r.ok?r.json():Promise.reject()).then(d=>{document.getElementById('h').value=d.API_HOST||'';document.getElementById('u').value=d.API_USERNAME||'';document.getElementById('p').value=d.API_PASSWD||'';document.getElementById('s').value=d.WIFI_SSID||'';document.getElementById('w').value=d.WIFI_PASSWD||''}).catch(e=>alert('Error loading'))}
function save(){var d={API_HOST:document.getElementById('h').value.trim(),API_USERNAME:document.getElementById('u').value.trim(),API_PASSWD:document.getElementById('p').value,WIFI_SSID:document.getElementById('s').value.trim(),WIFI_PASSWD:document.getElementById('w').value};if(!d.API_HOST||!d.WIFI_SSID){alert('Required fields!');return false}
fetch('/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(r=>r.ok?r.json():Promise.reject()).then(r=>{if(r.ok){alert('Saved! Restarting...');setTimeout(()=>location.reload(),1000)}}).catch(e=>alert('Error saving'));return false}</script></head><body onload="load()"><h2>ESP32 Configuration</h2><form onsubmit="return save()">
<label>API Host:</label><input type="text" id="h" required>
<label>API Username:</label><input type="text" id="u">
<label>API Password:</label><input type="password" id="p">
<label>WiFi SSID:</label><input type="text" id="s" required>
<label>WiFi Password:</label><input type="password" id="w">
<input type="submit" value="Save"></form></body></html>"""
                client.sendall(html.encode())
        
        else:
            response = "HTTP/1.1 405 Method Not Allowed\r\nContent-Type: application/json\r\nConnection: close\r\n\r\n"
            response += json.dumps({"ok": False, "msg": "Method not allowed"})
            client.sendall(response.encode())
            
    except Exception as e:
        print("Handle request error:", e)
        response = "HTTP/1.1 500 Internal Server Error\r\nContent-Type: application/json\r\nConnection: close\r\n\r\n"
        response += json.dumps({"ok": False, "msg": "Server error"})
        client.sendall(response.encode())
    finally:
        try:
            client.close()
        except:
            pass

def run_config_portal():
    load_config()
    setup_ap()
    s = socket.socket()
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    s.bind(('0.0.0.0', 80))
    s.listen(1)
    while True:
        client, addr = s.accept()
        handle_request(client)
        gc.collect()

def start_config_mode():
    print("START CONFIG PANEL MODE----->>>>>>>>>>")
    run_config_portal()

def send_event(event_type):
    url = f"{API_HOST}/create_event?type={event_type}"
    headers = {"username": API_USERNAME, "passwd": API_PASSWD}
    
    try:
        response = urequests.post(url, headers=headers, timeout=3)
        result = response.json() if response.status_code == 201 else None
        response.close()
        print(result)
        gc.collect()
        return result
    except Exception as e:
        print("Error:", e)
        gc.collect()
        return None

def main():
    connect_wifi()
    load_config()
    
    global last_d1, last_d2, last_d3, last_d4, d2_press_time
    
    while True:
        d1 = button_d1.value()
        d2 = button_d2.value()
        d3 = button_d3.value()
        d4 = button_d4.value()

        if d1 == 0 and last_d1 == 1:
            print("D1 click")
            send_event("start")
            start_timer()

        if d2 == 0 and last_d2 == 1:
            print("D2 click")
            d2_press_time = time.ticks_ms()
        
        if d2 == 1 and last_d2 == 0:
            press_duration = time.ticks_diff(time.ticks_ms(), d2_press_time)
            
            if press_duration >= 3000:
                print("D2 click more 3 sec")
                send_event("reset")
                reset_timer()
            else:
                send_event("stop")
                stop_timer()
        
        if d3 == 0 and last_d3 == 1:
            print("D3 click")
            send_event("misstake")
        
        if d4 == 0 and last_d4 == 1:
            print("D4 click")
            start_config_mode()

        last_d1 = d1
        last_d2 = d2
        last_d3 = d3
        last_d4 = d4
        
        time.sleep(0.05)
        gc.collect()

main()