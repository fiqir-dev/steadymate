import os
import time
import tempfile
import webbrowser
import subprocess
import urllib.parse

import numpy as np
import sounddevice as sd
import soundfile as sf
import serial
import pyttsx3
import pyautogui

from groq import Groq


# ============================================================
# NOVA SETTINGS
# ============================================================

ARDUINO_PORT = "COM4"
ARDUINO_BAUD = 9600

MIC_DEVICE = None

SAMPLE_RATE = 16000
MIC_CHANNELS = 1

MIC_GAIN = 1.5


# ============================================================
# VOICE DETECTION
# ============================================================

FRAME_MS = 30

CALIBRATION_FRAMES = 30
START_SPEECH_FRAMES = 4

MIN_SPEECH_SECONDS = 0.30
SILENCE_SECONDS = 0.85

MAX_RECORD_SECONDS = 12
PRE_BUFFER_FRAMES = 12


# ============================================================
# GROQ
# ============================================================

AI_MODEL = "openai/gpt-oss-20b"
STT_MODEL = "whisper-large-v3-turbo"

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    print("GROQ_API_KEY is not set.")
    raise SystemExit


client = Groq(
    api_key=GROQ_API_KEY,
    timeout=20.0,
    max_retries=1
)


# ============================================================
# ARDUINO
# ============================================================

arduino = None

try:

    arduino = serial.Serial(
        ARDUINO_PORT,
        ARDUINO_BAUD,
        timeout=1
    )

    time.sleep(2)

except Exception:

    arduino = None


# ============================================================
# ABOUT FIKER
# ============================================================

ABOUT_FIKER = """
Fiker Derese Lemma is an 18-year-old Grade 11 Natural Science student
from Ethiopia.

Fiker is a software developer and web developer who is passionate about
technology and building real projects.

He is interested in:

- Software development
- Web development
- Computer Science
- Artificial Intelligence
- Robotics
- Programming
- Electronics
- Information Technology
- Space and technology

Fiker enjoys creating practical technology projects instead of only
studying theory.

Fiker has worked on projects including:

- Nova, his personal AI assistant and robotics project
- EthioCart
- FD Elite Dispatch
- Different websites and web applications
- Arduino and electronics projects
- AI-powered student and education projects

Fiker is currently building Nova as a physical AI assistant.

Nova is designed to:
- listen to Fiker through a microphone
- convert speech into text
- understand speech using AI
- answer naturally
- speak through a speaker
- communicate with an Arduino
- control hardware
- eventually use sensors and servos
- eventually become a complete physical robot

Fiker uses Python, Arduino, AI APIs, speech recognition,
text-to-speech, and web development technologies.

Fiker likes learning by experimenting, building things,
solving technical problems, and creating new ideas.

Do not invent additional personal information about Fiker.

If someone asks who created Nova, say that Fiker created Nova.
"""


# ============================================================
# NOVA SYSTEM PROMPT
# ============================================================

