# Baper Rasta (বাপের রাস্তা) - 100% Infinite Battery & Mouse Drive Mod

A powerful Manifest V3 browser extension for **[baperrasta.com](https://baperrasta.com/)** that:
1. ⚡ **Locks `battPercent` permanently to 100% (১০০%)**, prevents battery drain from driving or crashing, and eliminates pedal mode.
2. 🚀 **Tesla Rocket Thruster Jump (<kbd>Ctrl</kbd> Key)**:
   - Press <kbd>Ctrl</kbd> (or click the HUD button) to fire a **2-second Tesla Rocket Thruster**!
   - Jumps up to 8.5 meters into the sky and flies forward at supersonic speed (>150 km/h) over traffic, crowds, and obstacles.
   - **10-Second Cooldown**: After clicking or pressing <kbd>Ctrl</kbd> once, the rocket is deactivated for **10 seconds** before it can be activated again. Both the HUD button and dashboard display a live countdown timer (`⏳ রকেট কুলডাউন (10s)...(1s)`).
   - **Escapes the Public**: If caught/surrounded by an angry mob (`busted` or grabbed), firing the rocket instantly resurrects you, knocks all grabbers off, clears the mob, and launches you to safety!
   - ⚠️ **Bus & Truck Collision Rule**: When touching a **Bus or Truck**, the rocket **will NOT work**. If hit by a bus/truck (the game's fatal obstacle), the crash remains fatal and cannot be bypassed. If a bus/truck is touched in flight, the rocket immediately cancels!
3. 🖱️ **Full Mouse Integration with Cruise & Orientation Lock**:
   - **Mouse Forward (Up)**: Increases speed smoothly 🚀
   - **Mouse Backward (Down)**: Decreases speed / brakes 🛑
   - **Mouse Left**: Steers rickshaw left ⬅️
   - **Mouse Right**: Steers rickshaw right ➡️
   - **Mouse Stopped (Idle)**: **Speed and Orientation STAY LOCKED** in place! The rickshaw cruises forward along that exact heading at that exact speed without decelerating 🔒!

---

## 🎮 How the Mouse Integration Works

* **Throttle & Braking**:
  Moving the mouse forward pushes acceleration up past standard limits into turbo boost. Moving the mouse backward decelerates smoothly or brings you to a stop.
* **Steering & Wheel Tilt**:
  Moving the mouse horizontally rotates the rickshaw's heading (`yaw`) and angles the front wheel into the turn.
* **Idle Lock Mechanism**:
  Whenever the mouse stops moving (movement delta is zero), the current velocity (`b.v`) and current heading (`b.yaw`) are **frozen in cruise-lock**. The auto continues cruising effortlessly without you needing to hold down any buttons!
* **Pointer Lock**:
  Clicking on the game canvas captures the mouse cursor so you can turn and accelerate infinitely without hitting the screen borders. Press <kbd>Esc</kbd> anytime to release the cursor.

---

## 🚀 How to Install & Reload the Extension

1. Open your browser: Chrome, Brave, Edge, or Opera.
2. Go to `chrome://extensions/` (or `edge://extensions/`).
3. Turn on **Developer mode** (top-right switch).
4. If you already loaded the extension earlier, click the **Reload icon (↻)** on the *Baper Rasta* card.
   *(If installing for the first time, click **Load unpacked** and select `D:\New folder (4)`)*.
5. Open or refresh **[https://baperrasta.com/](https://baperrasta.com/)**.
6. You will see the on-screen HUD panel in the bottom-right corner:
   - **SPEED**: Live speed in km/h
   - **LOCK STATUS**: `[LOCKED 🔒]` when idle / `[ADJUSTING ⚡]` when mouse is moving
   - **POINTER STATUS**: Click canvas to lock mouse
7. Move mouse forward to accelerate, move left/right to steer, and stop moving to cruise with orientation locked!

---

## ⚡ DevTools Console One-Liner (Immediate Testing)

To test both the 100% battery lock and the mouse drive directly in the console without reloading:

```javascript
(() => {
  if (!location.search.includes('debug')) {
    const u = new URL(location.href);
    u.searchParams.set('debug', '');
    location.href = u.href;
    return;
  }
  if (!window.__at || !window.__at.P) return console.warn('Waiting for game...');
  const P = window.__at.P;
  Object.defineProperty(P, 'charge', { get: () => 1.0, set: () => {} });
  Object.defineProperty(P, 'pedal', { get: () => false, set: () => {} });

  let lockedSpeed = 10.0;
  let isMoving = false, timer = null;

  window.addEventListener('mousemove', (e) => {
    isMoving = true;
    clearTimeout(timer);
    timer = setTimeout(() => { isMoving = false; }, 120);

    const dx = e.movementX, dy = e.movementY;
    if (Math.abs(dy) > 0.3) lockedSpeed = Math.max(0, Math.min(19, lockedSpeed - dy * 0.05));
    if (Math.abs(dx) > 0.3) {
      P.yaw -= dx * 0.00175; // 0.5x rotation speed
      if (window.__at.PLAYER?.setFrame) window.__at.PLAYER.setFrame();
    }
  });

  function tick() {
    if (P.alive) {
      P.v = lockedSpeed;
      if (lockedSpeed > 11.5) P.boost = true;
      if (window.__at.PLAYER?.setFrame) window.__at.PLAYER.setFrame();
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  console.log('%c[Baper Rasta] 100% Battery & Mouse Drive Activated!', 'color:#4dff95;font-size:16px;font-weight:bold');
})();
```

---

## 📁 Updated File Structure

```
d:/New folder (4)/
├── manifest.json       # Manifest V3 (MAIN world injection)
├── content.js          # Battery 100% lock + Mouse Drive + Orientation/Speed Lock
├── popup.html          # Controls for battery, mouse drive, and sensitivity sliders
├── popup.css           # Styling with glassmorphism & Dhaka road aesthetics
├── popup.js            # Dual toggle & sensitivity handler
├── icons/              # 16px, 48px, 128px icons
└── README.md           # Documentation
```
