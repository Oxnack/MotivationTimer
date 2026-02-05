import network
from machine import Pin
import time
import urequests
import socket
import gc
import json

API_HOST = "http://192.168.0.9:8000"
API_USERNAME = "admin"
API_PASSWD = "1234"
WIFI_SSID = "Keenetic-4568"
WIFI_PASSWD = "rCYPpYmu"


button_d1 = Pin(5, Pin.IN, Pin.PULL_UP)
button_d2 = Pin(4, Pin.IN, Pin.PULL_UP)
button_d3 = Pin(0, Pin.IN, Pin.PULL_UP)
button_d4 = Pin(2, Pin.IN, Pin.PULL_UP)

last_d1 = 1
last_d2 = 1
last_d3 = 1
last_d4 = 1

def connect_wifi():
    sta_if = network.WLAN(network.STA_IF)
    if not sta_if.isconnected():
        print('connecting to network...')
        sta_if.active(True)
        sta_if.connect(WIFI_SSID, WIFI_PASSWD)
        while not sta_if.isconnected():
            pass
    print('network config:', sta_if.ifconfig())

###################################################################

sta_if = network.WLAN(network.STA_IF)
ap_if = network.WLAN(network.AP_IF)

config = {
    'API_HOST': "http://192.168.0.9:8000",
    'API_USERNAME': "admin",
    'API_PASSWD': "1234",
    'WIFI_SSID': "Keenetic-4568",
    'WIFI_PASSWD': "rCYPpYmu"
}

def save_config():
    with open('config.json', 'w') as f:
        json.dump(config, f)

def load_config():
    global config
    try:
        with open('config.json', 'r') as f:
            config = json.load(f)
    except:
        save_config()

def setup_ap():
    sta_if.active(False)
    ap_if.active(True)
    ap_if.config(essid='ESP8266_Config', password='12345678', authmode=network.AUTH_WPA_WPA2_PSK)
    ap_if.ifconfig(('192.168.1.1', '255.255.255.0', '192.168.1.1', '8.8.8.8'))

def handle_request(client):
    request = client.recv(1024).decode()
    if 'POST' in request:
        body = request.split('\r\n\r\n')[1]
        params = body.split('&')
        for param in params:
            if '=' in param:
                key, value = param.split('=')
                if key in config:
                    if config[key] is True or config[key] is False:
                        config[key] = True if value == 'true' else False
                    elif isinstance(config[key], int):
                        try:
                            config[key] = int(value)
                        except:
                            pass
                    else:
                        config[key] = value.replace('+', ' ')
        save_config()
    
    html = """HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n
    <!DOCTYPE html>
    <html>
    <head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    </head>
    <body>
    <form method="POST">
    <label>Variable 1: <input type="text" name="var1" value="{var1}"></label><br>
    <label>Variable 2: <input type="number" name="var2" value="{var2}"></label><br>
    <label>Variable 3: <input type="checkbox" name="var3" {checked}></label><br>
    <label>WiFi SSID: <input type="text" name="wifi_ssid" value="{wifi_ssid}"></label><br>
    <label>WiFi Password: <input type="password" name="wifi_password" value="{wifi_password}"></label><br>
    <button type="submit">Save</button>
    </form>
    </body>
    </html>""".format(
        var1=config['var1'],
        var2=config['var2'],
        checked='checked' if config['var3'] else '',
        wifi_ssid=config['wifi_ssid'],
        wifi_password=config['wifi_password']
    )
    
    client.send(html)
    client.close()

def run_config_portal():
    load_config()
    setup_ap()
    
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    s.bind(('0.0.0.0', 80))
    s.listen(5)
    
    while True:
        client, addr = s.accept()
        try:
            handle_request(client)
        except:
            client.close()

def start_config_mode():
    run_config_portal()

########################################################################


def send_event(event_type):
    url = f"{API_HOST}/create_event?type={event_type}"
    headers = {"username": API_USERNAME, "passwd": API_PASSWD}
    
    try:
        response = urequests.post(url, headers=headers, timeout=5)
        result = response.json() if response.status_code == 201 else None
        response.close()
        return result
    except Exception as e:
        print("Error:", e)
        return None
    
def main():
    connect_wifi()
    
    global last_d1, last_d2, last_d3, last_d4
    
    while True:
        d1 = button_d1.value()
        d2 = button_d2.value()
        d3 = button_d3.value()
        d4 = button_d4.value()
        
        if d1 == 0 and last_d1 == 1:
            send_event("start")
        
        if d2 == 0 and last_d2 == 1:
            send_event("stop")
        
        if d3 == 0 and last_d3 == 1:
            send_event("misstake")
        
        last_d1 = d1
        last_d2 = d2
        last_d3 = d3
        last_d4 = d4
        
        time.sleep(0.1)

main()