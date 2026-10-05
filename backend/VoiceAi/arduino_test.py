import serial
import time

arduino = serial.Serial("COM4", 9600)
time.sleep(2)

while True:
    command = input("Type ON or OFF (or Q to quit): ").strip().upper()

    if command == "ON":
        arduino.write(b"1")
        print("💡 LED ON")

    elif command == "OFF":
        arduino.write(b"0")
        print("💡 LED OFF")

    elif command == "Q":
        break

arduino.close()