SYSTEM_PROMPT = """
You are Nova, a physical AI assistant created by Fiker.

============================================================
PERSONALITY
============================================================

You are:
- friendly
- casual
- smart
- natural
- confident
- helpful

Talk like a real person and a friend.

You can naturally use:
"yeah", "yep", "sure", "nah", "honestly",
"that's cool", "I got you", "one sec", "done".

Do not force "bro" into every sentence.

Do not sound like a customer-service robot.

Do not make every answer overly formal.

Usually answer in 1 to 4 sentences.

============================================================
LANGUAGES
============================================================

Speak only English and Amharic.

If the user speaks English, answer in English.

If the user speaks Amharic, answer in Amharic.

If the user mixes English and Amharic, you may naturally
mix both.

============================================================
ABOUT YOUR CREATOR
============================================================

""" + ABOUT_FIKER + """

============================================================
ARDUINO CONTROL
============================================================

If the user asks to turn the Arduino LED ON:

[LED_ON]

If the user asks to turn the Arduino LED OFF:

[LED_OFF]

============================================================
COMPUTER CONTROL
============================================================

You are also connected to Fiker's Windows computer.

You may control the computer when the user clearly asks you
to perform a computer action.

IMPORTANT:
Do not describe computer commands as normal text.
Use the special action tags below.

Available actions:

[OPEN_APP:calculator]

[OPEN_APP:notepad]

[OPEN_APP:paint]

[OPEN_APP:explorer]

[OPEN_APP:vscode]

[OPEN_APP:chrome]

[OPEN_URL:https://example.com]

[SEARCH_WEB:search terms]

[VOLUME_UP]

[VOLUME_DOWN]

[VOLUME_MUTE]

[MEDIA_PLAY_PAUSE]

[PRESS_KEY:enter]

[PRESS_KEY:esc]

[PRESS_KEY:space]

[HOTKEY:ctrl+s]

[HOTKEY:ctrl+c]

[HOTKEY:ctrl+v]

[HOTKEY:alt+f4]

[TYPE_TEXT:text to type]

Use only the available actions.

Do NOT create shell commands.

Do NOT create PowerShell commands.

Do NOT execute arbitrary programs.

Only use computer-control actions when the user's request
clearly requires them.

============================================================
NATURAL CONVERSATION
============================================================

The action tag is an internal instruction.

The user should hear a natural response.

For example:

User:
"Nova, open Calculator."

Good:
"Yeah, sure. Give me a second. [OPEN_APP:calculator]"

User:
"Nova, turn the volume up."

Good:
"Yep, got you. [VOLUME_UP]"

User:
"Nova, search YouTube for Arduino robot arms."

Good:
"Sure, let's see what we find. [SEARCH_WEB:Arduino robot arms YouTube]"

Do not say:
"Executing command."

Do not say:
"Computer action detected."

Do not explain the action unless the user asks.

============================================================
SAFETY
============================================================

Do not perform destructive actions.

Do not delete files.

Do not format drives.

Do not shut down or restart Windows.

Do not change passwords.

Do not send messages or emails automatically.

Do not make purchases.

Do not run arbitrary terminal commands.

============================================================
IMPORTANT
============================================================

You are Nova, Fiker's personal AI assistant.

You are connected to his computer and Arduino.

If asked who created you:
"Fiker created me."
"""


# ============================================================
# CONVERSATION MEMORY
# ============================================================

conversation = []


# ============================================================
# RECORD VOICE
# ============================================================

def record_voice():

    print("🎤 Listening...", flush=True)

    frame_size = int(
        SAMPLE_RATE * FRAME_MS / 1000
    )

    chunks = []
    pre_buffer = []

    speaking = False

    silence_time = 0.0
    speech_time = 0.0

    loud_frames = 0

    start_time = time.time()

    try:

        with sd.InputStream(
            samplerate=SAMPLE_RATE,
            channels=MIC_CHANNELS,
            dtype="float32",
            device=MIC_DEVICE,
            blocksize=frame_size,
            latency="low"
        ) as stream:

            noise_levels = []

            for _ in range(CALIBRATION_FRAMES):

                data, _ = stream.read(frame_size)

                mono = data[:, 0].astype(np.float32)

                level = float(
                    np.sqrt(
                        np.mean(mono * mono)
                    )
                )

                noise_levels.append(level)

            noise_level = float(
                np.median(noise_levels)
            )

            threshold = max(
                noise_level * 2.8,
                noise_level + 0.0007,
                0.0010
            )

            while True:

                data, _ = stream.read(frame_size)

                mono = data[:, 0].astype(np.float32)

                level = float(
                    np.sqrt(
                        np.mean(mono * mono)
                    )
                )

                elapsed = time.time() - start_time

                pre_buffer.append(mono.copy())

                if len(pre_buffer) > PRE_BUFFER_FRAMES:
                    pre_buffer.pop(0)

                if not speaking:

                    if level > threshold:
                        loud_frames += 1
                    else:
                        loud_frames = 0

                    if loud_frames >= START_SPEECH_FRAMES:

                        speaking = True

                        chunks.extend(pre_buffer)
                        pre_buffer.clear()

                        speech_time = (
                            START_SPEECH_FRAMES
                            * FRAME_MS
                            / 1000
                        )

                        silence_time = 0.0

                        chunks.append(mono.copy())

                    if elapsed >= MAX_RECORD_SECONDS:
                        return None

                    continue

                chunks.append(mono.copy())

                if level > threshold:

                    speech_time += FRAME_MS / 1000
                    silence_time = 0.0

                else:

                    silence_time += FRAME_MS / 1000

                if (
                    speech_time >= MIN_SPEECH_SECONDS
                    and
                    silence_time >= SILENCE_SECONDS
                ):
                    break

                if elapsed >= MAX_RECORD_SECONDS:
                    break

        if not chunks:
            return None

        audio = np.concatenate(chunks)

        duration = len(audio) / SAMPLE_RATE

        if duration < 0.35:
            return None

        audio = audio * MIC_GAIN

        audio = np.clip(
            audio,
            -1.0,
            1.0
        )

        filename = tempfile.mktemp(
            suffix=".wav"
        )

        sf.write(
            filename,
            audio,
            SAMPLE_RATE,
            subtype="PCM_16"
        )

        return filename

    except Exception as e:

        print(
            "Microphone error:",
            e,
            flush=True
        )

        return None


