import sounddevice as sd
import numpy as np

print("🎤 Built-in microphone test")
print("Speak normally for 10 seconds...")
print()

for i in range(100):
    audio = sd.rec(
        1600,
        samplerate=16000,
        channels=1,
        dtype="int16"
    )

    sd.wait()

    audio_int = audio.astype(np.int32)

    average = int(np.abs(audio_int).mean())
    peak = int(np.max(np.abs(audio_int)))

    print("Average:", average, "Peak:", peak)

print()
print("✅ Test finished")