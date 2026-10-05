import pyautogui
import subprocess
import webbrowser
import time


def open_app(app):
    apps = {
        "vscode": "code",
        "visual studio code": "code",
        "notepad": "notepad",
        "calculator": "calc",
        "paint": "mspaint",
        "file explorer": "explorer",
    }

    command = apps.get(app.lower())

    if command:
        subprocess.Popen(command)
        return True

    return False


def open_website(url):
    webbrowser.open(url)
    return True


def press_key(key):
    pyautogui.press(key)
    return True


def hotkey(*keys):
    pyautogui.hotkey(*keys)
    return True


def type_text(text):
    pyautogui.write(text, interval=0.02)
    return True


def move_mouse(x, y):
    pyautogui.moveTo(x, y, duration=0.2)
    return True


def click():
    pyautogui.click()
    return True


def volume_up():
    pyautogui.press("volumeup")
    return True


def volume_down():
    pyautogui.press("volumedown")
    return True


def mute():
    pyautogui.press("volumemute")
    return True


def play_pause():
    pyautogui.press("playpause")
    return True