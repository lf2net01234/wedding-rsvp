/* 背景音樂：嵌入 YouTube 官方影片（播放器須可見，YouTube 規定）。
   賓客第一次點畫面時開始播放；右上角按鈕可暫停／播放。MUSIC_VIDEO_ID 空白則整個功能隱藏。 */
(function () {
  var id = (typeof MUSIC_VIDEO_ID !== 'undefined') ? String(MUSIC_VIDEO_ID || '').trim() : '';
  var card = document.getElementById('music-card');
  var btn = document.getElementById('music-btn');
  if (!id || !card || !btn) { console.log('[RSVP music] disabled (no MUSIC_VIDEO_ID)'); return; }

  var player = null, ready = false, wantPlay = false, userPaused = false, failed = false;
  card.hidden = false;
  btn.hidden = false;

  function setBtn(playing) {
    btn.classList.toggle('playing', playing);
    btn.setAttribute('aria-pressed', playing ? 'true' : 'false');
    btn.setAttribute('aria-label', playing ? '暫停音樂' : '播放音樂');
  }

  function fail(reason) {
    failed = true;
    card.hidden = true; btn.hidden = true;
    console.warn('[RSVP music] disabled:', reason);
  }

  function play() { if (ready && !failed) player.playVideo(); else wantPlay = true; }

  // 第一次互動就開始播放（瀏覽器規定須由使用者手勢觸發）
  function firstGesture(e) {
    if (e.target && e.target.closest && e.target.closest('#music-btn, #music-card')) return;
    document.removeEventListener('pointerdown', firstGesture, true);
    document.removeEventListener('keydown', firstGesture, true);
    if (!userPaused) { console.log('[RSVP music] first gesture → play'); play(); }
  }
  document.addEventListener('pointerdown', firstGesture, true);
  document.addEventListener('keydown', firstGesture, true);

  btn.addEventListener('click', function () {
    if (!ready) { wantPlay = !wantPlay; userPaused = !wantPlay; setBtn(wantPlay); return; }
    var playing = player.getPlayerState() === 1;
    if (playing) { userPaused = true; player.pauseVideo(); } else { userPaused = false; player.playVideo(); }
  });

  window.onYouTubeIframeAPIReady = function () {
    player = new YT.Player('music-player', {
      videoId: id,
      playerVars: { playsinline: 1, rel: 0, loop: 1, playlist: id },
      events: {
        onReady: function () { ready = true; console.log('[RSVP music] ready id=%s', id); if (wantPlay) player.playVideo(); },
        onStateChange: function (e) { console.log('[RSVP music] state=%s (1=播放 2=暫停 -1/5=未開始)', e.data); setBtn(e.data === 1); },
        onError: function (e) { fail('youtube error ' + e.data + '（101/150＝影片不允許嵌入）'); }
      }
    });
  };

  var s = document.createElement('script');
  s.src = 'https://www.youtube.com/iframe_api';
  s.onerror = function () { fail('iframe_api load failed'); };
  document.head.appendChild(s);
})();
