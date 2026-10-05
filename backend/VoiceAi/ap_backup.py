import os
import time
import tempfile

import numpy as np
import sounddevice as sd
import soundfile as sf
import serial
import pyttsx3

from groq import Groq


# ============================================================
# NOVA SETTINGS
# ============================================================

ARDUINO_PORT = "COM4"
ARDUINO_BAUD = 9600

# Windows default microphone
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
studying theory. He likes taking an idea and turning it into a working
website, application, AI system, or hardware project.

Fiker has worked on projects including:

- Nova, his personal AI assistant and robotics project
- EthioCart, an Ethiopian online marketplace
- FD Elite Dispatch, a trucking dispatch business and website
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
- control hardware such as LEDs
- eventually use sensors and servos
- eventually become a complete physical robot

Fiker uses Python, Arduino, AI APIs, speech recognition, text-to-speech,
and web development technologies to build his projects.

Fiker is also interested in university studies and wants to continue
developing his skills in Computer Science, software development,
technology, AI, and robotics.

He is preparing for his future education and is working on improving
his English and preparing for exams such as the SAT and TOEFL.

Fiker likes learning by experimenting, building things, solving
technical problems, and creating new ideas.

IMPORTANT:
This information is about Fiker and can be shared when someone asks
Nova about her creator.

Do not invent additional personal information about Fiker.

If someone asks "Who is Fiker?", give a short natural description.

If someone asks "Tell me about Fiker", give a more detailed description.

If someone asks what Fiker does, explain that he is a Grade 11 student,
software developer, web developer, and technology/robotics enthusiast.

If someone asks who created Nova, say that Fiker created Nova.
"""


# ============================================================
# NOVA SYSTEM PROMPT
# ============================================================

SYSTEM_PROMPT = """
You are Nova, a physical AI assistant created by Fiker.

============================================================
ABOUT YOUR CREATOR
============================================================

""" + ABOUT_FIKER + """

============================================================
PERSONALITY
============================================================

You are Nova.

You are:
- friendly
- casual
- smart
- natural
- confident
- helpful

Talk like a real person and a friend.

You can naturally use phrases such as:
"yeah", "yep", "sure", "nah", "honestly",
"that's cool", "I got you", "yeah bro".

Do not force "bro" into every sentence.

Do not sound like a customer-service robot.

Do not make every answer overly formal.

Keep answers short and natural.

Usually answer in 1 to 4 sentences unless the user asks
for a detailed explanation.

============================================================
LANGUAGES
============================================================

Nova speaks only:

- English
- Amharic

If the user speaks English, answer in English.

If the user speaks Amharic, answer in Amharic.

If the user mixes English and Amharic, you may naturally
mix both languages.

Never answer in another language.

============================================================
ARDUINO
============================================================

If the user asks to turn the LED ON, include:

[LED_ON]

If the user asks to turn the LED OFF, include:

[LED_OFF]

Do not use these commands unless the user requests them.

============================================================
IMPORTANT BEHAVIOR
============================================================

You are Fiker's personal AI assistant.

Remember the current conversation and use previous messages
when they are relevant.

If someone asks about Fiker, use the information in the
ABOUT FIKER section.

Do not invent information about Fiker.

If you do not know something about Fiker, simply say that
you don't know.

Do not repeatedly introduce yourself unless asked.

Do not say:

"As an AI language model..."

"I am only text..."

"I don't have a physical body..."

You are Nova, Fiker's physical AI assistant connected to
his computer and Arduino.

If asked who created you, say:

"Fiker created me."