# ============================================================
# SPEECH TO TEXT
# ============================================================

def speech_to_text(filename):

    if not filename:
        return ""

    try:

        with open(filename, "rb") as audio_file:

            result = client.audio.transcriptions.create(
                file=audio_file,
                model=STT_MODEL,
                response_format="text"
            )

        text = str(result).strip()

        if len(text) < 2:
            return ""

        print(
            "You:",
            text,
            flush=True
        )

        return text

    except Exception:

        try:

            time.sleep(0.4)

            with open(filename, "rb") as audio_file:

                result = client.audio.transcriptions.create(
                    file=audio_file,
                    model=STT_MODEL,
                    response_format="text"
                )

            text = str(result).strip()

            if len(text) < 2:
                return ""

            print(
                "You:",
                text,
                flush=True
            )

            return text

        except Exception:

            return ""

    finally:

        try:

            if os.path.exists(filename):
                os.remove(filename)

        except Exception:
            pass


# ============================================================
# COMPUTER CONTROL
# ============================================================

def open_app(app):

    apps = {

        "calculator": "calc",
        "notepad": "notepad",
        "paint": "mspaint",
        "explorer": "explorer",

    }

    if app == "vscode":

        try:
            subprocess.Popen(
                ["code"],
                shell=True
            )
            return True

        except Exception:
            return False

    if app == "chrome":

        chrome_paths = [

            os.path.expandvars(
                r"%ProgramFiles%\Google\Chrome\Application\chrome.exe"
            ),

            os.path.expandvars(
                r"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
            ),

            os.path.expandvars(
                r"%LocalAppData%\Google\Chrome\Application\chrome.exe"
            )

        ]

        for path in chrome_paths:

            if os.path.exists(path):

                subprocess.Popen([path])
                return True

        try:

            subprocess.Popen(
                ["chrome"],
                shell=True
            )

            return True

        except Exception:

            return False

    command = apps.get(app)

    if not command:
        return False

    try:

        subprocess.Popen(
            command,
            shell=True
        )

        return True

    except Exception:

        return False


def open_url(url):

    try:

        webbrowser.open(url)
        return True

    except Exception:

        return False


def search_web(query):

    try:

        encoded = urllib.parse.quote_plus(query)

        url = (
            "https://www.google.com/search?q="
            + encoded
        )

        webbrowser.open(url)

        return True

    except Exception:

        return False


