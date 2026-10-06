import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export type PlayState =
  | 'IDLE'          // Waiting to pitch
  | 'PITCHING'      // Ball in flight from pitcher to home plate
  | 'BALL_IN_PLAY'  // Ball hit into field, camera following ball, runners moving
  | 'RESULT_PAUSE'; // Brief call/celebration before resetting

export type HitType = 'NONE' | 'STRIKE' | 'BUNT' | 'ROLLING' | 'FLY' | 'LINE_DRIVE' | 'HOME_RUN';

export interface ActivePlayData {
  state: PlayState;
  isTopInning: boolean;
  pitchProgress: number; // 0 to 1
  pitchCurveX: number;   // -1 to 1 curve amount
  hitType: HitType;
  hitProgress: number;   // 0 to 1
  hitTarget: { x: number; y: number; z: number };
  bases: [boolean, boolean, boolean];
  runnerBoost: number;
  batterSkin: string;
  pitcherSkin: string;
}

interface Stadium3DProps {
  playDataRef: React.MutableRefObject<ActivePlayData>;
  highFpsMode: boolean;
}

const STADIUM_BG_URL = '/src/assets/images/estadio_quisqueya_360_1791291140471.jpg';

const HOME_POS = new THREE.Vector3(0, 0, 13.5);
const MOUND_POS = new THREE.Vector3(0, 0.22, 2.0);
const BASE_1_POS = new THREE.Vector3(11.5, 0, 2.0);
const BASE_2_POS = new THREE.Vector3(0, 0, -9.5);
const BASE_3_POS = new THREE.Vector3(-11.5, 0, 2.0);

function createQuisqueyaSignTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#0f2557';
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, 504, 120);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ESTADIO QUISQUEYA', 256, 52);

    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('JUAN MARICHAL • ¡ARRIBA LICEY!', 256, 96);
  }
  return new THREE.CanvasTexture(canvas);
}

function createChibiPlayer(
  uniformColorHex: number,
  capColorHex: number,
  skinHexStr: string,
  hasBat: boolean,
  isCatcher = false
): THREE.Group {
  const group = new THREE.Group();

  // 1. Mandatory Black Circle Shadow (Zero real shadows for 60fps on mobile)
  const shadowGeo = new THREE.CircleGeometry(0.68, 16);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  group.add(shadow);

  // 2. Legs / Pants (White baseball pants with team socks)
  const pantMat = new THREE.MeshLambertMaterial({ color: 0xf8fafc });
  const sockMat = new THREE.MeshLambertMaterial({ color: uniformColorHex });

  const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.48, 8), pantMat);
  leftLeg.position.set(-0.2, 0.24, 0);
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.48, 8), pantMat);
  rightLeg.position.set(0.2, 0.24, 0);
  group.add(rightLeg);

  const leftCleat = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.34), sockMat);
  leftCleat.position.set(-0.2, 0.07, 0.05);
  group.add(leftCleat);

  const rightCleat = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.34), sockMat);
  rightCleat.position.set(0.2, 0.07, 0.05);
  group.add(rightCleat);

  // 3. Chibi Torso (Compact jersey)
  const jerseyMat = new THREE.MeshLambertMaterial({ color: uniformColorHex });
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.36, 0.72, 10), jerseyMat);
  torso.position.y = 0.78;
  group.add(torso);

  if (isCatcher) {
    const chestProtector = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 0.62, 0.22),
      new THREE.MeshLambertMaterial({ color: 0x0f172a })
    );
    chestProtector.position.set(0, 0.78, 0.32);
    group.add(chestProtector);
  }

  // 4. Big Expressive Chibi Head (Baseball 9 style)
  const skinMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(skinHexStr) });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.58, 14, 12), skinMat);
  head.position.y = 1.56;
  group.add(head);

  // Big Chibi Eyes
  const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x111827 });

  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), pupilMat);
  leftEye.position.set(-0.2, 1.56, 0.51);
  group.add(leftEye);

  const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), pupilMat);
  rightEye.position.set(0.2, 1.56, 0.51);
  group.add(rightEye);

  const leftHighlight = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), eyeWhiteMat);
  leftHighlight.position.set(-0.17, 1.6, 0.59);
  group.add(leftHighlight);

  const rightHighlight = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), eyeWhiteMat);
  rightHighlight.position.set(0.23, 1.6, 0.59);
  group.add(rightHighlight);

  // 5. Baseball Cap + Visor
  const capMat = new THREE.MeshLambertMaterial({ color: capColorHex });
  const capDome = new THREE.Mesh(
    new THREE.SphereGeometry(0.6, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
    capMat
  );
  capDome.position.y = 1.6;
  group.add(capDome);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.08, 0.45), capMat);
  visor.position.set(0, 1.72, 0.48);
  visor.rotation.x = 0.12;
  group.add(visor);

  // 6. Arms & Bat / Glove
  const armPivot = new THREE.Group();
  armPivot.name = 'armPivot';
  armPivot.position.set(0, 0.98, 0);

  const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.11, 0.48, 8), jerseyMat);
  leftArm.position.set(-0.48, -0.1, 0.15);
  leftArm.rotation.z = 0.35;
  armPivot.add(leftArm);

  const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.11, 0.48, 8), jerseyMat);
  rightArm.position.set(0.48, -0.1, 0.15);
  rightArm.rotation.z = -0.35;
  armPivot.add(rightArm);

  if (hasBat) {
    const batGroup = new THREE.Group();
    batGroup.name = 'batGroup';
    const batWoodMat = new THREE.MeshLambertMaterial({ color: 0xd97706 });
    const batMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.045, 1.45, 8), batWoodMat);
    batMesh.position.set(0.55, 0.45, 0.25);
    batMesh.rotation.z = -0.45;
    batMesh.rotation.x = 0.25;
    batGroup.add(batMesh);
    armPivot.add(batGroup);
  } else {
    const gloveMat = new THREE.MeshLambertMaterial({ color: 0x78350f });
    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.21, 8, 8), gloveMat);
    glove.position.set(-0.56, -0.25, 0.28);
    armPivot.add(glove);
  }

  group.add(armPivot);
  return group;
}

function createCrowdSpriteTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const colors = ['#1d4ed8', '#eab308', '#ef4444', '#ffffff'];
    const c1 = colors[Math.floor(Math.random() * colors.length)];
    ctx.fillStyle = c1;
    ctx.beginPath();
    ctx.arc(32, 46, 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#8d5524';
    ctx.beginPath();
    ctx.arc(32, 22, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#002D62';
    ctx.fillRect(20, 8, 24, 7);
  }
  return new THREE.CanvasTexture(canvas);
}

export const Stadium3D: React.FC<Stadium3DProps> = ({ playDataRef, highFpsMode }) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isWebDriver = typeof navigator !== 'undefined' && navigator.webdriver === true;
    const width = container.clientWidth || 390;
    const height = container.clientHeight || 844;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x38bdf8);
    scene.fog = new THREE.FogExp2(0x7dd3fc, 0.0045);

    // Behind the Pitcher View (Baseball 9 angle looking toward Home Plate)
    const camera = new THREE.PerspectiveCamera(52, width / height, 0.5, 220);
    const defaultCamPos = new THREE.Vector3(0, 4.1, -4.2);
    const defaultLookAt = new THREE.Vector3(0, 1.35, 13.8);
    camera.position.copy(defaultCamPos);
    camera.lookAt(defaultLookAt);

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isWebDriver && !highFpsMode,
        powerPreference: 'high-performance',
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(isWebDriver || highFpsMode ? 1 : Math.min(window.devicePixelRatio, 1.75));
      renderer.shadowMap.enabled = false;
      container.innerHTML = '';
      container.appendChild(renderer.domElement);
    } catch {
      // 2D Canvas Fallback
      const fallbackCanvas = document.createElement('canvas');
      fallbackCanvas.width = width;
      fallbackCanvas.height = height;
      fallbackCanvas.style.width = '100%';
      fallbackCanvas.style.height = '100%';
      container.innerHTML = '';
      container.appendChild(fallbackCanvas);
      const ctx = fallbackCanvas.getContext('2d');
      let fallbackAnim = 0;
      const drawFallback = () => {
        fallbackAnim = requestAnimationFrame(drawFallback);
        if (!ctx) return;
        const pd = playDataRef.current;
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(0, 0, width, height * 0.38);
        ctx.fillStyle = '#16a34a';
        ctx.fillRect(0, height * 0.38, width, height * 0.62);
        ctx.fillStyle = '#b45309';
        ctx.beginPath();
        ctx.arc(width / 2, height * 0.68, 70, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 2;
        ctx.strokeRect(width / 2 - 36, height * 0.5 - 45, 72, 90);
        const ballY =
          pd.state === 'PITCHING'
            ? height * 0.75 - pd.pitchProgress * (height * 0.25)
            : pd.state === 'BALL_IN_PLAY'
            ? height * 0.5 - pd.hitProgress * (height * 0.3)
            : height * 0.75;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(width / 2, ballY, 9, 0, Math.PI * 2);
        ctx.fill();
      };
      drawFallback();
      return () => cancelAnimationFrame(fallbackAnim);
    }

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 0.9);
    sunLight.position.set(15, 35, 20);
    scene.add(sunLight);

    // 1. Outfield & Infield Grass
    const grassGeo = new THREE.CircleGeometry(65, 32);
    const grassMat = new THREE.MeshLambertMaterial({ color: 0x16a34a });
    const grass = new THREE.Mesh(grassGeo, grassMat);
    grass.rotation.x = -Math.PI / 2;
    scene.add(grass);

    for (let r = 8; r < 48; r += 8) {
      const ringGeo = new THREE.RingGeometry(r, r + 4, 28);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x22c55e, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.01;
      scene.add(ring);
    }

    // 2. Dirt Infield Diamond & Home Plate
    const dirtMat = new THREE.MeshLambertMaterial({ color: 0xb45309 });
    const diamondGeo = new THREE.PlaneGeometry(24, 24);
    const diamond = new THREE.Mesh(diamondGeo, dirtMat);
    diamond.rotation.x = -Math.PI / 2;
    diamond.rotation.z = Math.PI / 4;
    diamond.position.set(0, 0.02, 2.0);
    scene.add(diamond);

    const infieldGrassGeo = new THREE.PlaneGeometry(15.5, 15.5);
    const infieldGrass = new THREE.Mesh(infieldGrassGeo, grassMat);
    infieldGrass.rotation.x = -Math.PI / 2;
    infieldGrass.rotation.z = Math.PI / 4;
    infieldGrass.position.set(0, 0.03, 2.0);
    scene.add(infieldGrass);

    const homeDirt = new THREE.Mesh(new THREE.CircleGeometry(4.2, 20), dirtMat);
    homeDirt.rotation.x = -Math.PI / 2;
    homeDirt.position.set(0, 0.035, 13.5);
    scene.add(homeDirt);

    const moundDirt = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.6, 0.24, 18), dirtMat);
    moundDirt.position.set(0, 0.12, 2.0);
    scene.add(moundDirt);

    const whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pitcherRubber = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.22), whiteMat);
    pitcherRubber.position.set(0, 0.25, 2.0);
    scene.add(pitcherRubber);

    const homePlate = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.04, 5), whiteMat);
    homePlate.position.set(0, 0.05, 13.5);
    scene.add(homePlate);

    const boxOutlineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const leftBatterBox = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.85, 4), boxOutlineMat);
    leftBatterBox.rotation.x = -Math.PI / 2;
    leftBatterBox.rotation.z = Math.PI / 4;
    leftBatterBox.position.set(-1.25, 0.05, 13.5);
    scene.add(leftBatterBox);

    const rightBatterBox = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.85, 4), boxOutlineMat);
    rightBatterBox.rotation.x = -Math.PI / 2;
    rightBatterBox.rotation.z = Math.PI / 4;
    rightBatterBox.position.set(1.25, 0.05, 13.5);
    scene.add(rightBatterBox);

    [BASE_1_POS, BASE_2_POS, BASE_3_POS].forEach((pos) => {
      const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.1, 0.75), whiteMat);
      baseMesh.position.set(pos.x, 0.07, pos.z);
      baseMesh.rotation.y = Math.PI / 4;
      scene.add(baseMesh);
    });

    // 3. Outfield Wall & 360 Quisqueya Backdrop
    const wallGeo = new THREE.CylinderGeometry(44, 44, 4.2, 36, 1, true);
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x1e3a8a, side: THREE.DoubleSide });
    const outfieldWall = new THREE.Mesh(wallGeo, wallMat);
    outfieldWall.position.set(0, 2.1, 0);
    scene.add(outfieldWall);

    const wallTop = new THREE.Mesh(
      new THREE.CylinderGeometry(43.9, 43.9, 0.35, 36, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide })
    );
    wallTop.position.set(0, 4.15, 0);
    scene.add(wallTop);

    // Sign boards
    const signTex = createQuisqueyaSignTexture();
    const signMat = new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide });
    const backstopSign = new THREE.Mesh(new THREE.PlaneGeometry(16, 4), signMat);
    backstopSign.position.set(0, 6.2, 42.5);
    backstopSign.rotation.y = Math.PI;
    scene.add(backstopSign);

    const centerFieldSign = new THREE.Mesh(new THREE.PlaneGeometry(18, 4.5), signMat);
    centerFieldSign.position.set(0, 6.5, -42.5);
    scene.add(centerFieldSign);

    // 360 Skybox Cylinder
    const skyGeo = new THREE.CylinderGeometry(58, 58, 34, 40, 1, true);
    const skyMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide });
    const skyCylinder = new THREE.Mesh(skyGeo, skyMat);
    skyCylinder.position.set(0, 14, 0);
    scene.add(skyCylinder);

    const texLoader = new THREE.TextureLoader();
    texLoader.load(
      STADIUM_BG_URL,
      (tex) => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.repeat.set(3, 1);
        skyMat.map = tex;
        skyMat.needsUpdate = true;
      },
      undefined,
      () => {
        skyMat.color.setHex(0x1e40af);
      }
    );

    // 4. 2D Crowd Sprites (Optimization: sprites 2D)
    const crowdSprites: THREE.Sprite[] = [];
    const spriteTex = createCrowdSpriteTexture();
    const spriteMat = new THREE.SpriteMaterial({ map: spriteTex });
    const numSprites = isWebDriver ? 18 : 36;
    for (let i = 0; i < numSprites; i++) {
      const angle = (i / numSprites) * Math.PI * 2;
      const radius = 46 + (i % 3) * 1.8;
      const sprite = new THREE.Sprite(spriteMat);
      sprite.position.set(Math.cos(angle) * radius, 5.2 + (i % 3) * 1.1, Math.sin(angle) * radius);
      sprite.scale.set(2.4, 2.4, 1);
      scene.add(sprite);
      crowdSprites.push(sprite);
    }

    // 5. Strike Zone box
    const strikeZoneGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(1.15, 1.35));
    const strikeZoneMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 });
    const strikeZone = new THREE.LineSegments(strikeZoneGeo, strikeZoneMat);
    strikeZone.position.set(0, 1.35, 13.4);
    scene.add(strikeZone);

    // 6. Ball + Shadow
    const ballGroup = new THREE.Group();
    const ballMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.19, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    ballGroup.add(ballMesh);

    const ballShadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.24, 12),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 })
    );
    ballShadow.rotation.x = -Math.PI / 2;
    ballShadow.position.y = 0.03;
    scene.add(ballShadow);
    scene.add(ballGroup);

    // 7. Chibi Players
    let currentTopInning = playDataRef.current.isTopInning;
    const actorsGroup = new THREE.Group();
    scene.add(actorsGroup);

    let pitcherMesh: THREE.Group;
    let batterMesh: THREE.Group;
    let catcherMesh: THREE.Group;
    let fielders: THREE.Group[] = [];
    let runnerMeshes: THREE.Group[] = [];

    const buildPlayersForHalfInning = (isTop: boolean) => {
      while (actorsGroup.children.length > 0) {
        actorsGroup.remove(actorsGroup.children[0]);
      }
      fielders = [];
      runnerMeshes = [];

      const battingColor = isTop ? 0x1d4ed8 : 0xeab308;
      const battingCap = isTop ? 0x1e3a8a : 0xca8a04;
      const fieldingColor = isTop ? 0xeab308 : 0x1d4ed8;
      const fieldingCap = isTop ? 0xca8a04 : 0x1e3a8a;

      pitcherMesh = createChibiPlayer(fieldingColor, fieldingCap, playDataRef.current.pitcherSkin, false);
      pitcherMesh.position.copy(MOUND_POS);
      actorsGroup.add(pitcherMesh);

      batterMesh = createChibiPlayer(battingColor, battingCap, playDataRef.current.batterSkin, true);
      batterMesh.position.set(-1.15, 0, 13.5);
      batterMesh.rotation.y = Math.PI * 0.35;
      actorsGroup.add(batterMesh);

      catcherMesh = createChibiPlayer(fieldingColor, fieldingCap, '#8d5524', false, true);
      catcherMesh.position.set(0, -0.15, 15.3);
      catcherMesh.scale.set(1, 0.85, 1);
      catcherMesh.rotation.y = Math.PI;
      actorsGroup.add(catcherMesh);

      const fielderCoords = [
        new THREE.Vector3(10.5, 0, 0.5),    // 1B
        new THREE.Vector3(5.8, 0, -8.5),    // 2B
        new THREE.Vector3(-5.8, 0, -8.5),   // SS
        new THREE.Vector3(-10.5, 0, 0.5),   // 3B
        new THREE.Vector3(-16.0, 0, -22.0), // LF
        new THREE.Vector3(0, 0, -26.0),     // CF
        new THREE.Vector3(16.0, 0, -22.0),  // RF
      ];

      fielderCoords.forEach((fPos) => {
        const f = createChibiPlayer(fieldingColor, fieldingCap, '#7a4b2a', false);
        f.position.copy(fPos);
        f.lookAt(HOME_POS.x, 0, HOME_POS.z);
        actorsGroup.add(f);
        fielders.push(f);
      });

      for (let r = 0; r < 4; r++) {
        const runner = createChibiPlayer(battingColor, battingCap, '#8d5524', false);
        runner.visible = false;
        actorsGroup.add(runner);
        runnerMeshes.push(runner);
      }
    };

    buildPlayersForHalfInning(currentTopInning);

    const handleResize = () => {
      if (!container || !renderer) return;
      const w = container.clientWidth || 390;
      const h = container.clientHeight || 844;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    let animId = 0;
    let clock = 0;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      clock += 0.05;

      const pd = playDataRef.current;

      if (pd.isTopInning !== currentTopInning) {
        currentTopInning = pd.isTopInning;
        buildPlayersForHalfInning(currentTopInning);
      }

      crowdSprites.forEach((sp, idx) => {
        sp.position.y = 5.2 + (idx % 3) * 1.1 + Math.sin(clock * 2 + idx) * 0.16;
      });

      const baseCoords = [BASE_1_POS, BASE_2_POS, BASE_3_POS, HOME_POS];
      if (pd.state !== 'BALL_IN_PLAY') {
        for (let b = 0; b < 3; b++) {
          if (runnerMeshes[b]) {
            runnerMeshes[b].visible = pd.bases[b];
            runnerMeshes[b].position.copy(baseCoords[b]);
            runnerMeshes[b].lookAt(baseCoords[(b + 1) % 4]);
          }
        }
        if (runnerMeshes[3]) runnerMeshes[3].visible = false;
      }

      if (pd.state === 'IDLE') {
        ballGroup.position.set(0.35, 1.25, 2.3);
        ballShadow.position.set(0.35, 0.03, 2.3);

        camera.position.lerp(defaultCamPos, 0.12);
        camera.lookAt(defaultLookAt);

        if (batterMesh) {
          batterMesh.visible = true;
          const armPivot = batterMesh.getObjectByName('armPivot');
          if (armPivot) armPivot.rotation.y = Math.sin(clock * 1.5) * 0.08;
        }
        if (pitcherMesh) pitcherMesh.rotation.x = 0;
      } else if (pd.state === 'PITCHING') {
        const t = pd.pitchProgress;
        if (pitcherMesh) {
          pitcherMesh.rotation.x = Math.sin(t * Math.PI) * 0.25;
        }

        const curveX = Math.sin(t * Math.PI) * pd.pitchCurveX * 1.1;
        const arcY = 1.45 - t * 0.22 + Math.sin(t * Math.PI) * 0.35;
        const posZ = 2.4 + t * (13.6 - 2.4);

        ballGroup.position.set(curveX, arcY, posZ);
        ballShadow.position.set(curveX, 0.03, posZ);

        camera.position.lerp(defaultCamPos, 0.15);
        camera.lookAt(defaultLookAt);
      } else if (pd.state === 'BALL_IN_PLAY') {
        const t = Math.min(1, pd.hitProgress);

        if (batterMesh) {
          const armPivot = batterMesh.getObjectByName('armPivot');
          if (armPivot) armPivot.rotation.y = -Math.min(1, t * 5) * 2.2;
        }

        const startX = 0;
        const startY = 1.2;
        const startZ = 13.5;

        const curX = startX + (pd.hitTarget.x - startX) * t;
        const curZ = startZ + (pd.hitTarget.z - startZ) * t;
        let curY = 0.2;

        if (pd.hitType === 'HOME_RUN') {
          curY = startY + Math.sin(t * Math.PI) * 18.0 + t * 4.5;
        } else if (pd.hitType === 'FLY') {
          curY = Math.max(0.2, startY * (1 - t) + Math.sin(t * Math.PI) * 10.5);
        } else if (pd.hitType === 'LINE_DRIVE') {
          curY = Math.max(0.2, startY * (1 - t) + Math.sin(t * Math.PI) * 4.2);
        } else if (pd.hitType === 'ROLLING') {
          curY = 0.2 + Math.abs(Math.sin(t * Math.PI * 4)) * (1 - t) * 1.1;
        } else if (pd.hitType === 'BUNT') {
          curY = 0.2 + Math.abs(Math.sin(t * Math.PI * 2)) * (1 - t) * 0.45;
        }

        ballGroup.position.set(curX, curY, curZ);
        ballShadow.position.set(curX, 0.03, curZ);

        // Smooth camera follow
        const followCamTarget = new THREE.Vector3(
          curX * 0.35,
          Math.max(4.8, curY * 0.55 + 4.2),
          Math.min(19.5, curZ + 14.0)
        );
        camera.position.lerp(followCamTarget, 0.08);
        camera.lookAt(curX * 0.7, Math.max(0.8, curY * 0.6), curZ);

        // Runners advance
        const runT = Math.min(1, t * 1.15 * pd.runnerBoost);
        if (runnerMeshes[3]) {
          runnerMeshes[3].visible = true;
          runnerMeshes[3].position.lerpVectors(HOME_POS, BASE_1_POS, runT);
          runnerMeshes[3].position.y = Math.abs(Math.sin(clock * 4)) * 0.18;
          runnerMeshes[3].lookAt(BASE_1_POS);
        }
        for (let b = 0; b < 3; b++) {
          if (runnerMeshes[b] && pd.bases[b]) {
            runnerMeshes[b].visible = true;
            runnerMeshes[b].position.lerpVectors(baseCoords[b], baseCoords[(b + 1) % 4], runT);
            runnerMeshes[b].position.y = Math.abs(Math.sin(clock * 4 + b)) * 0.18;
            runnerMeshes[b].lookAt(baseCoords[(b + 1) % 4]);
          }
        }

        if (pd.hitType !== 'HOME_RUN' && fielders.length > 0) {
          let closest = fielders[0];
          let minDist = 999;
          fielders.forEach((f) => {
            const d = f.position.distanceTo(new THREE.Vector3(pd.hitTarget.x, 0, pd.hitTarget.z));
            if (d < minDist) {
              minDist = d;
              closest = f;
            }
          });
          closest.position.lerp(new THREE.Vector3(pd.hitTarget.x, 0, pd.hitTarget.z), 0.04);
        }
      }

      renderer?.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      if (renderer) renderer.dispose();
    };
  }, [highFpsMode, playDataRef]);

  return (
    <div
      ref={mountRef}
      data-testid="stadium-3d-canvas"
      className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none"
    />
  );
};
