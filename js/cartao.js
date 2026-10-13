// Página do cartão para quem recebe (cartao.html).
(function(){
  const { escapeHtml, findCategory, formatDateCounter, decodeCard, CardStore, secToMMSS } = window.Cartao;
  const $ = (id) => document.getElementById(id);

  let card = null;
  let player = null;       // YT.Player
  let playerReady = false;
  let wantsPlay = false;   // clicou em "abrir" antes do player ficar pronto

  /* ---------------- pétalas ---------------- */
  function spawnPetals(){
    const box = $('petals');
    const colors = ['var(--rose)', 'var(--gold)', '#d9a3aa', 'var(--sage)'];
    for(let i = 0; i < 14; i++){
      const p = document.createElement('span');
      p.className = 'petal';
      p.style.left = Math.random() * 100 + '%';
      p.style.background = colors[i % colors.length];
      p.style.animationDuration = (9 + Math.random() * 9) + 's';
      p.style.animationDelay = (-Math.random() * 18) + 's';
      p.style.transform = `scale(${0.6 + Math.random() * 0.7})`;
      box.appendChild(p);
    }
  }

  /* ---------------- carregar cartão ---------------- */
  async function loadCard(){
    const params = new URLSearchParams(location.search);
    const slug = params.get('c') || '';
    const token = location.hash.slice(1);

    let data = await decodeCard(token);
    const local = slug ? CardStore.get(slug) : null;
    // Sem dados no link (ex: link cortado): usa a cópia salva neste aparelho, se houver
    if(!data && local) data = local.card;
    if(!data) return null;

    // Fotos só existem no aparelho de quem criou (modo sem servidor)
    const photos = local && local.card && local.card.id === data.id ? local.photos : [];
    return { ...data, photos: Array.isArray(photos) ? photos : [] };
  }

  /* ---------------- montar cartão ---------------- */
  function renderCard(){
    const cat = findCategory(card.category);
    $('cCat').textContent = cat ? `${cat.icon} ${cat.label}` : 'Um cartão para você';
    $('cTitle').textContent = card.title || 'Um cartão para você';
    $('cEmojis').textContent = (card.emojis || []).slice(0, 3).join(' ');
    document.title = `${card.title || 'Você recebeu um cartão'} 🌸`;

    const counter = formatDateCounter(card.date);
    if(counter){ $('cDate').hidden = false; $('cDate').textContent = `🗓️ ${counter}`; }

    const msg = $('cMsg');
    msg.textContent = card.message || '';
    msg.hidden = !card.message;
    if(card.style === 'serif') msg.classList.add('style-serif');
    if(card.style === 'script') msg.classList.add('style-script');

    if(card.from){
      $('cFrom').hidden = false;
      $('cFrom').innerHTML = `Com carinho,<br><b>${escapeHtml(card.from)}</b>`;
    }

    renderGallery();

    if(card.music && /^[\w-]{11}$/.test(card.music.id)){
      $('cMusic').hidden = false;
      const thumb = `https://i.ytimg.com/vi/${card.music.id}/hqdefault.jpg`;
      $('cMusicThumb').src = thumb;
      $('cMusicBg').style.backgroundImage = `url("${thumb}")`;
      $('cSong').textContent = card.music.title || 'Música do cartão';
      $('cSongSub').textContent = card.music.channel || '';
      $('soundHint').hidden = false;
      loadYouTube();
    }
  }

  function renderGallery(){
    const photos = card.photos.filter(src => typeof src === 'string' && src.startsWith('data:image/'));
    if(!photos.length) return;
    $('cGallery').hidden = false;
    const main = $('cMainPhoto');
    main.src = photos[0];

    const thumbs = $('cThumbs');
    if(photos.length < 2){ thumbs.hidden = true; return; }
    photos.forEach((src, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', `Ver foto ${i + 1}`);
      b.setAttribute('aria-current', i === 0 ? 'true' : 'false');
      const img = document.createElement('img');
      img.src = src; img.alt = '';
      b.appendChild(img);
      b.addEventListener('click', () => {
        main.src = src;
        thumbs.querySelectorAll('button').forEach(x => x.setAttribute('aria-current', x === b ? 'true' : 'false'));
      });
      thumbs.appendChild(b);
    });
  }

  /* ---------------- música (YouTube IFrame API, player invisível) ---------------- */
  let snipStart = 0, snipEnd = 0, snipDur = 0;
  let isPlaying = false;
  let loopTimer = null, raf = null;

  function setPlayUI(on){
    isPlaying = on;
    $('cPlay').textContent = on ? '❚❚' : '▶';
    $('cPlay').setAttribute('aria-label', on ? 'Pausar música' : 'Tocar música');
  }

  // Progresso visual acompanhando a tela; volta ao início do trecho ao chegar no fim (timer, funciona em 2º plano)
  function drawProgress(){
    if(!player || !player.getCurrentTime) return;
    const t = Math.min(Math.max(player.getCurrentTime() - snipStart, 0), snipDur);
    $('cProgress').style.transform = `scaleX(${snipDur ? t / snipDur : 0})`;
    $('cElapsed').textContent = secToMMSS(t);
  }
  function animate(){
    drawProgress();
    if(isPlaying) raf = requestAnimationFrame(animate);
  }
  function checkLoop(){
    drawProgress(); // garante o progresso mesmo se a animação estiver pausada pelo navegador
    if(player && player.getCurrentTime && player.getCurrentTime() >= snipEnd - 0.1){
      player.seekTo(snipStart, true);
    }
  }

  function loadYouTube(){
    const m = card.music;
    snipStart = Math.max(0, m.start | 0);
    snipDur = Math.max(5, Math.min(120, (m.dur | 0) || 30));
    snipEnd = snipStart + snipDur;
    $('cTotal').textContent = secToMMSS(snipDur);

    window.onYouTubeIframeAPIReady = () => {
      player = new YT.Player('ytPlayer', {
        width: 200, height: 200, videoId: m.id,
        playerVars: { start: snipStart, rel: 0, playsinline: 1, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3 },
        events: {
          onReady: () => {
            playerReady = true;
            if(wantsPlay) player.playVideo();
          },
          onStateChange: (e) => {
            if(e.data === YT.PlayerState.PLAYING){
              setPlayUI(true);
              clearInterval(loopTimer);
              loopTimer = setInterval(checkLoop, 100);
              cancelAnimationFrame(raf);
              raf = requestAnimationFrame(animate);
            } else if(e.data === YT.PlayerState.PAUSED){
              setPlayUI(false);
              clearInterval(loopTimer);
              drawProgress();
            } else if(e.data === YT.PlayerState.ENDED){
              // Vídeo acabou antes do fim do trecho: recomeça o trecho
              player.seekTo(snipStart, true);
              player.playVideo();
            }
          },
          onError: () => {
            $('cSongSub').textContent = 'Não foi possível tocar esta música';
            $('cPlay').disabled = true;
          },
        },
      });
    };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);

    $('cPlay').addEventListener('click', () => {
      if(!playerReady){ wantsPlay = !wantsPlay; setPlayUI(wantsPlay); return; }
      if(isPlaying) player.pauseVideo();
      else player.playVideo();
    });
  }

  function openCard(){
    wantsPlay = true;
    if(playerReady) player.playVideo(); // ainda dentro do clique: o navegador libera o som

    const env = $('envelope');
    env.classList.add('leaving');
    const reveal = () => {
      env.hidden = true;
      $('cardView').classList.add('visible');
      $('cTitle').setAttribute('tabindex', '-1');
      $('cTitle').focus({ preventScroll: true });
    };
    if(matchMedia('(prefers-reduced-motion: reduce)').matches) reveal();
    else setTimeout(reveal, 450);
  }

  /* ---------------- início ---------------- */
  (async function init(){
    spawnPetals();
    card = await loadCard();

    if(!card){
      $('notFound').classList.add('visible');
      document.title = 'Cartão não encontrado';
      return;
    }

    const cat = findCategory(card.category);
    if(cat) $('seal').textContent = cat.icon;
    if(card.from) $('envFrom').textContent = `de ${card.from}`;
    // O envelope só aparece depois que o cartão foi carregado: evita "piscar" a tela de erro
    $('envelope').hidden = false;
    renderCard();
    $('openBtn').addEventListener('click', openCard);
    $('openBtn').focus();
  })();
})();
