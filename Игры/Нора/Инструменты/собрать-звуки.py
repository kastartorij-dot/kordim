"""Build the original, loopable ambience and footsteps as Godot AudioStreamWAV resources."""
import argparse
from pathlib import Path
import subprocess
import tempfile

import numpy as np

RATE = 22_050
ROOT = Path(__file__).resolve().parents[1]
RNG = np.random.default_rng(1026)


def shaped_noise(seconds, low, high, rolloff=2.5):
    count = round(seconds * RATE)
    freqs = np.fft.rfftfreq(count, 1.0 / RATE)
    freqs[0] = 0.01
    band = 1.0 / np.sqrt((1.0 + (low / freqs) ** rolloff) * (1.0 + (freqs / high) ** rolloff))
    phase = RNG.uniform(-np.pi, np.pi, freqs.size)
    spectrum = np.exp(1j * phase) * band
    spectrum[0] = 0
    return np.fft.irfft(spectrum, count)


def normal(signal, peak):
    return signal * peak / max(np.max(np.abs(signal)), 1e-6)


def crackles(signal, seconds, amount, scale):
    for i in range(amount):
        length = RNG.uniform(0.012, 0.092)
        t = np.arange(round(RATE * length)) / RATE
        tick = shaped_noise(length, RNG.uniform(300, 930), RNG.uniform(2200, 4700), 4)
        fizz = np.exp(-t * RNG.uniform(46, 145))
        body = np.sin(t * RNG.uniform(430, 4800)) * np.exp(-t * 118)
        pulse = normal(tick, 0.76) * fizz + body * 0.22
        start = RNG.integers(0, round(seconds * RATE))
        positions = (start + np.arange(pulse.size)) % signal.size
        signal[positions] += pulse * RNG.uniform(scale * 0.14, scale)


def wind():
    duration = 17
    t = np.arange(duration * RATE) / RATE
    swell = 0.54 + 0.24 * np.sin(2 * np.pi * t * 2 / duration + 0.7) + 0.16 * np.sin(2 * np.pi * t * 5 / duration)
    rustle = normal(shaped_noise(duration, 270, 1700, 5), 0.19) * swell
    return normal(shaped_noise(duration, 56, 340, 6), 0.17) * (1 - 0.18 * swell) + rustle


def creek():
    duration = 13
    bed = normal(shaped_noise(duration, 275, 2250, 4), 0.27)
    fizz = normal(shaped_noise(duration, 950, 3910, 5), 0.16)
    t = np.arange(duration * RATE) / RATE
    tremble = 0.77 + 0.20 * np.sin(2 * np.pi * t * 5 / duration) * np.sin(2 * np.pi * t * 9 / duration)
    return bed * tremble + fizz * 0.39


def hearth():
    duration = 15
    bed = normal(shaped_noise(duration, 83, 390, 7), 0.15)
    crackles(bed, duration, 91, 0.46)
    return normal(bed, 0.59)


def step(surface):
    duration = 0.32
    t = np.arange(round(duration * RATE)) / RATE
    attack = np.minimum(1.0, t * 150.0)
    bump = np.sin(2 * np.pi * (90 * t - 35 * t * t)) * np.exp(-t * 29) * attack
    if surface == "wood":
        knock = np.sin(2 * np.pi * (186 * t - 51 * t * t)) * np.exp(-t * 32) * attack
        scrape = normal(shaped_noise(duration, 350, 1130, 6), 0.6) * np.exp(-t * 24)
        signal = 0.43 * bump + 0.30 * knock + 0.23 * scrape
    else:
        rustle = normal(shaped_noise(duration, 420, 3300, 5), 0.72) * np.exp(-t * 16)
        signal = 0.40 * bump + 0.47 * rustle * attack
    return normal(signal * np.clip((duration - t) * 28, 0, 1), 0.60)


RUNNER = """extends SceneTree

func _initialize() -> void:
	var args := OS.get_cmdline_user_args()
	var names := ["wind", "creek", "hearth", "step_wood", "step_earth"]
	for name in names:
		var wave := AudioStreamWAV.new()
		wave.format = AudioStreamWAV.FORMAT_16_BITS
		wave.mix_rate = 22050
		wave.data = FileAccess.get_file_as_bytes(args[0].path_join(name + ".pcm"))
		if not name.begins_with("step_"):
			wave.loop_mode = AudioStreamWAV.LOOP_FORWARD
			wave.loop_begin = 0
			wave.loop_end = wave.data.size()/2
		var err := ResourceSaver.save(wave, "res://audio/" + name + ".res", ResourceSaver.FLAG_COMPRESS)
		if err != OK:
			printerr(err)
			quit(err)
			return
	print("Собрано звуков: ", names.size())
	quit()
"""


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("godot", help="Absolute path to Godot")
    options = parser.parse_args()
    (ROOT / "audio").mkdir(exist_ok=True)
    cache = ROOT / ".godot"
    cache.mkdir(exist_ok=True)
    clips = {"wind": wind(), "creek": creek(), "hearth": hearth(), "step_wood": step("wood"), "step_earth": step("earth")}
    with tempfile.TemporaryDirectory(prefix="sound-", dir=cache) as folder:
        folder = Path(folder)
        runner = folder / "pack_audio.gd"
        runner.write_text(RUNNER, encoding="utf-8")
        for name, signal in clips.items():
            samples = np.round(np.clip(signal, -1, 1) * 32767).astype("<i2")
            samples.tofile(folder / (name + ".pcm"))
        subprocess.run([options.godot, "--headless", "--path", str(ROOT),
                        "--script", str(runner), "--", str(folder)], check=True)


if __name__ == "__main__":
    main()
