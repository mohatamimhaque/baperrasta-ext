// Baper Rasta 100% Battery, Mouse Drive & Tesla Rocket Thruster Mod
// Injected into MAIN world at document_start to control game physics, abilities and DOM HUD

(function () {
  'use strict';

  // --- State Configuration ---
  let batteryLockEnabled = true;
  let mouseControlEnabled = true;
  let lockedSpeed = 0;
  let targetYaw = null;
  let playerRef = null;
  let isPointerLocked = false;
  let isMouseMoving = false;
  let mouseMoveTimeout = null;
  let activeSteerTilt = 0;

  // Settings
  let speedSensitivity = 0.05;
  let turnSensitivity = 0.00175; // 0.5x smooth rotation
  const maxForwardSpeed = 19.0;  // normal cruise max
  const minSpeed = 0.0;          // stop

  // --- Tesla Rocket State ---
  let rocketActive = false;
  let rocketStartTime = 0;
  let lastRocketActivatedTime = -99999; // Tracks time of last rocket click
  const ROCKET_DURATION = 2000;        // 2 seconds rocket flight
  const ROCKET_COOLDOWN = 10000;       // 10 seconds cooldown after click
  const ROCKET_SPEED = 42.0;           // Tesla rocket jump velocity (over 150 km/h)
  const ROCKET_MAX_HEIGHT = 8.5;       // Jump altitude (meters into the sky)

  // 1. Ensure 'debug' query param exists so window.__at is exposed
  try {
    const currentUrl = new URL(window.location.href);
    if (!currentUrl.searchParams.has('debug')) {
      currentUrl.searchParams.set('debug', '');
      window.history.replaceState(null, '', currentUrl.pathname + currentUrl.search + currentUrl.hash);
      console.log('[BaperRasta Mod] Injected debug parameter into history state');
    }
  } catch (e) {
    console.warn('[BaperRasta Mod] Failed to inject debug query param:', e);
  }

  // 2. Lock Player Battery (Always 100% & No Pedal Mode)
  function lockPlayerBattery(player) {
    if (!player || player._baperBatteryLocked) return;

    playerRef = player;
    try {
      Object.defineProperty(player, 'charge', {
        configurable: true,
        enumerable: true,
        get: () => (batteryLockEnabled ? 1.0 : (player._rawCharge !== undefined ? player._rawCharge : 1.0)),
        set: (val) => {
          player._rawCharge = val;
        }
      });

      Object.defineProperty(player, 'pedal', {
        configurable: true,
        enumerable: true,
        get: () => (batteryLockEnabled ? false : (player._rawPedal !== undefined ? player._rawPedal : false)),
        set: (val) => {
          player._rawPedal = val;
        }
      });

      player._baperBatteryLocked = true;
      console.log('[BaperRasta Mod] Player battery locked at 100%!');
      updateBadgeUI();
    } catch (err) {
      console.error('[BaperRasta Mod] Error locking player battery:', err);
    }
  }

  // 3. Intercept window.__at definition
  let internalAt = window.__at;
  try {
    Object.defineProperty(window, '__at', {
      configurable: true,
      enumerable: true,
      get() {
        return internalAt;
      },
      set(val) {
        internalAt = val;
        if (val && val.P) {
          lockPlayerBattery(val.P);
          setupGameInputHook(val);
        }
      }
    });
  } catch (e) {
    console.warn('[BaperRasta Mod] Could not define setter on window.__at:', e);
  }

  // Hook game input to blend mouse steering tilt smoothly
  function setupGameInputHook(at) {
    if (!at || !at.G || at.G._inputHooked) return;
    const origInput = at.G.input.bind(at.G);

    at.G.input = function () {
      const base = origInput();
      if (!at.P) return base;

      if (rocketActive) {
        base.gas = true;
        base.boost = true;
        base.brake = false;
        return base;
      }

      if (!mouseControlEnabled || !at.P.alive) return base;

      // Active steering tilt while mouse is moving
      if (Math.abs(activeSteerTilt) > 0.05) {
        base.steer = Math.max(-1, Math.min(1, base.steer + activeSteerTilt));
      }

      // Cruise speed throttle
      if (lockedSpeed > 0.5) {
        base.gas = true;
        if (lockedSpeed > 11.5) {
          base.boost = true;
        }
      }

      return base;
    };
    at.G._inputHooked = true;
  }

  // 4. Mouse Control Integration
  function handleMouseMove(e) {
    if (!mouseControlEnabled || rocketActive) return;

    const P = window.__at?.P;
    if (!P || !P.alive) return;

    const dx = e.movementX !== undefined ? e.movementX : (e.clientX - (handleMouseMove.lastX || e.clientX));
    const dy = e.movementY !== undefined ? e.movementY : (e.clientY - (handleMouseMove.lastY || e.clientY));
    handleMouseMove.lastX = e.clientX;
    handleMouseMove.lastY = e.clientY;

    if (dx === 0 && dy === 0) return;

    isMouseMoving = true;
    clearTimeout(mouseMoveTimeout);
    mouseMoveTimeout = setTimeout(() => {
      isMouseMoving = false;
      activeSteerTilt = 0;
      updateHudDisplay();
    }, 120);

    // Speed Control: Forward (dy < 0) accelerates, Backward (dy > 0) decelerates
    if (Math.abs(dy) > 0.3) {
      lockedSpeed += (-dy) * speedSensitivity;
      if (lockedSpeed > maxForwardSpeed) lockedSpeed = maxForwardSpeed;
      if (lockedSpeed < minSpeed) lockedSpeed = minSpeed;
    }

    // Steering Control: Turn left (dx < 0), Turn right (dx > 0)
    if (Math.abs(dx) > 0.3) {
      P.yaw -= dx * turnSensitivity;
      targetYaw = P.yaw;

      // Visual wheel tilt
      activeSteerTilt = Math.max(-1, Math.min(1, (dx > 0 ? 0.8 : -0.8)));

      if (window.__at.PLAYER && window.__at.PLAYER.setFrame) {
        window.__at.PLAYER.setFrame();
      }
    }

    updateHudDisplay();
  }

  // Pointer lock handling
  function setupPointerLock() {
    const canvas = document.getElementById('c') || document.body;

    canvas.addEventListener('click', () => {
      if (!mouseControlEnabled) return;
      if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock?.().catch(() => {});
      }
    });

    document.addEventListener('pointerlockchange', () => {
      isPointerLocked = (document.pointerLockElement === canvas);
      const lockIndicator = document.getElementById('baper-pointer-status');
      if (lockIndicator) {
        lockIndicator.textContent = isPointerLocked ? '🎯 POINTER LOCKED' : '🖱️ CLICK TO LOCK MOUSE';
        lockIndicator.style.color = isPointerLocked ? '#4dff95' : '#ffcb1f';
      }
    });

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
  }

  // --- Check if Touching or Crashed with Bus or Truck ---
  function isTouchingBusOrTruck() {
    const at = window.__at;
    if (!at || !at.P) return false;
    const P = at.P;

    // 1. If death was caused by a bus or truck, rocket is strictly disabled
    if (at.G && (at.G.cause === 'bus' || at.G.cause === 'truck')) {
      return true;
    }

    // 2. Check collision contact with all buses & trucks in traffic
    const trafficList = at.TRAFFIC?.list;
    if (trafficList) {
      for (let i = 0; i < trafficList.length; i++) {
        const v = trafficList[i];
        if (v.sp?.killer || v.kind === 'bus' || v.kind === 'truck') {
          const dx = P.x - v.x;
          const dz = P.z - v.z;
          if (Math.abs(dx) > 12 || Math.abs(dz) > 12) continue;

          // Oriented bounding box dimensions
          // Bus: 10.6m x 2.5m, Truck: 8.2m x 2.45m; Rickshaw: 2.6m x 1.2m
          const vHalfLen = ((v.len || (v.kind === 'truck' ? 8.2 : 10.6)) * 0.5) + 1.4;
          const vHalfWid = ((v.wid || 2.5) * 0.5) + 0.7;

          const fx = v.fx !== undefined ? v.fx : 0;
          const fz = v.fz !== undefined ? v.fz : -1;
          const rx = v.rx !== undefined ? v.rx : 1;
          const rz = v.rz !== undefined ? v.rz : 0;

          const localFwd = Math.abs(dx * fx + dz * fz);
          const localRight = Math.abs(dx * rx + dz * rz);

          if (localFwd < vHalfLen && localRight < vHalfWid) {
            return true; // Direct touch / overlap with bus or truck!
          }
        }
      }
    }

    // 3. Fallback distance check using nearestKiller
    const nearest = at.TRAFFIC?.nearestKiller(P.x, P.z);
    if (nearest && nearest.dist < 3.6) {
      return true;
    }

    return false;
  }

  // Calculate remaining cooldown in seconds
  function getRocketCooldownRemaining() {
    const elapsed = performance.now() - lastRocketActivatedTime;
    if (elapsed < ROCKET_COOLDOWN) {
      return (ROCKET_COOLDOWN - elapsed) / 1000;
    }
    return 0;
  }

  // --- 5. TESLA ROCKET THRUSTER (2 SECONDS FLIGHT & MOB ESCAPE) ---
  function activateTeslaRocket() {
    const at = window.__at;
    const P = at?.P;
    if (!P) {
      console.warn('[Tesla Rocket] Player object not ready yet');
      return;
    }

    // Check if touching with a Bus or Truck -> Rocket will NOT work!
    if (isTouchingBusOrTruck()) {
      console.warn('[Tesla Rocket] ⚠️ Blocked: Rocket will not work when touching with bus or truck!');
      if (at.FX?.floater) {
        at.FX.floater(P.x, (P.bumpY || 0) + 2.4, P.z, "⚠️ রকেট কাজ করবে না!", "বাস বা ট্রাকে লাগলে রকেট বন্ধ");
      }
      if (at.sfx?.hornPush) at.sfx.hornPush();

      const lockEl = document.getElementById('baper-speed-lock');
      if (lockEl) {
        lockEl.textContent = '[BUS TOUCH 🚫]';
        lockEl.style.color = '#ff5a64';
      }
      return;
    }

    // Fatal bus crash cannot be resurrected by rocket
    if (at.G && (at.G.cause === 'bus' || at.G.cause === 'truck')) {
      console.warn('[Tesla Rocket] Fatal bus crash cannot be escaped by rocket!');
      return;
    }

    // Check 10-second cooldown after click
    const cooldownRem = getRocketCooldownRemaining();
    if (cooldownRem > 0) {
      const sec = Math.ceil(cooldownRem);
      console.warn(`[Tesla Rocket] Cooldown active. Wait ${sec}s.`);
      if (at.FX?.floater) {
        at.FX.floater(P.x, (P.bumpY || 0) + 2.2, P.z, `⏳ রকেট কুলডাউন (${sec}s)`, "১০ সেকেন্ড পর আবার চলবে");
      }
      return;
    }

    console.log('[Tesla Rocket] 🚀 ACTIVATING TESLA ROCKET THRUSTER FOR 2 SECONDS!');

    // 1. Resurrect & clear bust ONLY if caught by public/busted (NOT bus)
    if (at.G) {
      if (at.G.state === 'busted' || (at.G.state === 'dead' && at.G.cause === 'mob') || (!P.alive && at.G.cause !== 'bus')) {
        at.G.state = 'play';
        P.alive = true;
        P.charging = false;
        at.G.cause = '';
        at.G.deathT = 0;
        at.G.stuckT = 0;

        const paper = document.getElementById('paper');
        if (paper) paper.hidden = true;
        const meme = document.getElementById('meme');
        if (meme) meme.hidden = true;

        if (at.PLAYER?.o?.grp) {
          at.PLAYER.o.grp.visible = true;
          at.PLAYER.o.grp.scale.set(1, 1, 1);
        }
        if (at.PLAYER?.o?.driver) at.PLAYER.o.driver.visible = true;
        if (at.BEAT) at.BEAT.on = false;
      }
    }

    // 2. Escape angry mob & knock grabbers off
    P.grabbers = 0;
    if (at.PEOPLE?.settle) at.PEOPLE.settle();
    if (at.G) at.G.stuckT = 0;

    // 3. Initiate rocket physics & record cooldown timestamp
    lastRocketActivatedTime = performance.now();
    rocketStartTime = performance.now();
    rocketActive = true;
    lockedSpeed = ROCKET_SPEED;
    P.v = ROCKET_SPEED;
    P.boost = true;
    P.throttle = 1;
    P.charge = 1.0;
    P.pedal = false;

    // 4. Sonic blast, launch sound & visual FX
    if (at.sfx?.zap) at.sfx.zap(P.x, P.z);
    if (at.sfx?.hornPush) at.sfx.hornPush();
    if (at.FX?.shake) at.FX.shake(0.8);
    if (at.FX?.sparks) at.FX.sparks(P.x, 1.2, P.z, 40);
    if (at.FX?.floater) {
      at.FX.floater(P.x, 3.2, P.z, "🚀 TESLA ROCKET ACTIVATED!", "উড়াল দিল অটো!");
    }

    // 5. Update UI badge
    const lockEl = document.getElementById('baper-speed-lock');
    if (lockEl) {
      lockEl.textContent = '[🚀 ROCKET 2S]';
      lockEl.style.color = '#ff3fa4';
    }
  }

  // Listen for CTRL key press (Left Ctrl or Right Ctrl)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Control' || e.code === 'ControlLeft' || e.code === 'ControlRight') {
      activateTeslaRocket();
    }
  });

  // 6. Continual Animation Frame Loop (Enforces Battery, Mouse Cruise, & Rocket Physics)
  function safeguardLoop() {
    const at = window.__at;
    const P = at?.P;

    // A. Battery 100% Lock
    if (batteryLockEnabled) {
      if (P) {
        if (!P._baperBatteryLocked) {
          lockPlayerBattery(P);
        } else {
          if (P.charge < 1.0) P.charge = 1.0;
          if (P.pedal) P.pedal = false;
        }
      }

      // DOM HUD Enforcement
      const battPercentEl = document.getElementById('battPercent');
      if (battPercentEl && battPercentEl.textContent !== '১০০%') {
        battPercentEl.textContent = '১০০%';
      }

      const battBarEl = document.getElementById('battBar');
      if (battBarEl && battBarEl.style.width !== '100%') {
        battBarEl.style.width = '100%';
      }

      const battWarnEl = document.getElementById('battWarn');
      if (battWarnEl && !battWarnEl.hidden) {
        battWarnEl.hidden = true;
      }
    }

    // B. Tesla Rocket Jump Flight (2 Seconds)
    if (rocketActive && P) {
      // If rocket touches a bus or truck in flight -> Cancel rocket immediately!
      if (isTouchingBusOrTruck()) {
        console.warn('[Tesla Rocket] Touched bus or truck during flight! Rocket disabled immediately.');
        rocketActive = false;
        P.bumpY = 0;
        P.pitch = 0;
        if (at.PLAYER?.o?.grp) {
          at.PLAYER.o.grp.position.y = 0.05;
          at.PLAYER.o.grp.rotation.x = 0;
        }
        if (at.FX?.shake) at.FX.shake(0.9);
        if (at.FX?.sparks) at.FX.sparks(P.x, 1, P.z, 30);
        if (at.G && at.G.state === 'play') {
          const killer = at.TRAFFIC?.nearestKiller(P.x, P.z);
          at.G.kill('bus', killer?.veh);
        }
        updateHudDisplay();
        requestAnimationFrame(safeguardLoop);
        return;
      }

      const now = performance.now();
      const elapsed = now - rocketStartTime;
      const progress = elapsed / ROCKET_DURATION;

      if (progress < 1.0) {
        // Parabolic jump arc: jumps into the air and flies forward!
        const altitude = Math.sin(progress * Math.PI) * ROCKET_MAX_HEIGHT;
        P.bumpY = altitude;

        // Nose pitch: Upward during launch, leveling off near descent
        const rocketPitch = progress < 0.45 ? -0.42 : ((progress - 0.45) * 0.35);
        P.pitch = rocketPitch;

        // Force forward supersonic speed
        P.v = ROCKET_SPEED;
        lockedSpeed = ROCKET_SPEED;
        P.boost = true;
        P.throttle = 1;
        P.grabbers = 0; // cannot be grabbed in mid-air!

        // Model position overrides
        if (at.PLAYER?.o?.grp) {
          at.PLAYER.o.grp.position.y = altitude + 0.2;
          at.PLAYER.o.grp.rotation.x = rocketPitch;
        }

        // Rocket thruster exhaust flames / sparks behind rickshaw
        const tailX = P.x - P.fx * 1.8;
        const tailZ = P.z - P.fz * 1.8;
        const tailY = altitude + 0.4;
        if (at.FX?.sparks) at.FX.sparks(tailX, tailY, tailZ, 12);
        if (at.FX?.shake) at.FX.shake(0.25);

        // Keep player heading synced
        if (at.PLAYER && at.PLAYER.setFrame) {
          at.PLAYER.setFrame();
        }

        updateHudDisplay();
      } else {
        // Rocket flight ends after 2 seconds -> Touchdown & Landing!
        rocketActive = false;
        P.bumpY = 0;
        P.pitch = 0;
        lockedSpeed = 16.0; // transitions cleanly into high-speed boost cruise
        P.v = 16.0;

        if (at.PLAYER?.o?.grp) {
          at.PLAYER.o.grp.position.y = 0.05;
          at.PLAYER.o.grp.rotation.x = 0;
        }

        // Heavy touchdown thud & sparks
        if (at.FX?.shake) at.FX.shake(0.6);
        if (at.FX?.sparks) at.FX.sparks(P.x, 0.2, P.z, 30);
        if (at.sfx?.crash) at.sfx.crash(P.x, P.z, 0.9, 'plastic');
        if (at.FX?.floater) at.FX.floater(P.x, 1.8, P.z, "TOUCHDOWN!", "ল্যান্ডিং সম্পন্ন ✓");

        console.log('[Tesla Rocket] Touchdown complete, continuing in cruise mode');
        updateHudDisplay();
      }
    }
    // C. Normal Mouse Speed & Heading Lock (When not in rocket flight)
    else if (mouseControlEnabled && P && P.alive) {
      if (P.v < lockedSpeed - 4.5) {
        lockedSpeed = Math.max(0, P.v);
      } else {
        P.v = lockedSpeed;
      }

      if (!isMouseMoving && targetYaw !== null) {
        P.yaw = targetYaw;
      } else {
        targetYaw = P.yaw;
      }

      if (lockedSpeed > 11.5) {
        P.boost = true;
        P.throttle = 1;
      } else if (lockedSpeed > 0.5) {
        P.boost = false;
        P.throttle = 1;
      } else {
        P.boost = false;
        P.throttle = 0;
      }

      if (at.PLAYER && at.PLAYER.setFrame) {
        at.PLAYER.setFrame();
      }

      updateHudDisplay();
    }

    requestAnimationFrame(safeguardLoop);
  }

  requestAnimationFrame(safeguardLoop);

  // 7. On-screen Mini HUD Dashboard with Rocket Button
  function createHud() {
    if (document.getElementById('baper-hud-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'baper-hud-panel';
    panel.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:5px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <div style="display:flex;align-items:center;gap:5px;">
            <span style="font-size:14px;color:#ffcb1f;">⚡</span>
            <span id="baper-hud-title" style="font-family:'Baloo Da 2',sans-serif;font-weight:800;font-size:12.5px;color:#ffcb1f;">
              টেসলা রকেট + ১০০% চার্জ
            </span>
          </div>
          <span id="baper-hud-dot" style="width:8px;height:8px;border-radius:50%;background:#4dff95;box-shadow:0 0 6px #4dff95;"></span>
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between;font-size:11px;font-family:monospace;color:#fff;background:rgba(0,0,0,0.4);padding:2px 6px;border-radius:4px;">
          <span>SPEED: <b id="baper-speed-val" style="color:#2ee6ff;">0.0</b> km/h</span>
          <span id="baper-speed-lock" style="color:#4dff95;font-weight:bold;">[LOCKED 🔒]</span>
        </div>

        <!-- Interactive Rocket Button -->
        <button id="baper-rocket-btn" style="
          width:100%;
          padding:4px 8px;
          border-radius:6px;
          border:1px solid #ff3fa4;
          background:linear-gradient(90deg, #ff3fa4, #e88028);
          color:#fff;
          font-family:inherit;
          font-weight:800;
          font-size:11px;
          cursor:pointer;
          display:flex;
          align-items:center;
          justify-content:center;
          gap:5px;
          box-shadow:0 0 10px rgba(255, 63, 164, 0.4);
          transition:transform 0.1s, opacity 0.2s;
        ">
          🚀 রকেট জাম্প 2S (CTRL)
        </button>

        <div id="baper-pointer-status" style="font-size:9.5px;font-weight:700;color:#ffcb1f;text-align:center;letter-spacing:0.04em;">
          🖱️ CLICK CANVAS TO LOCK MOUSE
        </div>
      </div>
    `;

    Object.assign(panel.style, {
      position: 'fixed',
      bottom: '42px',
      right: '16px',
      zIndex: '99999',
      padding: '7px 12px',
      background: 'rgba(21, 17, 14, 0.94)',
      border: '1.5px solid #ffcb1f',
      borderRadius: '10px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
      userSelect: 'none',
      transition: 'transform 0.2s, opacity 0.2s',
      minWidth: '200px'
    });

    panel.title = 'Press CTRL or Click button for 2s Tesla Rocket Thruster Jump!';
    document.body ? document.body.appendChild(panel) : window.addEventListener('DOMContentLoaded', () => document.body.appendChild(panel));

    // Wire up button click
    const rocketBtn = document.getElementById('baper-rocket-btn');
    if (rocketBtn) {
      rocketBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        activateTeslaRocket();
      });
    }
  }

  function updateHudDisplay() {
    const speedEl = document.getElementById('baper-speed-val');
    const lockEl = document.getElementById('baper-speed-lock');
    const rocketBtn = document.getElementById('baper-rocket-btn');
    const isBusTouching = isTouchingBusOrTruck();
    const cooldownRem = getRocketCooldownRemaining();

    if (speedEl) {
      const displaySpeed = rocketActive ? (ROCKET_SPEED * 3.6) : (lockedSpeed * 3.6);
      speedEl.textContent = displaySpeed.toFixed(1);
    }

    if (isBusTouching) {
      if (rocketBtn) {
        rocketBtn.style.opacity = '0.45';
        rocketBtn.style.background = '#2e1215';
        rocketBtn.style.borderColor = '#ff5a64';
        rocketBtn.style.boxShadow = 'none';
        rocketBtn.textContent = '🚫 বাস/ট্রাকে রকেট বন্ধ';
      }
      if (lockEl && !rocketActive) {
        lockEl.textContent = '[BUS TOUCH 🚫]';
        lockEl.style.color = '#ff5a64';
      }
    } else if (rocketActive) {
      if (rocketBtn) {
        rocketBtn.style.opacity = '1';
        rocketBtn.style.background = 'linear-gradient(90deg, #ff3fa4, #e88028)';
        rocketBtn.style.borderColor = '#ff3fa4';
        rocketBtn.style.boxShadow = '0 0 16px rgba(255, 63, 164, 0.7)';
        rocketBtn.textContent = '🚀 উড়াল দিচ্ছে...';
      }
      if (lockEl) {
        lockEl.textContent = '[🚀 ROCKET 2S]';
        lockEl.style.color = '#ff3fa4';
      }
    } else if (cooldownRem > 0) {
      const sec = Math.ceil(cooldownRem);
      if (rocketBtn) {
        rocketBtn.style.opacity = '0.65';
        rocketBtn.style.background = '#27201c';
        rocketBtn.style.borderColor = '#ffcb1f';
        rocketBtn.style.boxShadow = 'none';
        rocketBtn.textContent = `⏳ রকেট কুলডাউন (${sec}s)`;
      }
      if (lockEl && !isMouseMoving) {
        lockEl.textContent = `[COOLDOWN ${sec}s]`;
        lockEl.style.color = '#ffcb1f';
      }
    } else {
      if (rocketBtn) {
        rocketBtn.style.opacity = '1';
        rocketBtn.style.background = 'linear-gradient(90deg, #ff3fa4, #e88028)';
        rocketBtn.style.borderColor = '#ff3fa4';
        rocketBtn.style.boxShadow = '0 0 10px rgba(255, 63, 164, 0.4)';
        rocketBtn.textContent = '🚀 রকেট জাম্প 2S (CTRL)';
      }
      if (lockEl) {
        if (isMouseMoving) {
          lockEl.textContent = '[ADJUSTING ⚡]';
          lockEl.style.color = '#ff3fa4';
        } else {
          lockEl.textContent = '[LOCKED 🔒]';
          lockEl.style.color = '#4dff95';
        }
      }
    }
  }

  function updateBadgeUI() {
    const dot = document.getElementById('baper-hud-dot');
    if (dot) {
      dot.style.background = (batteryLockEnabled && mouseControlEnabled) ? '#4dff95' : '#ff5a64';
      dot.style.boxShadow = (batteryLockEnabled && mouseControlEnabled) ? '0 0 6px #4dff95' : '0 0 6px #ff5a64';
    }
  }

  // 8. Message listener from Extension Popup
  window.addEventListener('message', (event) => {
    if (!event.data || event.data.source !== 'baper_rasta_extension') return;

    if (event.data.action === 'toggleBattery') {
      batteryLockEnabled = event.data.enabled;
      updateBadgeUI();
    } else if (event.data.action === 'toggleMouse') {
      mouseControlEnabled = event.data.enabled;
      if (!mouseControlEnabled) {
        lockedSpeed = 0;
        targetYaw = null;
      }
      updateBadgeUI();
    } else if (event.data.action === 'setSensitivity') {
      if (event.data.speedSensitivity) speedSensitivity = event.data.speedSensitivity;
      if (event.data.turnSensitivity) turnSensitivity = event.data.turnSensitivity;
    } else if (event.data.action === 'refill') {
      if (window.__at && window.__at.P) {
        window.__at.P.charge = 1.0;
        window.__at.P.pedal = false;
      }
    } else if (event.data.action === 'fireRocket') {
      activateTeslaRocket();
    }
  });

  // Init DOM & events
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      createHud();
      setupPointerLock();
    });
  } else {
    createHud();
    setupPointerLock();
  }
})();