def press_key(key):

    allowed = {
        "enter",
        "esc",
        "space",
        "tab",
        "backspace",
        "up",
        "down",
        "left",
        "right",
    }

    if key not in allowed:
        return False

    try:

        pyautogui.press(key)
        return True

    except Exception:

        return False


def hotkey(keys):

    try:

        key_list = [
            key.strip()
            for key in keys.split("+")
        ]

        allowed = {
            "ctrl",
            "shift",
            "alt",
            "win",
            "s",
            "c",
            "v",
            "x",
            "z",
            "a",
            "f",
            "n",
            "t",
            "w",
        }

        if not all(
            key in allowed
            for key in key_list
        ):
            return False

        pyautogui.hotkey(*key_list)

        return True

    except Exception:

        return False


def type_text(text):

    try:

        pyautogui.write(
            text,
            interval=0.02
        )

        return True

    except Exception:

        return False


def control_computer(response):

    actions_done = []

    # --------------------------------------------------------
    # OPEN APP
    # --------------------------------------------------------

    import re

    app_matches = re.findall(
        r"\[OPEN_APP:(.*?)\]",
        response,
        re.IGNORECASE
    )

    for app in app_matches:

        app = app.strip().lower()

        if open_app(app):

            actions_done.append(
                f"opened {app}"
            )

    # --------------------------------------------------------
    # OPEN URL
    # --------------------------------------------------------

    url_matches = re.findall(
        r"\[OPEN_URL:(.*?)\]",
        response,
        re.IGNORECASE
    )

    for url in url_matches:

        url = url.strip()

        if open_url(url):

            actions_done.append(
                "opened website"
            )

    # --------------------------------------------------------
    # SEARCH WEB
    # --------------------------------------------------------

    search_matches = re.findall(
        r"\[SEARCH_WEB:(.*?)\]",
        response,
        re.IGNORECASE
    )

    for query in search_matches:

        query = query.strip()

        if search_web(query):

            actions_done.append(
                "searched the web"
            )

    # --------------------------------------------------------
    # VOLUME
    # --------------------------------------------------------

    if "[VOLUME_UP]" in response:

        pyautogui.press("volumeup")
        actions_done.append("volume up")

    if "[VOLUME_DOWN]" in response:

        pyautogui.press("volumedown")
        actions_done.append("volume down")

    if "[VOLUME_MUTE]" in response:

        pyautogui.press("volumemute")
        actions_done.append("muted")

    # --------------------------------------------------------
    # MEDIA
    # --------------------------------------------------------

    if "[MEDIA_PLAY_PAUSE]" in response:

        pyautogui.press("playpause")
        actions_done.append("play pause")

    # --------------------------------------------------------
    # KEY
    # --------------------------------------------------------

    key_matches = re.findall(
        r"\[PRESS_KEY:(.*?)\]",
        response,
        re.IGNORECASE
    )

    for key in key_matches:

        key = key.strip().lower()

        if press_key(key):

            actions_done.append(
                f"pressed {key}"
            )

    # --------------------------------------------------------
    # HOTKEY
    # --------------------------------------------------------

    hotkey_matches = re.findall(
        r"\[HOTKEY:(.*?)\]",
        response,
        re.IGNORECASE
    )

    for keys in hotkey_matches:

        keys = keys.strip().lower()

        if hotkey(keys):

            actions_done.append(
                f"used {keys}"
            )

    # --------------------------------------------------------
    # TYPE TEXT
    # --------------------------------------------------------

    type_matches = re.findall(
        r"\[TYPE_TEXT:(.*?)\]",
        response,
        re.IGNORECASE
    )

    for text in type_matches:

        if type_text(text):

            actions_done.append(
                "typed text"
            )

    return actions_done


# ============================================================
# ASK NOVA
# ============================================================

