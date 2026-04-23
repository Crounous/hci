const levels = [
  {
    name: "The Slider",
    instruction: "Level 1. Move the horizontal slider to the target: 73.",
    targetText: "Target: 73",
    target: 73,
    create: createSliderLevel,
    score: (state) => Math.abs(state.value - 73),
  },
  {
    name: "The Fill Button",
    instruction:
      "Level 2. Hold the button to fill the bar (it speeds up over time). Release near target: 85.",
    targetText: "Target: 85",
    target: 85,
    create: createFillLevel,
    score: (state) => Math.abs(state.value - 85),
  },
  {
    name: "The Dial",
    instruction: "Level 3. Click and drag the dial to approximately 210 degrees.",
    targetText: "Target: 210 degrees",
    target: 210,
    create: createDialLevel,
    score: (state) => Math.abs(state.value - 210),
  },
  {
    name: "The Stepper",
    instruction: "Level 4. Start at 0 and reach exactly 58 using +11, +3, and -7.",
    targetText: "Target: 58",
    target: 58,
    create: createStepperLevel,
    score: (state) => Math.abs(state.value - 58),
  },
  {
    name: "The Spatial Pad",
    instruction:
      "Level 5. Click the square to place one marker where you estimate X=70%, Y=30%.",
    targetText: "Target: X=70%, Y=30%",
    target: { x: 70, y: 30 },
    create: createSpatialLevel,
    score: (state) => {
      if (!state.point) {
        return null;
      }

      const xError = Math.abs(state.point.x - 70);
      const yError = Math.abs(state.point.y - 30);
      return xError + yError;
    },
  },
];

const levelLabel = document.getElementById("levelLabel");
const instruction = document.getElementById("instruction");
const controlWrap = document.getElementById("controlWrap");
const submitBtn = document.getElementById("submitBtn");
const resetBtn = document.getElementById("resetBtn");
const resultWrap = document.getElementById("resultWrap");
const summaryWrap = document.getElementById("summaryWrap");
const interaction = document.getElementById("interaction");

let levelIndex = 0;
let errors = [];
let controlApi = null;

resetBtn.addEventListener("click", () => {
  if (controlApi) {
    controlApi.reset();
  }
});

submitBtn.addEventListener("click", () => {
  if (!controlApi) {
    return;
  }

  const level = levels[levelIndex];
  const value = controlApi.getValue();
  const margin = level.score(value);

  if (margin === null) {
    showInlineMessage("Place a marker on the pad before submitting.");
    return;
  }

  errors[levelIndex] = margin;
  showResult(margin, value);
});

function renderLevel() {
  const level = levels[levelIndex];

  resultWrap.classList.add("hidden");
  summaryWrap.classList.add("hidden");
  interaction.classList.remove("hidden");

  levelLabel.textContent = `Level ${levelIndex + 1} of ${levels.length} - ${level.name}`;
  instruction.textContent = `${level.instruction} ${level.targetText}`;

  controlWrap.innerHTML = "";
  clearInlineMessage();

  controlApi = level.create(controlWrap);
}

function showResult(margin, value) {
  interaction.classList.add("hidden");
  resultWrap.classList.remove("hidden");

  const rounded = margin.toFixed(2);
  let detail = "";

  if (levelIndex === 4 && value.point) {
    detail = `<p>Your point: X=${value.point.x.toFixed(1)}%, Y=${value.point.y.toFixed(1)}%</p>`;
  }

  const actionButton =
    levelIndex < levels.length - 1
      ? '<button class="next-btn" type="button">Next Level</button>'
      : '<button class="next-btn" type="button">View Summary</button>';

  resultWrap.innerHTML = `
    <div class="result">
      <p>Error Margin: ${rounded}</p>
      ${detail}
      ${actionButton}
    </div>
  `;

  const nextBtn = resultWrap.querySelector(".next-btn");
  nextBtn.addEventListener("click", () => {
    if (levelIndex < levels.length - 1) {
      levelIndex += 1;
      renderLevel();
      return;
    }

    showSummary();
  });
}

function showSummary() {
  resultWrap.classList.add("hidden");
  summaryWrap.classList.remove("hidden");

  const total = errors.reduce((sum, value) => sum + value, 0);

  summaryWrap.innerHTML = `
    <div class="summary">
      <p>Experiment complete.</p>
      <p>Total Error Margin: ${total.toFixed(2)}</p>
      <button class="restart-btn" type="button">Restart</button>
    </div>
  `;

  const restartBtn = summaryWrap.querySelector(".restart-btn");
  restartBtn.addEventListener("click", restartExperiment);
}

function restartExperiment() {
  errors = [];
  levelIndex = 0;
  interaction.classList.remove("hidden");
  renderLevel();
}

function showInlineMessage(text) {
  let message = controlWrap.querySelector(".inline-message");
  if (!message) {
    message = document.createElement("p");
    message.className = "inline-message";
    controlWrap.appendChild(message);
  }

  message.textContent = text;
}

function clearInlineMessage() {
  const message = controlWrap.querySelector(".inline-message");
  if (message) {
    message.remove();
  }
}

function createSliderLevel(host) {
  const readout = document.createElement("div");
  readout.className = "value-readout";

  const slider = document.createElement("input");
  slider.className = "slider";
  slider.type = "range";
  slider.min = "0";
  slider.max = "100";
  slider.step = "1";
  slider.value = "50";

  const update = () => {
    readout.textContent = slider.value;
  };

  slider.addEventListener("input", update);

  host.append(readout, slider);
  update();

  return {
    getValue: () => ({ value: Number(slider.value) }),
    reset: () => {
      slider.value = "50";
      update();
    },
  };
}

