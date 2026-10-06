import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Settings,
  Users,
  ShoppingBag,
  Pause,
  RotateCcw,
  Share2,
  Volume2,
  VolumeX,
  Trophy,
  Zap,
  Flame,
  X,
  Check,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { TEAMS, SHOP_ITEMS_PREVIEW, Player } from './data/teams';
import { soundEngine } from './audio/soundEngine';
import { DominicanFlag } from './components/DominicanFlag';
import { Stadium3D, ActivePlayData, HitType } from './components/Stadium3D';

const COVER_IMAGE_URL = '/src/assets/images/portada_beisbol_dominicano_1791291125541.jpg';
const STORAGE_KEY_HIGHSCORE = 'beisbol_rd9_highscore_v1';
const STORAGE_KEY_HOMERUNS = 'beisbol_rd9_homeruns_v1';

type ScreenMode = 'COVER' | 'PLAYING' | 'GAME_OVER';
type ModalType = 'NONE' | 'EQUIPO' | 'AJUSTES' | 'TIENDA' | 'PAUSE';

export default function App() {
  const initialScreen = (): ScreenMode => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') return 'PLAYING';
    }
    return 'COVER';
  };

  const [screen, setScreen] = useState<ScreenMode>(initialScreen);
  const [activeModal, setActiveModal] = useState<ModalType>('NONE');
  const [selectedTeamTab, setSelectedTeamTab] = useState<'LIC' | 'AGU'>('LIC');
  const [coverImgError, setCoverImgError] = useState(false);

  // Settings
  const [merengueOn, setMerengueOn] = useState(true);
  const [sfxOn, setSfxOn] = useState(true);
  const [highFpsMode, setHighFpsMode] = useState(true);

  // Game Score & 1 Inning State
  const [scoreLic, setScoreLic] = useState(0);
  const [scoreAgu, setScoreAgu] = useState(0);
  const [outs, setOuts] = useState(0);
  const [isTopInning, setIsTopInning] = useState(true); // True = Licey Azules bat, False = Azules pitch
  const [bases, setBases] = useState<[boolean, boolean, boolean]>([false, false, false]);
  const [licBatterIdx, setLicBatterIdx] = useState(0);
  const [aguBatterIdx, setAguBatterIdx] = useState(0);
  const [homeRunsThisGame, setHomeRunsThisGame] = useState(0);

  // High Scores in localStorage
  const [highScore, setHighScore] = useState<number>(() => {
    try {
      return Number(localStorage.getItem(STORAGE_KEY_HIGHSCORE) || '0');
    } catch {
      return 0;
    }
  });
  const [totalHomeRuns, setTotalHomeRuns] = useState<number>(() => {
    try {
      return Number(localStorage.getItem(STORAGE_KEY_HOMERUNS) || '0');
    } catch {
      return 0;
    }
  });

  // UI Feedback & Animations
  const [playPhase, setPlayPhase] = useState<'IDLE' | 'PITCHING' | 'BALL_IN_PLAY' | 'RESULT_PAUSE'>('IDLE');
  const [pitchTimingPct, setPitchTimingPct] = useState(0);
  const [bannerText, setBannerText] = useState<string | null>(null);
  const [bannerSubtext, setBannerSubtext] = useState<string | null>(null);
  const [isHomeRunBanner, setIsHomeRunBanner] = useState(false);
  const [pitchStyle, setPitchStyle] = useState<'CURVA' | 'RECTA'>('CURVA');
  const [shareCopiedToast, setShareCopiedToast] = useState(false);

  // Virtual Joystick state for Base Running
  const [joystickPos, setJoystickPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [joystickActive, setJoystickActive] = useState(false);

  // Swipe Trail visual
  const [swipeVector, setSwipeVector] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  // Mutable ref shared with 3D Canvas
  const playDataRef = useRef<ActivePlayData>({
    state: 'IDLE',
    isTopInning: true,
    pitchProgress: 0,
    pitchCurveX: 0.65,
    hitType: 'NONE',
    hitProgress: 0,
    hitTarget: { x: 0, y: 0, z: -20 },
    bases: [false, false, false],
    runnerBoost: 1.0,
    batterSkin: TEAMS.LIC.players[0].skinColor,
    pitcherSkin: TEAMS.AGU.players[3].skinColor,
  });

  const currentBatter: Player = isTopInning
    ? TEAMS.LIC.players[licBatterIdx % 9]
    : TEAMS.AGU.players[aguBatterIdx % 9];

  const currentPitcher: Player = isTopInning
    ? TEAMS.AGU.players[3] // El Aguilucho 15
    : TEAMS.LIC.players[1]; // La Para 34

  useEffect(() => {
    playDataRef.current.isTopInning = isTopInning;
    playDataRef.current.bases = bases;
    playDataRef.current.batterSkin = currentBatter.skinColor;
    playDataRef.current.pitcherSkin = currentPitcher.skinColor;
  }, [isTopInning, bases, currentBatter, currentPitcher]);

  useEffect(() => {
    soundEngine.merengueEnabled = merengueOn;
    soundEngine.sfxEnabled = sfxOn;
  }, [merengueOn, sfxOn]);

  const recordScoreAndHR = useCallback(
    (newLicScore: number, addedHR: number) => {
      if (newLicScore > highScore) {
        setHighScore(newLicScore);
        try {
          localStorage.setItem(STORAGE_KEY_HIGHSCORE, String(newLicScore));
        } catch {
          // ignore
        }
      }
      if (addedHR > 0) {
        const updatedHR = totalHomeRuns + addedHR;
        setTotalHomeRuns(updatedHR);
        try {
          localStorage.setItem(STORAGE_KEY_HOMERUNS, String(updatedHR));
        } catch {
          // ignore
        }
      }
    },
    [highScore, totalHomeRuns]
  );

  const advanceRunners = useCallback(
    (basesToAdvance: number, currentBases: [boolean, boolean, boolean]): { nextBases: [boolean, boolean, boolean]; runs: number } => {
      let runs = 0;
      const b = [...currentBases];

      if (basesToAdvance >= 4) {
        // Home Run! Batter + all base runners score
        runs = 1 + (b[0] ? 1 : 0) + (b[1] ? 1 : 0) + (b[2] ? 1 : 0);
        return { nextBases: [false, false, false], runs };
      }

      const next: [boolean, boolean, boolean] = [false, false, false];
      for (let i = 2; i >= 0; i--) {
        if (b[i]) {
          const dest = i + basesToAdvance;
          if (dest >= 3) {
            runs++;
          } else {
            next[dest] = true;
          }
        }
      }
      const batterDest = basesToAdvance - 1;
      if (batterDest >= 0 && batterDest < 3) {
        next[batterDest] = true;
      }
      return { nextBases: next, runs };
    },
    []
  );

  const resolvePlayOutcome = useCallback(
    (outcome: {
      isOut: boolean;
      basesEarned: number;
      title: string;
      subtitle: string;
      isHR?: boolean;
    }) => {
      setPlayPhase('RESULT_PAUSE');
      playDataRef.current.state = 'RESULT_PAUSE';
      setBannerText(outcome.title);
      setBannerSubtext(outcome.subtitle);
      setIsHomeRunBanner(Boolean(outcome.isHR));

      if (outcome.isOut) {
        soundEngine.playStrikeOrOut();
      }

      setTimeout(() => {
        setBannerText(null);
        setBannerSubtext(null);
        setIsHomeRunBanner(false);

        if (isTopInning) {
          setLicBatterIdx((i) => (i + 1) % 9);
        } else {
          setAguBatterIdx((i) => (i + 1) % 9);
        }

        if (outcome.isOut) {
          const nextOuts = outs + 1;
          if (nextOuts >= 3) {
            // 3 Outs: switch sides or end 1 Inning game
            setOuts(0);
            setBases([false, false, false]);
            playDataRef.current.bases = [false, false, false];

            if (isTopInning) {
              setIsTopInning(false);
              setBannerText('¡CAMBIO DE LADO!');
              setBannerSubtext('1ST ▼ · Te toca LANZAR con La Para 34');
              setTimeout(() => {
                setBannerText(null);
                setBannerSubtext(null);
                setPlayPhase('IDLE');
                playDataRef.current.state = 'IDLE';
              }, 1500);
            } else {
              setScreen('GAME_OVER');
              setPlayPhase('IDLE');
              playDataRef.current.state = 'IDLE';
            }
            return;
          } else {
            setOuts(nextOuts);
          }
        } else if (outcome.basesEarned > 0) {
          const { nextBases, runs } = advanceRunners(outcome.basesEarned, bases);
          setBases(nextBases);
          playDataRef.current.bases = nextBases;

          if (runs > 0) {
            if (isTopInning) {
              const updatedLic = scoreLic + runs;
              setScoreLic(updatedLic);
              recordScoreAndHR(updatedLic, outcome.isHR ? 1 : 0);
            } else {
              setScoreAgu((s) => s + runs);
            }
          } else if (outcome.isHR) {
            recordScoreAndHR(scoreLic, 1);
          }

          if (outcome.isHR && isTopInning) {
            setHomeRunsThisGame((h) => h + 1);
          }
        }

        setPlayPhase('IDLE');
        playDataRef.current.state = 'IDLE';
        setPitchTimingPct(0);
      }, outcome.isHR ? 2300 : 1350);
    },
    [outs, isTopInning, bases, scoreLic, advanceRunners, recordScoreAndHR]
  );

  const launchBallInPlay = useCallback(
    (
      hitType: HitType,
      target: { x: number; y: number; z: number },
      outcome: { isOut: boolean; basesEarned: number; title: string; subtitle: string; isHR?: boolean }
    ) => {
      setPlayPhase('BALL_IN_PLAY');
      playDataRef.current.state = 'BALL_IN_PLAY';
      playDataRef.current.hitType = hitType;
      playDataRef.current.hitProgress = 0;
      playDataRef.current.hitTarget = target;

      soundEngine.playBatCrack(Boolean(outcome.isHR));

      if (outcome.isHR) {
        setBannerText('¡SE FUEEE! ¡HÓME RUN!');
        setBannerSubtext(`¡Palo de ${currentBatter.name} por los 411 del Quisqueya!`);
        setIsHomeRunBanner(true);
      }

      const startTime = performance.now();
      const duration = outcome.isHR ? 1650 : 1250;

      const stepBall = (now: number) => {
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / duration);
        playDataRef.current.hitProgress = t;

        if (t < 1) {
          requestAnimationFrame(stepBall);
        } else {
          resolvePlayOutcome(outcome);
        }
      };

      requestAnimationFrame(stepBall);
    },
    [currentBatter.name, resolvePlayOutcome]
  );

  const startPitch = useCallback(
    (customStyle?: 'CURVA' | 'RECTA') => {
      if (playDataRef.current.state !== 'IDLE' || screen !== 'PLAYING' || activeModal !== 'NONE') return;

      const chosenStyle = customStyle || pitchStyle;
      setPlayPhase('PITCHING');
      playDataRef.current.state = 'PITCHING';
      playDataRef.current.pitchProgress = 0;
      playDataRef.current.pitchCurveX =
        chosenStyle === 'CURVA' ? (Math.random() > 0.5 ? 0.85 : -0.85) : (Math.random() - 0.5) * 0.2;

      soundEngine.playPitchSound();

      const startTime = performance.now();
      const pitchDuration = chosenStyle === 'RECTA' ? 920 : 1120;

      const animatePitch = (now: number) => {
        if (playDataRef.current.state !== 'PITCHING') return;

        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / pitchDuration);
        playDataRef.current.pitchProgress = t;
        setPitchTimingPct(Math.round(t * 100));

        // When in Bottom of 1st Inning (Player is Pitcher), AI batter swings
        if (!isTopInning && t >= 0.78 && playDataRef.current.state === 'PITCHING') {
          const roll = Math.random();
          if (roll < 0.58) {
            if (roll < 0.32) {
              resolvePlayOutcome({
                isOut: true,
                basesEarned: 0,
                title: '¡PONCHE CANTADO!',
                subtitle: `${currentPitcher.name} lo engañó con la ${chosenStyle.toLowerCase()}`,
              });
            } else {
              launchBallInPlay(
                'ROLLING',
                { x: (Math.random() - 0.5) * 12, y: 0, z: -6 },
                {
                  isOut: true,
                  basesEarned: 0,
                  title: '¡OUT EN PRIMERA!',
                  subtitle: 'Rodado fácil dominado por el cuadro',
                }
              );
            }
          } else if (roll < 0.88) {
            launchBallInPlay(
              'LINE_DRIVE',
              { x: (Math.random() - 0.5) * 22, y: 0, z: -19 },
              {
                isOut: false,
                basesEarned: 1,
                title: '¡HIT DE LOS AMARILLOS!',
                subtitle: `${currentBatter.name} conecta hit al jardín`,
              }
            );
          } else {
            launchBallInPlay(
              'FLY',
              { x: (Math.random() - 0.5) * 26, y: 0, z: -29 },
              {
                isOut: false,
                basesEarned: 2,
                title: '¡DOBLE AL FONDO!',
                subtitle: `${currentBatter.name} la manda contra la barda`,
              }
            );
          }
          return;
        }

        if (t < 1) {
          requestAnimationFrame(animatePitch);
        } else {
          resolvePlayOutcome({
            isOut: true,
            basesEarned: 0,
            title: '¡STRIKE TRES! ¡OUT!',
            subtitle: 'Te quedaste mirando el lanzamiento',
          });
        }
      };

      requestAnimationFrame(animatePitch);
    },
    [screen, activeModal, pitchStyle, isTopInning, currentPitcher.name, currentBatter.name, resolvePlayOutcome, launchBallInPlay]
  );

  // Automatic pitch when user is batting in Top of 1st Inning
  useEffect(() => {
    if (screen !== 'PLAYING' || activeModal !== 'NONE' || !isTopInning || playPhase !== 'IDLE') return;

    const timer = window.setTimeout(() => {
      startPitch(Math.random() > 0.45 ? 'CURVA' : 'RECTA');
    }, 1100);

    return () => clearTimeout(timer);
  }, [screen, activeModal, isTopInning, playPhase, startPitch]);

  // Execute Batter Swing (Swipe Up = Power, Tap = Toque)
  const handleBatterAction = useCallback(
    (actionType: 'SWIPE_POWER' | 'TAP_BUNT') => {
      if (screen !== 'PLAYING' || !isTopInning) return;

      if (playDataRef.current.state === 'IDLE') {
        startPitch('CURVA');
        return;
      }

      if (playDataRef.current.state !== 'PITCHING') return;

      const t = playDataRef.current.pitchProgress;
      const powerBonus = (currentBatter.power - 5) * 0.02;
      const contactBonus = (currentBatter.contact - 5) * 0.025;

      if (actionType === 'TAP_BUNT') {
        const buntSuccess = t >= 0.35 && t <= 0.95;
        if (buntSuccess) {
          const isSafe = Math.random() < 0.68 + contactBonus;
          launchBallInPlay(
            'BUNT',
            { x: (Math.random() - 0.5) * 6, y: 0, z: 6.5 },
            isSafe
              ? {
                  isOut: false,
                  basesEarned: 1,
                  title: '¡TOQUE SORPRESA! ¡SAFE!',
                  subtitle: `${currentBatter.name} llegó quieto a primera`,
                }
              : {
                  isOut: true,
                  basesEarned: 0,
                  title: '¡OUT EN EL TOQUE!',
                  subtitle: 'Tiro certero a primera base',
                }
          );
        } else {
          resolvePlayOutcome({
            isOut: true,
            basesEarned: 0,
            title: '¡FOUL EN TOQUE! ¡OUT!',
            subtitle: 'Toque a destiempo',
          });
        }
        return;
      }

      // Swipe Arriba = Bateo Potente
      const distFromSweetSpot = Math.abs(t - 0.74);

      if (distFromSweetSpot <= 0.16 + powerBonus) {
        // HOME RUN
        const hrX = (Math.random() - 0.5) * 28;
        launchBallInPlay(
          'HOME_RUN',
          { x: hrX, y: 8.5, z: -46 },
          {
            isOut: false,
            basesEarned: 4,
            title: '¡SE FUEEE! ¡HÓME RUN!',
            subtitle: `¡Palo descomunal de ${currentBatter.name} por los 411!`,
            isHR: true,
          }
        );
      } else if (distFromSweetSpot <= 0.28 + contactBonus) {
        const isDouble = Math.random() < 0.45 + powerBonus;
        launchBallInPlay(
          isDouble ? 'FLY' : 'LINE_DRIVE',
          { x: (Math.random() - 0.5) * 30, y: 0, z: isDouble ? -31 : -21 },
          {
            isOut: false,
            basesEarned: isDouble ? 2 : 1,
            title: isDouble ? '¡DOBLE ENTRE DOS!' : '¡LÍNEA DE HIT!',
            subtitle: `${currentBatter.name} pone a gozar al Licey`,
          }
        );
      } else if (distFromSweetSpot <= 0.38) {
        const isFly = Math.random() > 0.5;
        const luckyHit = Math.random() < 0.28 + (playDataRef.current.runnerBoost > 1.1 ? 0.2 : 0);
        launchBallInPlay(
          isFly ? 'FLY' : 'ROLLING',
          { x: (Math.random() - 0.5) * 18, y: 0, z: isFly ? -22 : -6 },
          luckyHit
            ? {
                isOut: false,
                basesEarned: 1,
                title: '¡INFILD HIT!',
                subtitle: `${currentBatter.name} batió el tiro por piernas`,
              }
            : {
                isOut: true,
                basesEarned: 0,
                title: isFly ? '¡FLY CAPTURADO! ¡OUT!' : '¡RODAZO AL CUADRO! ¡OUT!',
                subtitle: 'Buena jugada de la defensa amarilla',
              }
        );
      } else {
        resolvePlayOutcome({
          isOut: true,
          basesEarned: 0,
          title: '¡SWING EN BLANCO! ¡OUT!',
          subtitle: 'Llegaste tarde al pitcheo',
        });
      }
    },
    [screen, isTopInning, currentBatter, startPitch, launchBallInPlay, resolvePlayOutcome]
  );

  // Touch / Pointer gesture handlers for mobile swipe & tap
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (screen !== 'PLAYING' || activeModal !== 'NONE') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    touchStartRef.current = { x, y, time: performance.now() };
    setSwipeVector({ x1: x, y1: y, x2: x, y2: y });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!touchStartRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setSwipeVector({
      x1: touchStartRef.current.x,
      y1: touchStartRef.current.y,
      x2: x,
      y2: y,
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!touchStartRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;
    const dx = endX - touchStartRef.current.x;
    const dy = endY - touchStartRef.current.y;
    const dist = Math.hypot(dx, dy);

    touchStartRef.current = null;
    setTimeout(() => setSwipeVector(null), 180);

    if (!isTopInning) return;

    if (dy < -22 || dist >= 28) {
      handleBatterAction('SWIPE_POWER');
    } else {
      handleBatterAction('TAP_BUNT');
    }
  };

  const handleStartNewGame = () => {
    soundEngine.startMerengueLoop();
    setScoreLic(0);
    setScoreAgu(0);
    setOuts(0);
    setIsTopInning(true);
    setBases([false, false, false]);
    setHomeRunsThisGame(0);
    setBannerText(null);
    setBannerSubtext(null);
    setIsHomeRunBanner(false);
    setActiveModal('NONE');
    setPlayPhase('IDLE');
    playDataRef.current.state = 'IDLE';
    playDataRef.current.isTopInning = true;
    playDataRef.current.bases = [false, false, false];
    setScreen('PLAYING');
  };

  // WhatsApp Viral Share
  const handleShareWhatsApp = () => {
    const shareUrl = typeof window !== 'undefined' ? window.location.href : 'https://beisboldominicano9.app';
    const message = `¡Le di un jonrón a las Águilas en Béisbol Dominicano 9! Juega aquí: ${shareUrl}`;

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(message).catch(() => {});
    }
    setShareCopiedToast(true);
    setTimeout(() => setShareCopiedToast(false), 3200);

    // Also trigger native share or open WhatsApp URL if supported
    if (typeof window !== 'undefined') {
      const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
      const link = document.createElement('a');
      link.href = waUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.click();
    }
  };

  const handleJoystickMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!joystickActive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = Math.max(-22, Math.min(22, e.clientX - cx));
    const dy = Math.max(-22, Math.min(22, e.clientY - cy));
    setJoystickPos({ x: dx, y: dy });
    playDataRef.current.runnerBoost = 1.35;
  };

  const handleJoystickRelease = () => {
    setJoystickActive(false);
    setJoystickPos({ x: 0, y: 0 });
    playDataRef.current.runnerBoost = 1.0;
  };

  return (
    <main
      data-state={screen.toLowerCase()}
      className="relative w-full h-dvh bg-slate-950 flex items-center justify-center overflow-hidden select-none"
    >
      {/* Desktop Background Blur Surround */}
      <div
        className="hidden md:block absolute inset-0 bg-cover bg-center opacity-25 blur-xl scale-105 pointer-events-none"
        style={{ backgroundImage: `url(${COVER_IMAGE_URL})` }}
      />

      {/* 9:16 Vertical Mobile Frame (Full screen on mobile, 9:16 aspect on desktop) */}
      <div className="relative w-full h-full md:max-w-[430px] md:max-h-[880px] md:aspect-[9/16] md:rounded-3xl md:border-2 md:border-white/15 md:shadow-2xl overflow-hidden bg-sky-900 flex flex-col">
        {/* =========================================================
            1. PORTADA SCREEN (Con Arte Vertical Chibi Quisqueya)
        ========================================================= */}
        {screen === 'COVER' && (
          <div className="relative w-full h-full flex flex-col justify-between overflow-hidden">
            {!coverImgError ? (
              <img
                src={COVER_IMAGE_URL}
                alt="Portada Béisbol Dominicano 9 Estadio Quisqueya con 4 jugadores Licey"
                referrerPolicy="no-referrer"
                onError={() => setCoverImgError(true)}
                className="absolute inset-0 w-full h-full object-cover object-center"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-b from-sky-500 via-blue-800 to-emerald-800" />
            )}

            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/75 via-transparent to-slate-950/90 pointer-events-none" />

            {/* Header: Estadio Quisqueya + Banderas Dominicanas + Título */}
            <header className="relative z-10 pt-4 px-4 flex flex-col items-center text-center">
              <div className="flex items-center justify-between w-full mb-2">
                <DominicanFlag className="w-11 h-7" delayMs={0} />
                <div className="bg-blue-950/90 border-2 border-amber-400/80 px-3 py-1 rounded-xl shadow-lg">
                  <p className="text-[10px] font-extrabold tracking-widest text-amber-300 uppercase">
                    ESTADIO QUISQUEYA • JUAN MARICHAL
                  </p>
                </div>
                <DominicanFlag className="w-11 h-7" delayMs={400} />
              </div>

              <div className="mt-1 px-4 py-2 rounded-2xl bg-slate-950/65 backdrop-blur-md border border-white/15 shadow-xl">
                <h1 className="font-display text-3xl font-extrabold italic tracking-tight text-white drop-shadow-[0_3px_0_rgba(29,78,216,1)]">
                  BÉISBOL DOMINICANO <span className="text-amber-400">9</span>
                </h1>
                <p className="text-xs font-semibold text-sky-200 mt-0.5">
                  Azules del Licey vs Águilas Amarillas · V1 Web Móvil
                </p>
              </div>

              {/* Récords Guardados en localStorage */}
              <div className="mt-2.5 flex items-center gap-3 text-xs font-bold text-amber-200 bg-slate-900/80 backdrop-blur-sm px-3.5 py-1.5 rounded-xl border border-amber-400/30">
                <span className="flex items-center gap-1 tabular-nums">
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  Récord Carreras: {highScore}
                </span>
                <span aria-hidden="true">·</span>
                <span className="flex items-center gap-1 tabular-nums">
                  <Flame className="w-3.5 h-3.5 text-orange-400" />
                  Jonrones: {totalHomeRuns}
                </span>
              </div>
            </header>

            {/* Botones de la Portada: PLAY (Grande Azul), Ajustes, Equipo, Tienda */}
            <div className="relative z-10 p-4 pb-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={handleStartNewGame}
                aria-label="PLAY"
                className="w-full min-h-[60px] py-3.5 px-6 rounded-2xl bg-gradient-to-b from-blue-500 via-blue-600 to-blue-800 hover:from-blue-400 hover:to-blue-700 active:scale-[0.98] border-2 border-sky-300 shadow-[0_6px_0_#1e3a8a,0_12px_24px_rgba(0,0,0,0.6)] flex items-center justify-center gap-3 transition-transform cursor-pointer"
              >
                <Play className="w-7 h-7 text-amber-300 fill-amber-300 shrink-0" />
                <span className="font-display text-2xl font-extrabold tracking-wider text-white whitespace-nowrap">
                  PLAY ¡A JUGAR!
                </span>
              </button>

              <div className="grid grid-cols-3 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setActiveModal('EQUIPO')}
                  aria-label="Equipo"
                  className="min-h-[48px] py-2.5 px-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 active:scale-95 border border-white/20 flex items-center justify-center gap-1.5 text-xs font-bold text-white shadow-md cursor-pointer"
                >
                  <Users className="w-4 h-4 text-sky-400 shrink-0" />
                  <span className="whitespace-nowrap">Equipo</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveModal('AJUSTES')}
                  aria-label="Ajustes"
                  className="min-h-[48px] py-2.5 px-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 active:scale-95 border border-white/20 flex items-center justify-center gap-1.5 text-xs font-bold text-white shadow-md cursor-pointer"
                >
                  <Settings className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="whitespace-nowrap">Ajustes</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveModal('TIENDA')}
                  aria-label="Tienda"
                  className="min-h-[48px] py-2.5 px-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 active:scale-95 border border-white/20 flex items-center justify-center gap-1.5 text-xs font-bold text-white shadow-md cursor-pointer"
                >
                  <ShoppingBag className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="whitespace-nowrap">Tienda</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            2. GAMEPLAY 3D (Solo 1 Inning para V1 · Detrás del Pitcher)
        ========================================================= */}
        {(screen === 'PLAYING' || screen === 'GAME_OVER') && (
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="relative w-full h-full flex flex-col justify-between overflow-hidden touch-none"
          >
            <Stadium3D playDataRef={playDataRef} highFpsMode={highFpsMode} />

            {/* Marcador Arriba: LIC 0 - AGU 0 | 1ST INNING | 0 OUTS + Botón PAUSE */}
            <header className="relative z-20 pt-2.5 px-3 flex items-center justify-between gap-2 pointer-events-auto">
              <DominicanFlag className="w-9 h-6 shrink-0" />

              <div
                data-testid="scoreboard"
                className="flex-1 bg-slate-950/85 backdrop-blur-md border border-white/20 rounded-xl px-3 py-1.5 shadow-lg flex items-center justify-between gap-1.5"
              >
                <div className="flex items-center gap-1.5 text-xs font-extrabold tracking-tight tabular-nums whitespace-nowrap">
                  <span className="text-sky-400">LIC {scoreLic}</span>
                  <span className="text-slate-500">-</span>
                  <span className="text-amber-400">AGU {scoreAgu}</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-white">1ST INNING {isTopInning ? '▲' : '▼'}</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-rose-400">{outs} OUTS</span>
                </div>

                {/* Bases Diamond Indicator */}
                <div className="relative w-6 h-6 shrink-0 flex items-center justify-center" aria-label="Bases">
                  <div
                    className={`absolute top-0.5 w-2 h-2 rotate-45 border border-white/60 ${
                      bases[1] ? 'bg-amber-400' : 'bg-slate-800'
                    }`}
                  />
                  <div
                    className={`absolute left-0.5 w-2 h-2 rotate-45 border border-white/60 ${
                      bases[2] ? 'bg-amber-400' : 'bg-slate-800'
                    }`}
                  />
                  <div
                    className={`absolute right-0.5 w-2 h-2 rotate-45 border border-white/60 ${
                      bases[0] ? 'bg-amber-400' : 'bg-slate-800'
                    }`}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveModal('PAUSE');
                }}
                aria-label="PAUSE"
                className="min-w-[44px] min-h-[44px] rounded-xl bg-slate-950/85 hover:bg-slate-800 active:scale-95 border border-white/20 flex items-center justify-center text-white shadow-lg cursor-pointer shrink-0"
              >
                <Pause className="w-5 h-5" />
              </button>
            </header>

            {/* Jugador en Turno Card */}
            <div className="relative z-10 px-3 mt-1 flex items-center justify-between gap-2 pointer-events-none">
              <div className="bg-slate-950/70 backdrop-blur-sm border border-white/15 rounded-lg px-2.5 py-1 text-[11px] text-white flex items-center gap-2">
                <span className="font-bold text-sky-300 truncate max-w-[125px]">
                  Bate: {currentBatter.name}
                </span>
                <span className="text-slate-400">·</span>
                <span className="text-amber-300 tabular-nums">PWR {currentBatter.power}</span>
                <span className="text-emerald-300 tabular-nums">CON {currentBatter.contact}</span>
              </div>

              <div className="bg-slate-950/70 backdrop-blur-sm border border-white/15 rounded-lg px-2.5 py-1 text-[11px] text-slate-200">
                <span>P: {currentPitcher.name}</span>
              </div>
            </div>

            {/* Centro: Anillo de Timing + Letrero "¡SE FUEEE! ¡HÓME RUN!" */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center pointer-events-none px-4">
              {playPhase === 'PITCHING' && isTopInning && (
                <div className="relative flex items-center justify-center">
                  <div
                    className="w-28 h-32 rounded-xl border-2 border-dashed border-white/45 flex items-center justify-center"
                    style={{ marginTop: '48px' }}
                  >
                    <div
                      className={`rounded-full border-4 transition-none ${
                        pitchTimingPct >= 58 && pitchTimingPct <= 88
                          ? 'border-emerald-400 bg-emerald-400/20 shadow-[0_0_20px_rgba(52,211,153,0.8)]'
                          : 'border-amber-300/80 bg-amber-300/10'
                      }`}
                      style={{
                        width: `${Math.max(24, 110 - pitchTimingPct * 0.8)}px`,
                        height: `${Math.max(24, 110 - pitchTimingPct * 0.8)}px`,
                      }}
                    />
                  </div>
                </div>
              )}

              {swipeVector && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  <line
                    x1={swipeVector.x1}
                    y1={swipeVector.y1}
                    x2={swipeVector.x2}
                    y2={swipeVector.y2}
                    stroke="#facc15"
                    strokeWidth="6"
                    strokeLinecap="round"
                  />
                </svg>
              )}

              {bannerText && (
                <div
                  data-testid="play-banner"
                  className={`animate-homerun px-5 py-4 rounded-2xl text-center shadow-2xl border-2 ${
                    isHomeRunBanner
                      ? 'bg-gradient-to-r from-blue-900 via-red-700 to-blue-900 border-amber-300 shadow-[0_0_40px_rgba(250,204,21,0.7)]'
                      : 'bg-slate-950/90 border-white/25'
                  }`}
                >
                  {isHomeRunBanner && (
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <DominicanFlag className="w-8 h-5" />
                      <Sparkles className="w-5 h-5 text-amber-300" />
                      <DominicanFlag className="w-8 h-5" />
                    </div>
                  )}
                  <h2
                    className={`font-display font-extrabold tracking-wide uppercase ${
                      isHomeRunBanner ? 'text-3xl text-amber-300 drop-shadow-[0_3px_0_#000]' : 'text-xl text-white'
                    }`}
                  >
                    {bannerText}
                  </h2>
                  {bannerSubtext && (
                    <p className="text-xs font-semibold text-sky-100 mt-1">{bannerSubtext}</p>
                  )}
                </div>
              )}
            </div>

            {/* Controles Táctiles Abajo: Joystick Izquierdo + Bateo / Botón LANZAR */}
            <div
              onPointerDown={(e) => e.stopPropagation()}
              className="relative z-20 p-3 pb-5 flex items-end justify-between gap-3 pointer-events-auto"
            >
              {/* Joystick virtual pequeño a la izquierda para correr bases */}
              <div className="flex flex-col items-center gap-1">
                <div
                  onPointerDown={() => {
                    setJoystickActive(true);
                    playDataRef.current.runnerBoost = 1.35;
                  }}
                  onPointerMove={handleJoystickMove}
                  onPointerUp={handleJoystickRelease}
                  onPointerCancel={handleJoystickRelease}
                  role="button"
                  tabIndex={0}
                  aria-label="Joystick correr bases"
                  className="w-16 h-16 rounded-full bg-slate-950/75 border-2 border-white/25 flex items-center justify-center relative shadow-lg cursor-pointer touch-none"
                >
                  <div
                    className={`w-7 h-7 rounded-full transition-transform ${
                      joystickActive ? 'bg-amber-400 scale-110' : 'bg-sky-400/90'
                    } shadow-md`}
                    style={{
                      transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)`,
                    }}
                  />
                </div>
                <span className="text-[10px] font-bold text-slate-300 bg-slate-950/70 px-2 py-0.5 rounded">
                  Correr Bases
                </span>
              </div>

              {isTopInning ? (
                /* Controles de Bateo (Swipe Arriba = Potente, Tap = Toque) */
                <div className="flex-1 flex flex-col items-end gap-2">
                  <div className="bg-slate-950/75 backdrop-blur-sm border border-white/15 rounded-xl px-3 py-1.5 text-right">
                    <p className="text-[11px] font-bold text-amber-300">
                      Swipe Arriba = Bateo Potente
                    </p>
                    <p className="text-[10px] text-slate-300">
                      Tap corto = Toque de bola
                    </p>
                  </div>

                  <div className="flex items-center gap-2 w-full justify-end">
                    <button
                      type="button"
                      onClick={() => handleBatterAction('TAP_BUNT')}
                      aria-label="Toque de bola"
                      className="min-h-[48px] px-4 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 active:scale-95 border border-white/25 text-xs font-bold text-white shadow-lg cursor-pointer whitespace-nowrap"
                    >
                      TOQUE
                    </button>

                    <button
                      type="button"
                      onClick={() => handleBatterAction('SWIPE_POWER')}
                      aria-label="Bateo potente"
                      className="flex-1 max-w-[190px] min-h-[52px] px-5 py-3 rounded-2xl bg-gradient-to-b from-blue-500 to-blue-700 hover:from-blue-400 hover:to-blue-600 active:scale-95 border-2 border-sky-300 text-sm font-display font-extrabold tracking-wider text-white shadow-[0_4px_0_#1e3a8a] flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <Zap className="w-4 h-4 text-amber-300 fill-amber-300 shrink-0" />
                      <span>¡SWIPE BATEAR!</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Botón Grande "LANZAR" cuando eres Pitcher en 1ST ▼ */
                <div className="flex-1 flex flex-col items-end gap-2">
                  <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-white/15">
                    <button
                      type="button"
                      onClick={() => setPitchStyle('CURVA')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                        pitchStyle === 'CURVA' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      Curva RD
                    </button>
                    <button
                      type="button"
                      onClick={() => setPitchStyle('RECTA')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                        pitchStyle === 'RECTA' ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      Recta 99mph
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={playPhase !== 'IDLE'}
                    onClick={() => startPitch()}
                    aria-label="LANZAR"
                    className="w-full max-w-[220px] min-h-[58px] py-3.5 px-6 rounded-2xl bg-gradient-to-b from-amber-400 via-amber-500 to-orange-600 hover:from-amber-300 hover:to-orange-500 disabled:opacity-50 active:scale-95 border-2 border-yellow-200 shadow-[0_5px_0_#9a3412] font-display text-xl font-extrabold tracking-wider text-slate-950 flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                  >
                    <Flame className="w-6 h-6 text-red-700 fill-red-600 shrink-0" />
                    <span>¡LANZAR!</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================================
            3. PANTALLA GANASTE / PERDISTE (Fin del 1er Inning)
        ========================================================= */}
        {screen === 'GAME_OVER' && (
          <div
            data-testid="game-over-screen"
            className="absolute inset-0 z-30 bg-slate-950/90 backdrop-blur-md p-5 flex flex-col items-center justify-center text-center"
          >
            <div className="flex items-center gap-3 mb-3">
              <DominicanFlag className="w-11 h-7" />
              <Trophy className="w-10 h-10 text-amber-400" />
              <DominicanFlag className="w-11 h-7" delayMs={300} />
            </div>

            <h2 className="font-display text-4xl font-extrabold italic tracking-wide text-white drop-shadow-[0_3px_0_#1d4ed8]">
              {scoreLic > scoreAgu
                ? '¡GANASTE!'
                : scoreLic < scoreAgu
                ? '¡PERDISTE!'
                : '¡JUEGO EMPATADO!'}
            </h2>
            <p className="text-xs font-semibold text-sky-200 mt-1">
              Final del 1er Inning · Estadio Quisqueya Juan Marichal
            </p>

            <div className="w-full max-w-xs my-5 p-4 rounded-2xl bg-slate-900 border border-white/15 shadow-xl">
              <div className="grid grid-cols-2 gap-4 items-center">
                <div className="flex flex-col items-center p-2.5 rounded-xl bg-blue-950/60 border border-blue-400/30">
                  <span className="text-xs font-bold text-sky-300">AZULES (LIC)</span>
                  <span className="font-display text-4xl font-extrabold text-white tabular-nums mt-1">
                    {scoreLic}
                  </span>
                </div>
                <div className="flex flex-col items-center p-2.5 rounded-xl bg-amber-950/50 border border-amber-400/30">
                  <span className="text-xs font-bold text-amber-300">AMARILLOS (AGU)</span>
                  <span className="font-display text-4xl font-extrabold text-white tabular-nums mt-1">
                    {scoreAgu}
                  </span>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-around text-xs text-slate-300 tabular-nums">
                <span>Jonrones Hoy: {homeRunsThisGame}</span>
                <span>·</span>
                <span>Récord: {highScore} Carreras</span>
              </div>
            </div>

            <div className="w-full max-w-xs flex flex-col gap-3">
              <button
                type="button"
                onClick={handleStartNewGame}
                aria-label="JUGAR DE NUEVO"
                className="w-full min-h-[54px] py-3.5 px-5 rounded-2xl bg-gradient-to-b from-blue-500 to-blue-700 hover:from-blue-400 hover:to-blue-600 active:scale-95 border-2 border-sky-300 font-display text-lg font-extrabold tracking-wider text-white shadow-[0_4px_0_#1e3a8a] flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-5 h-5" />
                <span>JUGAR DE NUEVO</span>
              </button>

              <button
                type="button"
                onClick={handleShareWhatsApp}
                aria-label="COMPARTIR POR WHATSAPP"
                className="w-full min-h-[52px] py-3 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 border-2 border-emerald-300 font-display text-base font-extrabold tracking-wide text-white shadow-lg flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <Share2 className="w-5 h-5" />
                <span>COMPARTIR POR WHATSAPP</span>
              </button>

              <button
                type="button"
                onClick={() => setScreen('COVER')}
                className="w-full min-h-[44px] py-2 text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
              >
                Volver a la Portada
              </button>
            </div>

            {shareCopiedToast && (
              <div
                role="status"
                className="mt-3 px-4 py-2.5 rounded-xl bg-emerald-950 border border-emerald-400 text-xs font-semibold text-emerald-200 flex items-center gap-2"
              >
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Mensaje copiado: &ldquo;¡Le di un jonrón a las Águilas en Béisbol Dominicano 9! Juega aquí...&rdquo;
                </span>
              </div>
            )}
          </div>
        )}

        {/* =========================================================
            4. MODALS (EQUIPO, AJUSTES, TIENDA, PAUSE)
        ========================================================= */}
        {activeModal !== 'NONE' && (
          <div
            role="dialog"
            aria-modal="true"
            className="absolute inset-0 z-40 bg-slate-950/85 backdrop-blur-md p-4 flex flex-col justify-between overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/15">
              <h2 className="font-display text-xl font-extrabold text-white tracking-wide">
                {activeModal === 'EQUIPO' && 'ROSTER DE EQUIPOS (V1)'}
                {activeModal === 'AJUSTES' && 'AJUSTES DEL JUEGO'}
                {activeModal === 'TIENDA' && 'TIENDA QUISQUEYA (VISTA V1)'}
                {activeModal === 'PAUSE' && 'JUEGO EN PAUSA'}
              </h2>
              <button
                type="button"
                onClick={() => setActiveModal('NONE')}
                aria-label="Cerrar ventana"
                className="min-w-[44px] min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal: EQUIPO */}
            {activeModal === 'EQUIPO' && (
              <div className="flex-1 py-3 flex flex-col gap-3 overflow-y-auto">
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-900 rounded-xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => setSelectedTeamTab('LIC')}
                    className={`min-h-[44px] py-2 px-3 rounded-lg text-xs font-extrabold transition-colors cursor-pointer whitespace-nowrap ${
                      selectedTeamTab === 'LIC'
                        ? 'bg-blue-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    AZULES (Licey · 9)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTeamTab('AGU')}
                    className={`min-h-[44px] py-2 px-3 rounded-lg text-xs font-extrabold transition-colors cursor-pointer whitespace-nowrap ${
                      selectedTeamTab === 'AGU'
                        ? 'bg-amber-500 text-slate-950 shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    AMARILLOS (Águilas · 9)
                  </button>
                </div>

                <div className="flex flex-col divide-y divide-white/10 bg-slate-900/70 rounded-2xl border border-white/10 px-3">
                  {TEAMS[selectedTeamTab].players.map((p) => (
                    <div key={p.id} className="py-2.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center font-display font-extrabold text-xs border border-white/30 ${
                            selectedTeamTab === 'LIC'
                              ? 'bg-blue-700 text-white'
                              : 'bg-amber-400 text-slate-950'
                          }`}
                        >
                          #{p.number}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">{p.name}</p>
                          <p className="text-[11px] text-slate-400">
                            {p.position} · {p.apodo}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-xs tabular-nums">
                        <span className="text-amber-300 font-semibold">PWR {p.power}/10</span>
                        <span className="text-emerald-300 font-semibold">CON {p.contact}/10</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Modal: AJUSTES */}
            {activeModal === 'AJUSTES' && (
              <div className="flex-1 py-4 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => setMerengueOn((v) => !v)}
                  className="w-full min-h-[54px] p-3.5 rounded-xl bg-slate-900 border border-white/15 flex items-center justify-between text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    {merengueOn ? (
                      <Volume2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <VolumeX className="w-5 h-5 text-slate-400" />
                    )}
                    <div>
                      <p className="text-sm font-bold text-white">Merengue Dominicano de Fondo</p>
                      <p className="text-xs text-slate-400">Güira, tambora y acordeón bajito</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-sky-400">
                    {merengueOn ? 'ACTIVO' : 'SILENCIO'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSfxOn((v) => !v)}
                  className="w-full min-h-[54px] p-3.5 rounded-xl bg-slate-900 border border-white/15 flex items-center justify-between text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Flame className="w-5 h-5 text-amber-400" />
                    <div>
                      <p className="text-sm font-bold text-white">Bulla del Público y Corneta</p>
                      <p className="text-xs text-slate-400">Efectos de batazo y algarabía en el Quisqueya</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-sky-400">
                    {sfxOn ? 'ACTIVO' : 'SILENCIO'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setHighFpsMode((v) => !v)}
                  className="w-full min-h-[54px] p-3.5 rounded-xl bg-slate-900 border border-white/15 flex items-center justify-between text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Zap className="w-5 h-5 text-sky-400" />
                    <div>
                      <p className="text-sm font-bold text-white">Modo 60 FPS (Tecno Spark 10)</p>
                      <p className="text-xs text-slate-400">Sombras circulares y sprites 2D ultra ligeros</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-400">
                    {highFpsMode ? '60 FPS ON' : 'CALIDAD ALTA'}
                  </span>
                </button>
              </div>
            )}

            {/* Modal: TIENDA (Solo Visual V1) */}
            {activeModal === 'TIENDA' && (
              <div className="flex-1 py-4 flex flex-col gap-3 overflow-y-auto">
                <p className="text-xs text-sky-200 bg-blue-950/70 border border-blue-400/30 rounded-xl p-3">
                  Vista previa de artículos dominicanos (Solo visual en V1 · Sin compras con dinero real).
                </p>

                <div className="grid grid-cols-1 gap-2.5">
                  {SHOP_ITEMS_PREVIEW.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl bg-slate-900 border border-white/15 flex items-center justify-between gap-3"
                    >
                      <div>
                        <p className="text-sm font-bold text-white">{item.name}</p>
                        <p className="text-xs text-amber-300 mt-0.5">{item.bonus}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{item.category}</p>
                      </div>
                      <span className="text-xs font-bold text-slate-300 whitespace-nowrap">
                        {item.tag}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Modal: PAUSE */}
            {activeModal === 'PAUSE' && (
              <div className="flex-1 py-6 flex flex-col items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveModal('NONE')}
                  className="w-full max-w-xs min-h-[52px] py-3 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 font-display text-base font-extrabold text-white flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Play className="w-5 h-5" />
                  <span>CONTINUAR PARTIDO</span>
                </button>

                {isTopInning && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveModal('NONE');
                      setOuts(0);
                      setBases([false, false, false]);
                      setIsTopInning(false);
                      playDataRef.current.isTopInning = false;
                      playDataRef.current.state = 'IDLE';
                      setPlayPhase('IDLE');
                    }}
                    className="w-full max-w-xs min-h-[48px] py-2.5 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 font-display text-sm font-extrabold text-slate-950 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                    <span>CAMBIAR A MODO PITCHER (1ST ▼)</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleStartNewGame}
                  className="w-full max-w-xs min-h-[48px] py-2.5 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-5 h-5" />
                  <span>REINICIAR INNING</span>
                </button>

                <button
                  type="button"
                  onClick={handleShareWhatsApp}
                  className="w-full max-w-xs min-h-[48px] py-2.5 px-5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-xs font-bold text-white flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  <span>COMPARTIR POR WHATSAPP</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveModal('NONE');
                    setScreen('COVER');
                  }}
                  className="w-full max-w-xs min-h-[44px] py-2 text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
                >
                  Salir a la Portada
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setActiveModal('NONE')}
              className="w-full min-h-[48px] py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-extrabold text-white cursor-pointer"
            >
              VOLVER
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
