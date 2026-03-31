// static/voice_manager.js  —  Scan2Stitch

const Voice = (() => {
  const synth = window.speechSynthesis;
  let selectedVoice = null;
  let queue = [];
  let busy = false;
  let unlocked = false;

  // ── Voice selection ───────────────────────────────────────────
  function pickVoice() {
    const all = synth.getVoices();
    if (!all.length) return;
    selectedVoice =
      all.find(v => v.name === "Google UK English Female") ||
      all.find(v => v.name === "Microsoft Zira - English (United States)") ||
      all.find(v => v.name.includes("Google") && v.lang.startsWith("en")) ||
      all.find(v => v.lang === "en-IN") ||
      all.find(v => v.lang === "en-US") ||
      all.find(v => v.lang.startsWith("en")) ||
      all[0];
    console.log("[Voice] Selected:", selectedVoice?.name ?? "browser default");
  }

  pickVoice();
  if (typeof speechSynthesis.onvoiceschanged !== "undefined") {
    speechSynthesis.onvoiceschanged = pickVoice;
  }
  setTimeout(pickVoice, 500);

  // ── Unlock on first user interaction ─────────────────────────
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    const utt = new SpeechSynthesisUtterance(" ");
    utt.volume = 0;
    synth.speak(utt);
    console.log("[Voice] Unlocked");
  }
  document.addEventListener("click",      unlock);
  document.addEventListener("touchstart", unlock);
  document.addEventListener("keydown",    unlock);

  // ── Core speak ────────────────────────────────────────────────
  function _speakOne({ text, rate, resolve }) {
    setTimeout(() => {
      const utt = new SpeechSynthesisUtterance(text);
      if (selectedVoice) utt.voice = selectedVoice;
      utt.lang   = selectedVoice?.lang ?? "en-US";
      utt.rate   = rate;
      utt.pitch  = 1.05;
      utt.volume = 1.0;

      let done = false;

      const timeout = setTimeout(() => {
        if (!done) { done = true; _finish(resolve); }
      }, Math.max(4000, text.length * 75 + 1500));

      utt.onend = () => {
        if (!done) { done = true; clearTimeout(timeout); _finish(resolve); }
      };

      utt.onerror = (e) => {
        if (e.error === "interrupted") return;
        console.warn("[Voice] Error:", e.error, "| text:", text);
        if (!done) { done = true; clearTimeout(timeout); _finish(resolve); }
      };

      synth.speak(utt);

      // Chrome keepalive — synth pauses after ~15s of silence
      const keepalive = setInterval(() => {
        if (synth.speaking) { synth.pause(); synth.resume(); }
        else clearInterval(keepalive);
      }, 10000);

    }, 80);
  }

  function _finish(resolve) {
    resolve();
    busy = false;
    _flush();
  }

  function _flush() {
    if (busy || !queue.length) return;
    busy = true;
    _speakOne(queue.shift());
  }

  return {
    say(text, rate = 0.92) {
      return new Promise(resolve => {
        queue.push({ text, rate, resolve });
        _flush();
      });
    },

    sayNow(text, rate = 0.92) {
      queue.forEach(item => item.resolve());
      queue = [];
      synth.cancel();
      busy = false;
      return new Promise(resolve => {
        queue.push({ text, rate, resolve });
        setTimeout(_flush, 150);
      });
    },

    stop() {
      queue.forEach(item => item.resolve());
      queue = [];
      synth.cancel();
      busy = false;
    },

    test() { this.sayNow("Voice is working.", 0.9); },

    get isSpeaking() { return synth.speaking; }
  };
})();


// ── VOICE MESSAGES ────────────────────────────────────────────────────────
const MSG = {
  welcome:       "Welcome to Scan2Stitch. Enter your height and stand in front of the camera.",
  cameraReady:   "Camera is ready. Make sure your full body is visible.",
  tooClose:      "Please step back. Your full body should be in the frame.",
  tooFar:        "Please come a little closer.",
  tiltShoulder:  "Level your shoulders, they are slightly tilted.",
  tiltHip:       "Stand straight. Your hips are tilted.",
  notCentered:   "Please move to the centre of the frame.",
  partialBody:   "Your full body from head to toe must be visible.",
  poseGood:      "Perfect pose! Capturing automatically in a moment.",
  frontCaptured: "Front photo done. Now turn sideways.",
  sideReady:     "Good. Stand still for the side photo.",
  sideCaptured:  "All photos taken. Calculating your measurements, please wait.",
  backReady:     "Now turn around and face away from the camera.",
  resultsReady:  "Your measurements are ready.",
  shoulder:      (v) => `Shoulder width, ${v} centimeters.`,
  chest:         (v) => `Chest, ${v} centimeters.`,
  waist:         (v) => `Waist, ${v} centimeters.`,
  hip:           (v) => `Hips, ${v} centimeters.`,
  inseam:        (v) => `Leg length, ${v} centimeters.`,
  sleeve:        (v) => `Arm length, ${v} centimeters.`,
  torso:         (v) => `Torso, ${v} centimeters.`,
  closing:       "Share these measurements with your tailor.",
  poseError:     "Pose not detected. Stand in better lighting with a plain background.",
  calcError:     "Something went wrong. Please try again.",
};


// ── SPEAK MEASUREMENTS ────────────────────────────────────────────────────
async function speakMeasurements(data) {
  await Voice.sayNow(MSG.resultsReady);
  const readings = [
    data.shoulder_width_cm      && MSG.shoulder(data.shoulder_width_cm),
    data.chest_circumference_cm && MSG.chest(data.chest_circumference_cm),
    data.waist_circumference_cm && MSG.waist(data.waist_circumference_cm),
    data.hip_circumference_cm   && MSG.hip(data.hip_circumference_cm),
    data.inseam_cm              && MSG.inseam(data.inseam_cm),
    data.sleeve_length_cm       && MSG.sleeve(data.sleeve_length_cm),
    data.torso_length_cm        && MSG.torso(data.torso_length_cm),
  ].filter(Boolean);
  for (const msg of readings) await Voice.say(msg, 0.88);
  await Voice.say(MSG.closing, 0.88);
}