function createFillLevel(host) {
  let value = 0;
  let holding = false;
  let holdStart = 0;
  let lastTime = 0;
  let frame = null;

  const wrap = document.createElement("div");
  wrap.className = "fill-wrap";

  const holdBtn = document.createElement("button");
  holdBtn.type = "button";
  holdBtn.textContent = "Hold to Fill";

  const track = document.createElement("div");
  track.className = "fill-track";

  const bar = document.createElement("div");
  bar.className = "fill-bar";

  const label = document.createElement("p");
  label.className = "fill-label";

  track.appendChild(bar);
  wrap.append(holdBtn, track, label);
  host.appendChild(wrap);

  const refresh = () => {
    bar.style.width = `${value.toFixed(2)}%`;
    label.textContent = `Fill: ${value.toFixed(1)}%`;
  };

  const tick = (now) => {
    if (!holding) {
      frame = null;
      return;
    }

    const dt = (now - lastTime) / 1000;
    lastTime = now;

    const heldSeconds = (now - holdStart) / 1000;
    const speed = 13 + heldSeconds * 7;

    value = Math.min(100, value + speed * dt);
    refresh();

    if (value < 100) {
      frame = requestAnimationFrame(tick);
    } else {
      holding = false;
      frame = null;
    }
  };

  const startHold = (event) => {
    event.preventDefault();
    if (value >= 100) {
      return;
    }

    holding = true;
    holdStart = performance.now();
    lastTime = holdStart;

    if (!frame) {
      frame = requestAnimationFrame(tick);
    }
  };

  const stopHold = () => {
    holding = false;
  };

  holdBtn.addEventListener("pointerdown", startHold);
  holdBtn.addEventListener("pointerup", stopHold);
  holdBtn.addEventListener("pointerleave", stopHold);
  holdBtn.addEventListener("pointercancel", stopHold);

  refresh();

  return {
    getValue: () => ({ value }),
    reset: () => {
      value = 0;
      holding = false;
      if (frame) {
        cancelAnimationFrame(frame);
        frame = null;
      }
      refresh();
    },
  };
}

function createDialLevel(host) {
  let value = 0;
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startValue = 0;

  const readout = document.createElement("div");
  readout.className = "value-readout";

  const dial = document.createElement("div");
  dial.className = "dial";

  const center = document.createElement("div");
  center.className = "dial-center";
  center.textContent = "DRAG";

  dial.appendChild(center);
  host.append(readout, dial);

  const refresh = () => {
    readout.textContent = `${Math.round(value)}°`;
    dial.style.setProperty("--angle", String(value));
  };

  const onMove = (event) => {
    if (!dragging) {
      return;
    }

    const dx = event.clientX - startX;
    const dy = startY - event.clientY;
    const delta = (dx + dy) * 0.85;

    value = (startValue + delta) % 360;
    if (value < 0) {
      value += 360;
    }

    refresh();
  };

  const stopDrag = () => {
    dragging = false;
  };

  dial.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    dragging = true;
    startX = event.clientX;
    startY = event.clientY;
    startValue = value;
  });

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", stopDrag);
  window.addEventListener("pointercancel", stopDrag);

  refresh();

  return {
    getValue: () => ({ value: Math.round(value) }),
    reset: () => {
      value = 0;
      refresh();
    },
  };
}

function createStepperLevel(host) {
  let value = 0;

  const wrap = document.createElement("div");
  wrap.className = "stepper";

  const readout = document.createElement("div");
  readout.className = "value-readout";

  const buttonRow = document.createElement("div");
  buttonRow.className = "stepper-btns";

  const actions = [
    { label: "+11", amount: 11 },
    { label: "+3", amount: 3 },
    { label: "-7", amount: -7 },
  ];

  const update = () => {
    readout.textContent = String(value);
  };

  actions.forEach((action) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = action.label;
    button.addEventListener("click", () => {
      value += action.amount;
      update();
    });
    buttonRow.appendChild(button);
  });

  wrap.append(readout, buttonRow);
  host.appendChild(wrap);
  update();

  return {
    getValue: () => ({ value }),
    reset: () => {
      value = 0;
      update();
    },
  };
}

function createSpatialLevel(host) {
  let point = null;

  const wrap = document.createElement("div");
  wrap.className = "pad-wrap";

  const pad = document.createElement("div");
  pad.className = "pad";

  const readout = document.createElement("p");
  readout.className = "fill-label";

  wrap.append(pad, readout);
  host.appendChild(wrap);

  const refresh = () => {
    let marker = pad.querySelector(".marker");

    if (!point) {
      if (marker) {
        marker.remove();
      }
      readout.textContent = "Click to place marker";
      return;
    }

    if (!marker) {
      marker = document.createElement("div");
      marker.className = "marker";
      pad.appendChild(marker);
    }

    marker.style.left = `${point.x}%`;
    marker.style.top = `${point.y}%`;
    readout.textContent = `Marker: X=${point.x.toFixed(1)}%, Y=${point.y.toFixed(1)}%`;
  };

  pad.addEventListener("click", (event) => {
    const rect = pad.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    point = {
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    };

    refresh();
  });

  refresh();

  return {
    getValue: () => ({ point }),
    reset: () => {
      point = null;
      refresh();
    },
  };
}

renderLevel();
