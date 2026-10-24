// Baper Rasta Popup Script

document.addEventListener('DOMContentLoaded', async () => {
  const toggleBattery = document.getElementById('toggleBattery');
  const toggleMouse = document.getElementById('toggleMouse');
  const steerSensitivity = document.getElementById('steerSensitivity');
  const speedSensitivity = document.getElementById('speedSensitivity');
  const btnRefill = document.getElementById('btnRefill');
  const btnLaunch = document.getElementById('btnLaunch');
  const statusPill = document.getElementById('statusPill');
  const battPercentDisplay = document.getElementById('battPercentDisplay');
  const battBarFill = document.getElementById('battBarFill');

  // Load saved preferences
  chrome.storage?.local?.get([
    'baperBatteryLockEnabled',
    'baperMouseControlEnabled',
    'baperSteerSens',
    'baperSpeedSens'
  ], (res) => {
    const battEnabled = res.baperBatteryLockEnabled !== false;
    const mouseEnabled = res.baperMouseControlEnabled !== false;

    toggleBattery.checked = battEnabled;
    toggleMouse.checked = mouseEnabled;

    if (res.baperSteerSens) steerSensitivity.value = res.baperSteerSens;
    if (res.baperSpeedSens) speedSensitivity.value = res.baperSpeedSens;

    updateUI(battEnabled, mouseEnabled);
  });

  function updateUI(battEnabled, mouseEnabled) {
    if (battEnabled || mouseEnabled) {
      statusPill.textContent = 'ACTIVE';
      statusPill.className = 'status-pill active';
    } else {
      statusPill.textContent = 'OFF';
      statusPill.className = 'status-pill inactive';
    }

    if (battEnabled) {
      battPercentDisplay.textContent = '১০০%';
      battBarFill.style.width = '100%';
    } else {
      battPercentDisplay.textContent = 'স্বাভাবিক';
      battBarFill.style.width = '60%';
    }
  }

  async function sendToActiveTab(message) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      chrome.scripting?.executeScript({
        target: { tabId: tab.id },
        world: 'MAIN',
        func: (msg) => {
          window.postMessage({ source: 'baper_rasta_extension', ...msg }, '*');
        },
        args: [message]
      }).catch(() => {});
    }
  }

  // Battery toggle
  toggleBattery.addEventListener('change', () => {
    const enabled = toggleBattery.checked;
    updateUI(enabled, toggleMouse.checked);
    chrome.storage?.local?.set({ baperBatteryLockEnabled: enabled });
    sendToActiveTab({ action: 'toggleBattery', enabled });
  });

  // Mouse Control toggle
  toggleMouse.addEventListener('change', () => {
    const enabled = toggleMouse.checked;
    updateUI(toggleBattery.checked, enabled);
    chrome.storage?.local?.set({ baperMouseControlEnabled: enabled });
    sendToActiveTab({ action: 'toggleMouse', enabled });
  });

  // Sensitivity Sliders
  function handleSensitivityChange() {
    const steerVal = parseFloat(steerSensitivity.value); // 1..10
    const speedVal = parseFloat(speedSensitivity.value); // 1..10

    // Map steerVal (1..10) -> (0.00075 .. 0.004) - 0.5x rotation speed
    const turnSens = 0.00075 + (steerVal - 1) * (0.00325 / 9);
    // Map speedVal (1..10) -> (0.02 .. 0.12)
    const speedSens = 0.02 + (speedVal - 1) * (0.10 / 9);

    chrome.storage?.local?.set({
      baperSteerSens: steerVal,
      baperSpeedSens: speedVal
    });

    sendToActiveTab({
      action: 'setSensitivity',
      turnSensitivity: turnSens,
      speedSensitivity: speedSens
    });
  }

  steerSensitivity.addEventListener('input', handleSensitivityChange);
  speedSensitivity.addEventListener('input', handleSensitivityChange);

  const btnRocket = document.getElementById('btnRocket');
  let rocketCooldownTimer = null;
  let cooldownSecondsLeft = 0;

  btnRocket?.addEventListener('click', () => {
    if (cooldownSecondsLeft > 0) return;

    sendToActiveTab({ action: 'fireRocket' });
    cooldownSecondsLeft = 10;
    btnRocket.disabled = true;
    btnRocket.style.opacity = '0.6';
    btnRocket.textContent = '⏳ রকেট কুলডাউন (10s)';

    clearInterval(rocketCooldownTimer);
    rocketCooldownTimer = setInterval(() => {
      cooldownSecondsLeft--;
      if (cooldownSecondsLeft <= 0) {
        clearInterval(rocketCooldownTimer);
        btnRocket.disabled = false;
        btnRocket.style.opacity = '1';
        btnRocket.innerHTML = '<span class="btn-icon">🚀</span> টেসলা রকেট ২ সে. (CTRL)';
      } else {
        btnRocket.textContent = `⏳ রকেট কুলডাউন (${cooldownSecondsLeft}s)`;
      }
    }, 1000);
  });

  // Refill button
  btnRefill.addEventListener('click', () => {
    sendToActiveTab({ action: 'refill' });
    btnRefill.textContent = '✓ রিফিল সম্পন্ন!';
    setTimeout(() => {
      btnRefill.innerHTML = '<span class="btn-icon">⚡</span> ফুল রিফিল (Refill Now)';
    }, 1200);
  });

  // Launch button
  btnLaunch.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://baperrasta.com/' });
  });
});