============================================================
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

            # =================================================
            # CALIBRATE BACKGROUND NOISE
            # =================================================

            noise_levels = []

            for _ in range(CALIBRATION_FRAMES):

                data, _ = stream.read(
                    frame_size
                )

                mono = data[:, 0].astype(
                    np.float32
                )

                level = float(
                    np.sqrt(
                        np.mean(
                            mono * mono
                        )
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

            # =================================================
            # LISTEN
            # =================================================

            while True:

                data, _ = stream.read(
                    frame_size
                )

                mono = data[:, 0].astype(
                    np.float32
                )

                level = float(
                    np.sqrt(
                        np.mean(
                            mono * mono
                        )
                    )
                )

                elapsed = (
                    time.time() - start_time
                )

                # ------------------------------------------------
                # PRE-BUFFER
                # ------------------------------------------------

                pre_buffer.append(
                    mono.copy()
                )

                if len(pre_buffer) > PRE_BUFFER_FRAMES:

                    pre_buffer.pop(0)

                # =================================================
                # WAITING FOR SPEECH
                # =================================================

                if not speaking:

                    if level > threshold:

                        loud_frames += 1

                    else:

                        loud_frames = 0

                    # ------------------------------------------------
                    # Speech confirmed
                    # ------------------------------------------------

                    if loud_frames >= START_SPEECH_FRAMES:

                        speaking = True

                        chunks.extend(
                            pre_buffer
                        )

                        pre_buffer.clear()

                        speech_time = (
                            START_SPEECH_FRAMES
                            * FRAME_MS
                            / 1000
                        )

                        silence_time = 0.0

                        chunks.append(
                            mono.copy()
                        )

                    # ------------------------------------------------
                    # Don't wait forever
                    # ------------------------------------------------

                    if elapsed >= MAX_RECORD_SECONDS:

                        return None

                    continue

                # =================================================
                # USER IS SPEAKING
                # =================================================

                chunks.append(
                    mono.copy()
                )

                if level > threshold:

                    speech_time += (
                        FRAME_MS / 1000
                    )

                    silence_time = 0.0

                else:

                    silence_time += (
                        FRAME_MS / 1000
                    )

                # =================================================
                # USER FINISHED SPEAKING
                # =================================================

                if (
                    speech_time >= MIN_SPEECH_SECONDS
                    and
                    silence_time >= SILENCE_SECONDS
                ):

                    break

                # =================================================
                # MAX RECORDING TIME
                # =================================================

                if elapsed >= MAX_RECORD_SECONDS:

                    break

        # ========================================================
        # CHECK AUDIO
        # ========================================================

        if not chunks:

            return None

        audio = np.concatenate(
            chunks
        )

        duration = (
            len(audio)
            / SAMPLE_RATE
        )

        if duration < 0.35:

            return None

        # ========================================================
        # APPLY GAIN
        # ========================================================

        audio = audio * MIC_GAIN

        audio = np.clip(
            audio,
            -1.0,
            1.0
        )

        # ========================================================
        # SAVE WAV
        # ========================================================

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

        with open(
            filename,
            "rb"
        ) as audio_file:

            result = client.audio.transcriptions.create(
                file=audio_file,
                model=STT_MODEL,
                response_format="text"
            )

        text = str(
            result
        ).strip()

        if len(text) < 2:

            return ""

        print(
            "You:",
            text,
            flush=True
        )

        return text

    except Exception:

        # ====================================================
        # RETRY
        # ====================================================

        try:

            time.sleep(0.4)

            with open(
                filename,
                "rb"
            ) as audio_file:

                result = client.audio.transcriptions.create(
                    file=audio_file,
                    model=STT_MODEL,
                    response_format="text"
                )

            text = str(
                result
            ).strip()

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

        # ----------------------------------------------------
        # Conversation memory
        # ----------------------------------------------------

        messages.extend(
            conversation[-8:]
        )

        # ----------------------------------------------------
        # Current user message
        # ----------------------------------------------------

        messages.append(
            {
                "role": "user",
                "content": user_text
            }
        )

        # ====================================================
        # ASK GROQ
        # ====================================================

        response = client.chat.completions.create(
            model=AI_MODEL,
            messages=messages,
            temperature=0.7,
            max_tokens=180
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

        # ====================================================
        # SAVE MEMORY
        # ====================================================

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

            arduino.write(
                b"1"
            )

            arduino.flush()

        elif "[LED_OFF]" in response:

            arduino.write(
                b"0"
            )

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

    text = text.replace(
        "[LED_ON]",
        ""
    )

    text = text.replace(
        "[LED_OFF]",
        ""
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

        # New TTS engine every time
        engine = pyttsx3.init()

        engine.setProperty(
            "rate",
            175
        )

        engine.setProperty(
            "volume",
            1.0
        )

        engine.say(
            text
        )

        engine.runAndWait()

        engine.stop()

        del engine

        # Prevent Nova from immediately hearing
        # the end of her own voice.
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

        # ====================================================
        # LISTEN
        # ====================================================

        audio_file = record_voice()

        if not audio_file:

            continue

        # ====================================================
        # SPEECH → TEXT
        # ====================================================

        user_text = speech_to_text(
            audio_file
        )

        if not user_text:

            continue

        # ====================================================
        # THINK
        # ====================================================

        response = ask_nova(
            user_text
        )

        if not response:

            continue

        # ====================================================
        # ARDUINO
        # ====================================================

        control_arduino(
            response
        )

        # ====================================================
        # CLEAN COMMANDS
        # ====================================================

        response = clean_response(
            response
        )

        # ====================================================
        # SPEAK
        # ====================================================

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