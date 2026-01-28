# main.py - программа, запускаемая автоматически при включении ESP-12F
import network
from machine import Pin
import time

# Настройка Wi-Fi (измените на свои данные)
wlan = network.WLAN(network.STA_IF)
wlan.active(True)
wlan.connect("SSID_вашей_сети", "Пароль")

# Ожидание подключения
print("Подключение к Wi-Fi...")
while not wlan.isconnected():
    time.sleep(0.5)
print("IP адрес:", wlan.ifconfig()[0])

# Основной цикл - мигание светодиодом
led = Pin(2, Pin.OUT)
while True:
    led.value(not led.value())
    time.sleep(1)

#ИСПРАВИТЬ КОММИТЫ ГИТ