def ask_nova(user_text):

    print(
        "🧠 Thinking...",
        flush=True
    )

    try:

        messages = [
            {
                "role": "system",
                "content": SYSTEM_PROMPT
            }
        ]

        messages.extend(
            conversation[-8:]
        )

        messages.append(
            {
                "role": "user",
                "content": user_text
            }
        )

        response = client.chat.completions.create(
            model=AI_MODEL,
            messages=messages,
            temperature=0.7,
            max_tokens=220
        )

        answer = (
            response
            .choices[0]
            .message
            .content
        )

        if not answer:
            return ""

        answer = answer.strip()

        conversation.append(
            {
                "role": "user",
                "content": user_text
            }
        )

        conversation.append(
            {
                "role": "assistant",
                "content": answer
            }
        )

        if len(conversation) > 10:
            del conversation[:-10]

        return answer

    except Exception as e:

        print(
            "AI error:",
            e,
            flush=True
        )

        return ""


# ============================================================
# ARDUINO CONTROL
# ============================================================

def control_arduino(response):

    if arduino is None:
        return

    try:

        if "[LED_ON]" in response:

            arduino.write(b"1")
            arduino.flush()

        elif "[LED_OFF]" in response:

            arduino.write(b"0")
            arduino.flush()

    except Exception as e:

        print(
            "Arduino error:",
            e,
            flush=True
        )


# ============================================================
# CLEAN RESPONSE
# ============================================================

def clean_response(text):

    import re

    # Arduino commands
    text = text.replace(
        "[LED_ON]",
        ""
    )

    text = text.replace(
        "[LED_OFF]",
        ""
    )

    # Computer action tags
    patterns = [

        r"\[OPEN_APP:.*?\]",
        r"\[OPEN_URL:.*?\]",
        r"\[SEARCH_WEB:.*?\]",
        r"\[VOLUME_UP\]",
        r"\[VOLUME_DOWN\]",
        r"\[VOLUME_MUTE\]",
        r"\[MEDIA_PLAY_PAUSE\]",
        r"\[PRESS_KEY:.*?\]",
        r"\[HOTKEY:.*?\]",
        r"\[TYPE_TEXT:.*?\]",

    ]

    for pattern in patterns:

        text = re.sub(
            pattern,
            "",
            text,
            flags=re.IGNORECASE
        )

    return text.strip()


# ============================================================
# NOVA SPEAK
# ============================================================

def speak(text):

    if not text:
        return

    print(
        "Nova:",
        text,
        flush=True
    )

    print(
        "🔊 Speaking...",
        flush=True
    )

    try:

        engine = pyttsx3.init()

        engine.setProperty(
            "rate",
            175
        )

        engine.setProperty(
            "volume",
            1.0
        )

        engine.say(text)

        engine.runAndWait()

        engine.stop()

        del engine

        time.sleep(0.8)

    except Exception as e:

        print(
            "TTS error:",
            e,
            flush=True
        )


# ============================================================
# START NOVA
# ============================================================

print()
print("🤖 Nova")
print()


# ============================================================
# MAIN LOOP
# ============================================================

try:

    while True:

        # ----------------------------------------------------
        # LISTEN
        # ----------------------------------------------------

        audio_file = record_voice()

        if not audio_file:
            continue

        # ----------------------------------------------------
        # SPEECH → TEXT
        # ----------------------------------------------------

        user_text = speech_to_text(
            audio_file
        )

        if not user_text:
            continue

        # ----------------------------------------------------
        # THINK
        # ----------------------------------------------------

        response = ask_nova(
            user_text
        )

        if not response:
            continue

        # ----------------------------------------------------
        # ARDUINO
        # ----------------------------------------------------

        control_arduino(
            response
        )

        # ----------------------------------------------------
        # COMPUTER
        # ----------------------------------------------------

        control_computer(
            response
        )

        # ----------------------------------------------------
        # REMOVE INTERNAL COMMANDS
        # ----------------------------------------------------

        response = clean_response(
            response
        )

        # ----------------------------------------------------
        # SPEAK
        # ----------------------------------------------------

        speak(
            response
        )


except KeyboardInterrupt:

    print()
    print("Nova stopped.")


finally:

    if arduino is not None:

        try:
            arduino.close()

        except Exception:
            pass