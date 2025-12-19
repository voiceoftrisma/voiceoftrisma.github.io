const playerEl = document.createElement('div');
playerEl.className = 'player';
playerEl.id = 'player';
playerEl.hidden = true;
playerEl.innerHTML = `
  <button id="closePlayerBtn" class="close-btn" style="float:right; margin-bottom:5px;">&times;</button>
  <h4 id="nowTitle">—</h4>
  <p id="nowSub">Memuat pemutar…</p>
  <audio id="audio" controls preload="none" style="width:100%"></audio>
`;
const audioEl = playerEl.querySelector('#audio');
const nowTitle = playerEl.querySelector('#nowTitle');
const nowSub = playerEl.querySelector('#nowSub');
const closePlayerBtn = playerEl.querySelector('#closePlayerBtn');

// Function to detect multi-column mode
function isMultiColumnMode() {
  return window.innerWidth > 767;
}

// Function to show player as toast
function showPlayerAsToast() {
  playerEl.classList.add('toast-player');
  document.body.appendChild(playerEl);
  playerEl.hidden = false;
}

// Function to hide player toast
function hidePlayerToast() {
  if (playerEl.parentNode === document.body) {
    document.body.removeChild(playerEl);
  }
  playerEl.hidden = true;
  playerEl.classList.remove('toast-player');
}

// Close button event
closePlayerBtn.onclick = () => {
  hidePlayerToast();
};

// Function to handle mode switching when window resizes
function handleModeSwitch() {
  if (playerEl.hidden) return; // No player visible

  const isCurrentlyToast = playerEl.classList.contains('toast-player');
  const shouldBeToast = isMultiColumnMode();

  if (isCurrentlyToast && !shouldBeToast) {
    // Switch from toast to inline
    hidePlayerToast();
    // Find the currently playing item and insert above it
    const playingId = nowSub.textContent;
    if (playingId && playingId !== '—') {
      const rows = document.querySelectorAll('.list-group-item');
      for (const row of rows) {
        const badge = row.querySelector('.badge-id');
        if (badge && badge.textContent === playingId) {
          row.parentNode.insertBefore(playerEl, row);
          playerEl.hidden = false;
          break;
        }
      }
    }
  } else if (!isCurrentlyToast && shouldBeToast) {
    // Switch from inline to toast
    if (playerEl.parentNode) playerEl.parentNode.removeChild(playerEl);
    showPlayerAsToast();
  }
}

// Add window resize listener
window.addEventListener('resize', handleModeSwitch);
