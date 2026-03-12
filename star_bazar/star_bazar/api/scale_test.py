import serial

ser = serial.Serial("COM2", 9600, timeout=1)

while True:
    data = ser.readline().decode("utf-8", errors="ignore").strip()
    if data:
        print("Weight Data:", data)