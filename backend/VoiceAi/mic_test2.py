import sounddevice as sd
import numpy as np

DEVICE = 5
RATE = 44100
CHANNELS = 4

print("Testing built-in microphone - Device 5")
print("Speak loudly for 10 seconds...")
print()

for i in range(100):
    audio = sd.rec(
        int(RATE * 0.05),
        samplerate=RATE,
        channels=CHANNELS,
        dtype="int16",
        device=DEVICE
    )

    sd.wait()

    audio = audio.astype(np.int32)

    channels = [
        int(np.abs(audio[:, c]).mean())
        for c in range(CHANNELS)
    ]

    peak = int(np.max(np.abs(audio)))

    print("Channels:", channels, "Peak:", peak)

print()
print("Test finished.")