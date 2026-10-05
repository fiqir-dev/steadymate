import os
import asyncio
import tempfile
import subprocess
import time

import numpy as np
import sounddevice as sd
import soundfile as sf
import serial
import edge_tts
from groq import Groq


# ==============================
# SETTINGS
# ==============================

ARDUINO_PORT = "COM4"
ARDUINO_BAUD = 9600

SAMPLE_RATE = 16000
CHANNELS = 1
RECORD_SECONDS = 5

AI_MODEL = "openai/gpt-oss-20b"
STT_MODEL = "whisper-large-v3-turbo"
TTS_VOICE = "en-US-GuyNeural"


# ==============================
# GROQ
# ==============================

api_key = os.getenv("GROQ_API_KEY")

if not api_key:
    print("ERROR: GROQ_API_KEY is not set.")
    print("Set your Groq API key as an environment variable first.")
    input("Press Enter to exit...")
    raise SystemExit

client = Groq(api_key=api_key)


# ==============================
# ARDUINO
# ==============================

arduino = None

try:
    arduino = serial.Serial(
        ARDUINO_PORT,
        ARDUINO_BAUD,
        timeout=1
    )

    time.sleep(2)

    print("Arduino connected on", ARDUINO_PORT)

except Exception as error:
    print("Arduino connection failed:")
    print(error)


# ==============================
# KIYA PERSONALITY
# ==============================

SYSTEM_PROMPT = """
You are Kiya, a physical AI assistant created by Fiker.

Fiker is an Ethiopian Grade 11 Natural Science student interested
in robotics, artificial intelligence, computer science, IT,
web development, technology, science, space, and computers.

Be friendly, intelligent, helpful, and natural.

Keep your answers reasonably short because you speak your answers
through a physical speaker.

Arduino commands:

If the user asks to turn the LED ON, include:
[LED_ON]

If the user asks to turn the LED OFF, include:
[LED_OFF]

Do not use these commands unless the user actually asks for LED
control.

If someone asks who created you, say Fiker created you.

Never invent private information about Fiker.
"""


# ==============================
# RECORD VOICE
# ==============================

def record_voice():

    print()
    print("Listening...")
    print("Speak now.")

    try:
        frames = int(SAMPLE_RATE * RECORD_SECONDS)

        audio = sd.rec(
            frames,
            samplerate=SAMPLE_RATE,
            channels=CHANNELS,
            dtype="int16"
        )

        sd.wait()

        filename = tempfile.mktemp(suffix=".wav")

        sf.write(
            filename,
            audio,
            SAMPLE_RATE
        )

        print("Recording finished.")

        return filename

    except Exception as error:

        print("Microphone error:")
        print(error)

        return None


# ==============================
# SPEECH TO TEXT
# ==============================

def speech_to_text(filename):

    if filename is None:
        return ""

    print("Converting speech to text...")

    try:

        with open(filename, "rb") as audio_file:

            result = client.audio.transcriptions.create(
                file=audio_file,
                model=STT_MODEL
            )

        text = result.text.strip()

        print("You:", text)

        return text

    except Exception as error:

        print("Speech recognition error:")
        print(error)

        return ""

    finally:

        try:
            os.remove(filename)
        except:
            pass


# ==============================
# ASK KIYA
# ==============================

def ask_kiya(text):

    print("Kiya is thinking...")

    try:

        response = client.chat.completions.create(
            model=AI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": SYSTEM_PROMPT
                },
                {
                    "role": "user",
                    "content": text
                }
            ],
            temperature=0.7,
            max_tokens=400
        )

        answer = response.choices[0].message.content

        if answer is None:
            return ""

        return answer.strip()

    except Exception as error:

        print("AI error:")
        print(error)

        return ""


# ==============================
# ARDUINO CONTROL
# ==============================

def control_arduino(response):

    if arduino is None:
        return

    try:

        if "[LED_ON]" in response:

            print("LED ON")

            arduino.write(b"1")
            arduino.flush()

        if "[LED_OFF]" in response:

            print("LED OFF")

            arduino.write(b"0")
            arduino.flush()

    except Exception as error:

        print("Arduino error:")
        print(error)


# ==============================
# REMOVE COMMANDS
# ==============================

def clean_response(response):

    response = response.replace("[LED_ON]", "")
    response = response.replace("[LED_OFF]", "")

    return response.strip()


# ==============================
# CREATE VOICE
# ==============================

async def create_voice(text, filename):

    voice = edge_tts.Communicate(
        text,
        TTS_VOICE
    )

    await voice.save(filename)


# ==============================
# PLAY VOICE
# ==============================

def play_voice(filename):

    if not os.path.exists(filename):
        print("Audio file was not created.")
        return

    try:

        script = r"""
Add-Type -AssemblyName PresentationCore

$path = $env:KIYA_AUDIO

$player = New-Object System.Windows.Media.MediaPlayer

$player.Open([System.Uri]::new($path))

Start-Sleep -Milliseconds 500

$player.Play()

Start-Sleep -Seconds 1

while ($player.NaturalDuration.HasTimeSpan -eq $false) {
    Start-Sleep -Milliseconds 100
}

$duration = $player.NaturalDuration.TimeSpan.TotalSeconds

Start-Sleep -Seconds ([math]::Ceiling($duration))

$player.Stop()
$player.Close()
"""

        environment = os.environ.copy()
        environment["KIYA_AUDIO"] = os.path.abspath(filename)

        subprocess.run(
            [
                "powershell",
                "-NoProfile",
                "-Command",
                script
            ],
            env=environment,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )

    except Exception as error:

        print("Speaker error:")
        print(error)


# ==============================
# KIYA SPEAK
# ==============================

def speak(text):

    if not text:
        return

    print()
    print("Kiya:", text)

    filename = tempfile.mktemp(suffix=".mp3")

    try:

        asyncio.run(
            create_voice(
                text,
                filename
            )
        )

        play_voice(filename)

    except Exception as error:

        print("Voice error:")
        print(error)

    finally:

        try:
            os.remove(filename)
        except:
            pass


# ==============================
# START
# ==============================

print()
print("==============================")
print("       KIYA AI ASSISTANT")
print("==============================")
print()

print("Microphone: Windows default")
print("Speaker: Windows default")
print("Arduino:", ARDUINO_PORT)
print("AI:", AI_MODEL)
print()

print("Kiya is ready.")
print("Press CTRL+C to stop.")
print()


# ==============================
# MAIN LOOP
# ==============================

try:

    while True:

        # Record
        audio_file = record_voice()

        if audio_file is None:
            continue

        # Speech to text
        user_text = speech_to_text(audio_file)

        if not user_text:
            print("I could not understand you.")
            continue

        # AI
        response = ask_kiya(user_text)

        if not response:
            continue

        # Arduino
        control_arduino(response)

        # Remove Arduino commands
        response = clean_response(response)

        # Speak
        speak(response)

        print()
        print("------------------------------")


except KeyboardInterrupt:

    print()
    print("Stopping Kiya...")


finally:

    if arduino is not None:

        try:
            arduino.close()
        except:
            pass

    print("Kiya stopped.")