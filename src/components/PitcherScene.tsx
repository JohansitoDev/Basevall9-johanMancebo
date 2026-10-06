import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';
import { pitchAudio } from '../utils/audio';

export type PitchType = 'FASTBALL' | 'CURVEBALL';
export type CameraView = 'BEHIND_PITCHER' | 'BATTER_POV' | 'BROADCAST';

export interface PitchResult {
  id: string;
  type: PitchType;
  speedMph: number;
  breakInches: number;
  isStrike: boolean;
  targetX: number;
  targetY: number;
  timestamp: Date;
}

export interface PitcherSceneHandle {
  triggerPitch: (forcedType?: PitchType) => void;
  setCameraView: (view: CameraView) => void;
}

interface PitcherSceneProps {
  onPitchStart?: (type: PitchType, speedMph: number) => void;
  onPitchComplete?: (result: PitchResult) => void;
  showTrail?: boolean;
}

// 3D coordinates
const MOUND_POS = new THREE.Vector3(0, 0.28, -6.5);
const HOME_POS = new THREE.Vector3(0, 0.05, 12.5);
const STRIKE_ZONE_Z = 12.5;

export const PitcherScene = forwardRef<PitcherSceneHandle, PitcherSceneProps>(({
  onPitchStart,
  onPitchComplete,
  showTrail = true,
}, ref) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const isPitchingRef = useRef(false);
  const sceneContextRef = useRef<{
    triggerPitch: (forcedType?: PitchType) => void;
    setCameraView: (view: CameraView) => void;
  } | null>(null);

  const [activeCam, setActiveCam] = useState<CameraView>('BEHIND_PITCHER');

  useImperativeHandle(ref, () => ({
    triggerPitch: (forcedType?: PitchType) => {
      sceneContextRef.current?.triggerPitch(forcedType);
    },
    setCameraView: (view: CameraView) => {
      setActiveCam(view);
      sceneContextRef.current?.setCameraView(view);
    },
  }));

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Scene & Lighting
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x38bdf8); // Dominican sunny Caribbean sky
    scene.fog = new THREE.FogExp2(0x7dd3fc, 0.005);

    // 2. Camera Setup
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.2, 300);

    const camTargets: Record<CameraView, { pos: THREE.Vector3; lookAt: THREE.Vector3 }> = {
      BEHIND_PITCHER: {
        pos: new THREE.Vector3(0, 3.4, -13.0),
        lookAt: new THREE.Vector3(0, 1.4, 12.5),
      },
      BATTER_POV: {
        pos: new THREE.Vector3(0, 1.6, 14.8),
        lookAt: new THREE.Vector3(0, 1.5, -6.5),
      },
      BROADCAST: {
        pos: new THREE.Vector3(12.5, 4.8, 3.0),
        lookAt: new THREE.Vector3(0, 1.2, 3.0),
      },
    };

    let currentCamView: CameraView = 'BEHIND_PITCHER';
    const targetCamPos = camTargets.BEHIND_PITCHER.pos.clone();
    const targetCamLookAt = camTargets.BEHIND_PITCHER.lookAt.clone();
    const currentCamLookAt = camTargets.BEHIND_PITCHER.lookAt.clone();

    camera.position.copy(targetCamPos);
    camera.lookAt(targetCamLookAt);

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = false; // Zero real shadowmaps for high performance
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.88);
    scene.add(ambientLight);

    const sun = new THREE.DirectionalLight(0xfffbeb, 0.95);
    sun.position.set(20, 45, 15);
    scene.add(sun);

    // 4. Ground: Turf, Infield Diamond & Dirt Mound
    const grassGeo = new THREE.CircleGeometry(65, 36);
    const grassMat = new THREE.MeshLambertMaterial({ color: 0x15803d });
    const grass = new THREE.Mesh(grassGeo, grassMat);
    grass.rotation.x = -Math.PI / 2;
    scene.add(grass);

    // Mowed turf circular stripes
    for (let r = 8; r < 55; r += 7) {
      const ringGeo = new THREE.RingGeometry(r, r + 3.5, 32);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x16a34a, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.01;
      scene.add(ring);
    }

    // Dirt Infield Clay Diamond
    const dirtMat = new THREE.MeshLambertMaterial({ color: 0xb45309 });
    const diamondGeo = new THREE.PlaneGeometry(25, 25);
    const diamond = new THREE.Mesh(diamondGeo, dirtMat);
    diamond.rotation.x = -Math.PI / 2;
    diamond.rotation.z = Math.PI / 4;
    diamond.position.set(0, 0.02, 3.0);
    scene.add(diamond);

    // Clay Pitcher's Mound (Elevated circle)
    const moundGeo = new THREE.CylinderGeometry(2.4, 3.2, 0.32, 24);
    const mound = new THREE.Mesh(moundGeo, dirtMat);
    mound.position.set(MOUND_POS.x, 0.16, MOUND_POS.z);
    scene.add(mound);

    // Pitcher's Rubber (White rectangular plate on top of mound)
    const whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const rubber = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.05, 0.22), whiteMat);
    rubber.position.set(MOUND_POS.x, 0.33, MOUND_POS.z);
    scene.add(rubber);

    // Home Plate Dirt Circle & White 5-sided Plate
    const homeDirt = new THREE.Mesh(new THREE.CircleGeometry(4.2, 24), dirtMat);
    homeDirt.rotation.x = -Math.PI / 2;
    homeDirt.position.set(HOME_POS.x, 0.03, HOME_POS.z);
    scene.add(homeDirt);

    const plateGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.05, 5);
    const homePlate = new THREE.Mesh(plateGeo, whiteMat);
    homePlate.position.set(HOME_POS.x, 0.06, HOME_POS.z);
    scene.add(homePlate);

    // Left and Right Batter's Boxes chalk outlines
    [-1.2, 1.2].forEach((xOffset) => {
      const boxRing = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.8, 4), whiteMat);
      boxRing.rotation.x = -Math.PI / 2;
      boxRing.rotation.z = Math.PI / 4;
      boxRing.position.set(xOffset, 0.05, HOME_POS.z);
      scene.add(boxRing);
    });

    // 5. Strike Zone 3D Wireframe Box (17" wide, approx 0.8m x 1.0m at home plate)
    const szGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(0.85, 1.05, 0.1));
    const szMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.8,
    });
    const strikeZoneBox = new THREE.LineSegments(szGeo, szMat);
    strikeZoneBox.position.set(0, 1.45, STRIKE_ZONE_Z);
    scene.add(strikeZoneBox);

    // 3x3 Grid lines inside strike zone
    const gridLinesMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.35 });
    const gridGeo = new THREE.BufferGeometry();
    const gridPoints: number[] = [
      // vertical lines
      -0.28, 0.92, STRIKE_ZONE_Z, -0.28, 1.98, STRIKE_ZONE_Z,
      0.28, 0.92, STRIKE_ZONE_Z, 0.28, 1.98, STRIKE_ZONE_Z,
      // horizontal lines
      -0.42, 1.27, STRIKE_ZONE_Z, 0.42, 1.27, STRIKE_ZONE_Z,
      -0.42, 1.62, STRIKE_ZONE_Z, 0.42, 1.62, STRIKE_ZONE_Z,
    ];
    gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(gridPoints, 3));
    const gridSegments = new THREE.LineSegments(gridGeo, gridLinesMat);
    scene.add(gridSegments);

    // Pitch Arrival Impact Marker (shows where the ball passed through)
    const impactMarkerMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0,
    });
    const impactMarker = new THREE.Mesh(new THREE.RingGeometry(0.08, 0.15, 16), impactMarkerMat);
    impactMarker.position.set(0, 1.45, STRIKE_ZONE_Z + 0.05);
    scene.add(impactMarker);

    // 6. Stadium Walls & Estadio Quisqueya Signage
    const wallGeo = new THREE.CylinderGeometry(48, 48, 4.5, 36, 1, true);
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x1e3a8a, side: THREE.DoubleSide });
    const outfieldWall = new THREE.Mesh(wallGeo, wallMat);
    outfieldWall.position.set(0, 2.25, 0);
    scene.add(outfieldWall);

    const wallYellowPad = new THREE.Mesh(
      new THREE.CylinderGeometry(47.9, 47.9, 0.35, 36, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide })
    );
    wallYellowPad.position.set(0, 4.35, 0);
    scene.add(wallYellowPad);

    // Sign canvas texture
    const signCanvas = document.createElement('canvas');
    signCanvas.width = 512;
    signCanvas.height = 128;
    const sCtx = signCanvas.getContext('2d');
    if (sCtx) {
      sCtx.fillStyle = '#0f2557';
      sCtx.fillRect(0, 0, 512, 128);
      sCtx.strokeStyle = '#facc15';
      sCtx.lineWidth = 6;
      sCtx.strokeRect(4, 4, 504, 120);

      sCtx.fillStyle = '#ffffff';
      sCtx.font = 'bold 32px sans-serif';
      sCtx.textAlign = 'center';
      sCtx.fillText('ESTADIO QUISQUEYA', 256, 52);

      sCtx.fillStyle = '#facc15';
      sCtx.font = 'bold 24px sans-serif';
      sCtx.fillText('JUAN MARICHAL • LA PARA 34', 256, 96);
    }
    const signTex = new THREE.CanvasTexture(signCanvas);
    const signBoard = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 4),
      new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide })
    );
    signBoard.position.set(0, 6.2, -47.0);
    scene.add(signBoard);

    // 7. Chibi Dominican Pitcher Model on the Mound
    const pitcherGroup = new THREE.Group();
    pitcherGroup.position.set(MOUND_POS.x, MOUND_POS.y + 0.05, MOUND_POS.z);
    scene.add(pitcherGroup);

    // Ground circular shadow (Lightweight optimization)
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    const pitcherShadow = new THREE.Mesh(new THREE.CircleGeometry(0.75, 16), shadowMat);
    pitcherShadow.rotation.x = -Math.PI / 2;
    pitcherShadow.position.y = 0.02;
    pitcherGroup.add(pitcherShadow);

    // Pitcher Pants & Cleats
    const pantMat = new THREE.MeshLambertMaterial({ color: 0xf8fafc });
    const blueMat = new THREE.MeshLambertMaterial({ color: 0x1d4ed8 });

    const legLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.52, 10), pantMat);
    legLeft.position.set(-0.22, 0.26, 0);
    pitcherGroup.add(legLeft);

    const legRight = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.52, 10), pantMat);
    legRight.position.set(0.22, 0.26, 0);
    pitcherGroup.add(legRight);

    const cleatLeft = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.14, 0.38), blueMat);
    cleatLeft.position.set(-0.22, 0.07, 0.06);
    pitcherGroup.add(cleatLeft);

    const cleatRight = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.14, 0.38), blueMat);
    cleatRight.position.set(0.22, 0.07, 0.06);
    pitcherGroup.add(cleatRight);

    // Pitcher Torso (Licey Royal Blue Jersey #34)
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.38, 0.76, 12), blueMat);
    torso.position.y = 0.84;
    pitcherGroup.add(torso);

    // Large Chibi Head
    const skinMat = new THREE.MeshLambertMaterial({ color: 0x8d5524 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 14), skinMat);
    head.position.y = 1.66;
    pitcherGroup.add(head);

    // Chibi Eyes with sparkles
    const eyePupilMat = new THREE.MeshBasicMaterial({ color: 0x111827 });
    const eyeSparkleMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), eyePupilMat);
    eyeL.position.set(-0.22, 1.66, 0.55);
    pitcherGroup.add(eyeL);

    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), eyePupilMat);
    eyeR.position.set(0.22, 1.66, 0.55);
    pitcherGroup.add(eyeR);

    const glintL = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), eyeSparkleMat);
    glintL.position.set(-0.19, 1.7, 0.63);
    pitcherGroup.add(glintL);

    const glintR = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), eyeSparkleMat);
    glintR.position.set(0.25, 1.7, 0.63);
    pitcherGroup.add(glintR);

    // Cap (Cap Dome + Visor)
    const capMat = new THREE.MeshLambertMaterial({ color: 0x1e3a8a });
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.64, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
      capMat
    );
    cap.position.y = 1.72;
    pitcherGroup.add(cap);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.08, 0.46), capMat);
    visor.position.set(0, 1.84, 0.52);
    visor.rotation.x = 0.12;
    pitcherGroup.add(visor);

    // Left Arm with Brown Pitcher's Glove
    const gloveMat = new THREE.MeshLambertMaterial({ color: 0x78350f });
    const armLeft = new THREE.Group();
    armLeft.position.set(-0.48, 1.1, 0.0);
    const armLeftMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.11, 0.46, 8), blueMat);
    armLeftMesh.position.set(0, -0.18, 0.12);
    armLeftMesh.rotation.x = 0.5;
    armLeft.add(armLeftMesh);

    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 10), gloveMat);
    glove.position.set(0, -0.36, 0.28);
    armLeft.add(glove);
    pitcherGroup.add(armLeft);

    // Right Arm (Throwing Arm with Pitching Hand & Held Ball)
    const armRightPivot = new THREE.Group();
    armRightPivot.position.set(0.48, 1.15, 0.0);

    const armRightMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.11, 0.48, 8), blueMat);
    armRightMesh.position.set(0.08, -0.2, 0);
    armRightMesh.rotation.z = -0.3;
    armRightPivot.add(armRightMesh);

    const heldBallMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    heldBallMesh.position.set(0.16, -0.42, 0.12);
    armRightPivot.add(heldBallMesh);
    pitcherGroup.add(armRightPivot);

    // Catcher squatting behind Home Plate
    const catcherGroup = new THREE.Group();
    catcherGroup.position.set(HOME_POS.x, 0.1, HOME_POS.z + 2.0);
    catcherGroup.scale.set(0.9, 0.82, 0.9);
    catcherGroup.rotation.y = Math.PI; // Faces toward pitcher
    scene.add(catcherGroup);

    const cShadow = new THREE.Mesh(new THREE.CircleGeometry(0.7, 16), shadowMat);
    cShadow.rotation.x = -Math.PI / 2;
    cShadow.position.y = 0.02;
    catcherGroup.add(cShadow);

    const cTorso = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.38, 0.72, 10), blueMat);
    cTorso.position.y = 0.65;
    catcherGroup.add(cTorso);

    const cChest = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.65, 0.24),
      new THREE.MeshLambertMaterial({ color: 0x0f172a })
    );
    cChest.position.set(0, 0.65, 0.32);
    catcherGroup.add(cChest);

    const cHead = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 12), skinMat);
    cHead.position.y = 1.4;
    catcherGroup.add(cHead);

    const cMask = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 0.65, 0.22),
      new THREE.MeshBasicMaterial({ color: 0x334155, wireframe: true })
    );
    cMask.position.set(0, 1.4, 0.48);
    catcherGroup.add(cMask);

    const cMitt = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 10), gloveMat);
    cMitt.position.set(0, 0.95, 0.55);
    catcherGroup.add(cMitt);

    // 8. Pitch Ball Projectile
    const ballMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    ballMesh.visible = false;
    scene.add(ballMesh);

    const ballShadow = new THREE.Mesh(new THREE.CircleGeometry(0.22, 16), shadowMat);
    ballShadow.rotation.x = -Math.PI / 2;
    ballShadow.position.y = 0.03;
    ballShadow.visible = false;
    scene.add(ballShadow);

    // Trajectory Trail Line (glowing ribbon of previous pitch positions)
    const MAX_TRAIL_POINTS = 60;
    const trailGeo = new THREE.BufferGeometry();
    const trailPositions = new Float32Array(MAX_TRAIL_POINTS * 3);
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
    const trailMat = new THREE.LineBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.85,
      linewidth: 3,
    });
    const trailLine = new THREE.Line(trailGeo, trailMat);
    trailLine.frustumCulled = false;
    scene.add(trailLine);

    // 9. Automated / Manual Pitch Trigger Logic
    const triggerPitchExecution = (forcedType?: PitchType) => {
      if (isPitchingRef.current) return;
      isPitchingRef.current = true;

      // Random selection if not forced: Fastball (Recta) or Curveball (Curva)
      const pitchType: PitchType = forcedType || (Math.random() > 0.5 ? 'FASTBALL' : 'CURVEBALL');

      // Random speed and target variations
      const speedMph = pitchType === 'FASTBALL'
        ? Math.floor(95 + Math.random() * 6) // 95 - 100 MPH
        : Math.floor(78 + Math.random() * 6); // 78 - 83 MPH

      // Target in strike zone (plus random slight variation)
      const targetX = (Math.random() - 0.5) * 0.7; // within +/- 0.35m
      const targetY = 1.0 + Math.random() * 0.9;   // 1.0m to 1.9m

      const isStrike = Math.abs(targetX) <= 0.38 && targetY >= 0.95 && targetY <= 1.95;

      const breakInches = pitchType === 'FASTBALL'
        ? Math.round(2 + Math.random() * 3)
        : Math.round(12 + Math.random() * 7);

      onPitchStart?.(pitchType, speedMph);
      pitchAudio.playWhoosh(speedMph);

      // Trajectory curve control points
      const releasePos = new THREE.Vector3(
        MOUND_POS.x + 0.35,
        MOUND_POS.y + 1.65,
        MOUND_POS.z + 0.8
      );
      const targetPos = new THREE.Vector3(targetX, targetY, STRIKE_ZONE_Z);

      // Curve hump & lateral break control point
      const midZ = (releasePos.z + targetPos.z) * 0.5;
      const midY = pitchType === 'CURVEBALL'
        ? releasePos.y + 0.75 // Arches up out of hand
        : (releasePos.y + targetPos.y) * 0.5 + 0.15; // Straight with slight arc

      // Lateral break direction for curveball (sweeps left or right)
      const curveDir = Math.random() > 0.4 ? 1 : -1;
      const midX = pitchType === 'CURVEBALL'
        ? releasePos.x + curveDir * 0.75
        : (releasePos.x + targetPos.x) * 0.5;

      const ctrlPoint = new THREE.Vector3(midX, midY, midZ);

      // Trail styling
      trailMat.color.setHex(pitchType === 'FASTBALL' ? 0xfacc15 : 0x06b6d4);

      // Pitcher windup animation start
      let animProgress = 0;
      const pitchDuration = pitchType === 'FASTBALL' ? 480 : 720; // ms
      const windupDuration = 380; // ms
      const startTime = performance.now();

      ballMesh.visible = false;
      ballShadow.visible = false;
      heldBallMesh.visible = true;

      let trailIndex = 0;
      for (let i = 0; i < MAX_TRAIL_POINTS * 3; i++) trailPositions[i] = 0;
      trailGeo.attributes.position.needsUpdate = true;

      const stepPitch = (now: number) => {
        const totalElapsed = now - startTime;

        // Phase 1: Windup
        if (totalElapsed < windupDuration) {
          const wT = totalElapsed / windupDuration;
          // Leg kick & arm windup
          legLeft.position.y = 0.26 + Math.sin(wT * Math.PI) * 0.38;
          legLeft.rotation.x = -Math.sin(wT * Math.PI) * 0.9;
          armRightPivot.rotation.x = -wT * Math.PI * 1.8;
          requestAnimationFrame(stepPitch);
          return;
        }

        // Phase 2: Release & Flight
        const flightElapsed = totalElapsed - windupDuration;
        const pT = Math.min(1, flightElapsed / pitchDuration);

        // Hide ball in hand, show ball in flight
        heldBallMesh.visible = false;
        ballMesh.visible = true;
        ballShadow.visible = true;

        // Quadratic Bezier interpolation for ball position: B(t) = (1-t)^2 P0 + 2(1-t)t P1 + t^2 P2
        const oneMinusT = 1 - pT;
        const currentBallPos = new THREE.Vector3(
          oneMinusT * oneMinusT * releasePos.x + 2 * oneMinusT * pT * ctrlPoint.x + pT * pT * targetPos.x,
          oneMinusT * oneMinusT * releasePos.y + 2 * oneMinusT * pT * ctrlPoint.y + pT * pT * targetPos.y,
          oneMinusT * oneMinusT * releasePos.z + 2 * oneMinusT * pT * ctrlPoint.z + pT * pT * targetPos.z
        );

        ballMesh.position.copy(currentBallPos);
        ballMesh.rotation.x += 0.3;
        ballMesh.rotation.y += 0.2;

        ballShadow.position.set(currentBallPos.x, 0.04, currentBallPos.z);
        // Shadow scales smaller when ball is higher
        const shadowScale = Math.max(0.4, 1.0 - (currentBallPos.y - 0.5) * 0.25);
        ballShadow.scale.set(shadowScale, shadowScale, 1);

        // Update trail
        if (showTrail && trailIndex < MAX_TRAIL_POINTS) {
          trailPositions[trailIndex * 3] = currentBallPos.x;
          trailPositions[trailIndex * 3 + 1] = currentBallPos.y;
          trailPositions[trailIndex * 3 + 2] = currentBallPos.z;
          trailIndex++;
          trailGeo.setDrawRange(0, trailIndex);
          trailGeo.attributes.position.needsUpdate = true;
        }

        // Catcher glove moves to meet the incoming pitch
        cMitt.position.x = THREE.MathUtils.lerp(cMitt.position.x, targetX, 0.15);
        cMitt.position.y = THREE.MathUtils.lerp(cMitt.position.y, targetY, 0.15);

        if (pT < 1) {
          requestAnimationFrame(stepPitch);
        } else {
          // Ball arrived at Home Plate!
          pitchAudio.playCatchPop();
          if (isStrike) pitchAudio.playStrikeCall();

          // Highlight strike zone impact marker
          impactMarker.position.set(targetX, targetY, STRIKE_ZONE_Z + 0.02);
          impactMarkerMat.color.setHex(isStrike ? 0xef4444 : 0x38bdf8);
          impactMarkerMat.opacity = 0.95;

          const result: PitchResult = {
            id: `pitch-${Date.now()}`,
            type: pitchType,
            speedMph,
            breakInches,
            isStrike,
            targetX,
            targetY,
            timestamp: new Date(),
          };

          onPitchComplete?.(result);

          // Return pitcher to ready stance
          setTimeout(() => {
            legLeft.position.y = 0.26;
            legLeft.rotation.x = 0;
            armRightPivot.rotation.x = 0;
            heldBallMesh.visible = true;
            ballMesh.visible = false;
            ballShadow.visible = false;
            isPitchingRef.current = false;
          }, 350);

          // Fade impact marker
          setTimeout(() => {
            impactMarkerMat.opacity = 0;
          }, 1800);
        }
      };

      requestAnimationFrame(stepPitch);
    };

    // Store callbacks in ref for parent access
    sceneContextRef.current = {
      triggerPitch: triggerPitchExecution,
      setCameraView: (view: CameraView) => {
        currentCamView = view;
        const config = camTargets[view];
        targetCamPos.copy(config.pos);
        targetCamLookAt.copy(config.lookAt);
      },
    };

    // Resize handler
    const handleResize = () => {
      if (!container || !renderer) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Animation Render Loop
    let animId = 0;
    let clock = 0;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      clock += 0.03;

      // Smooth camera interpolation
      camera.position.lerp(targetCamPos, 0.08);
      currentCamLookAt.lerp(targetCamLookAt, 0.08);
      camera.lookAt(currentCamLookAt);

      // Pitcher subtle idle breathing
      if (!isPitchingRef.current) {
        torso.position.y = 0.84 + Math.sin(clock * 2) * 0.015;
        head.position.y = 1.66 + Math.sin(clock * 2) * 0.015;
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, [onPitchStart, onPitchComplete, showTrail]);

  return (
    <div
      ref={mountRef}
      data-testid="three-pitcher-scene"
      className="absolute inset-0 w-full h-full overflow-hidden select-none"
    />
  );
});

PitcherScene.displayName = 'PitcherScene';
