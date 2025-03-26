import Phaser from "phaser";

const config = {
  type: Phaser.AUTO,
  width: 960,
  height: 540,
  // scale: {
  //   mode: Phaser.Scale.FIT, // Scales the game to fit the parent container while preserving aspect ratio
  //   autoCenter: Phaser.Scale.CENTER_BOTH, // Centers the canvas in the available space
  // },
  physics: {
    default: "arcade",
    arcade: { gravity: { y: 300 }, debug: false },
  },
  scene: { preload: preload, create: create, update: update },
};

const game = new Phaser.Game(config);

let player;
let platforms;
let platformObjects = [];

function preload() {
  this.load.image("background", "assets/images/background/MainBackGround.png");
  this.load.image("platform", "assets/images/background/GrassPlatform.png");
  this.load.spritesheet("player_idle", "assets/images/player/idle-sheet.png", {
    frameWidth: 208,
    frameHeight: 160,
  });
  this.load.spritesheet("player_jump", "assets/images/player/jump-sheet.png", {
    frameWidth: 208,
    frameHeight: 160,
  });
}

function create() {
  this.add.image(480, 270, "background").setScale(0.645);
  this.physics.world.setBounds(0, 0, 800, 600);

  platforms = this.physics.add.staticGroup();
  let platformPositions = [
    { x: 125, y: 475 },
    { x: 250, y: 475 },
    { x: 375, y: 475 },
    { x: 500, y: 475 },
    { x: 625, y: 475 },
  ];
  let allowedJumpsMaxCnt = [2, 3, 0, 1, 4];
  // 2 3 1 1 4
  // 2 3 0 1 4
  // 3 2 1 0 4
  // 1 2 3 1 1 0 2 5

  platformPositions.forEach((pos, index) => {
    let platform = platforms.create(pos.x, pos.y, "platform").setScale(0.15);
    platform.refreshBody();
    platform.jumpSteps = allowedJumpsMaxCnt[index];
    platformObjects.push(platform);
    this.add
      .text(pos.x, pos.y, allowedJumpsMaxCnt[index], {
        fontSize: "52px",
        fill: "#ffffff",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 4,
        align: "center",
      })
      .setOrigin(0.5, 0.5);
  });

  player = this.physics.add.sprite(125, 375, "player_idle").setScale(0.375);
  player.setCollideWorldBounds(true);
  player.isJumping = false;

  // When player collides with a platform, store its index.
  this.physics.add.collider(
    player,
    platforms,
    function (player, platform) {
      let index = platformObjects.findIndex((p) => p === platform);
      player.currentPlatformIndex = index;
    },
    null,
    this
  );

  this.anims.create({
    key: "idle",
    frames: this.anims.generateFrameNumbers("player_idle", {
      start: 0,
      end: 11,
    }),
    frameRate: 15,
    repeat: -1,
  });
  this.anims.create({
    key: "jump",
    frames: this.anims.generateFrameNumbers("player_jump", {
      start: 0,
      end: 1,
    }),
    frameRate: 5,
    repeat: -1,
  });

  this.trajectoryGraphics = this.add.graphics();
  this.trajectoryGraphics.setDepth(0); // lower depth
  player.setDepth(1);

  this.handleJump = function (steps, gestureDirection) {
    // Only jump if on ground and not already jumping.
    if (!player.body.touching.down || player.isJumping) return;

    let currentIndex = player.currentPlatformIndex;

    if (currentIndex === undefined) return;

    let direction =
      typeof gestureDirection !== "undefined" ? gestureDirection : 1;
    let allowedSteps = platformObjects[currentIndex].jumpSteps;

    if (Math.abs(steps) > allowedSteps) {
      console.log("Jump too far! Allowed steps: " + allowedSteps);
      return;
    }

    let baseY = player.y;
    // Calculate destination index based on desired steps.
    let destIndex = currentIndex + direction * steps;
    // Clamp destIndex to available range.
    destIndex = Phaser.Math.Clamp(destIndex, 0, platformObjects.length - 1);
    // Recalculate effective steps (could be less than requested if at boundaries).
    let effectiveSteps = destIndex - currentIndex;

    if (effectiveSteps === 0) return; // No jump possible.

    let destPlatform = platformObjects[destIndex];

    player.isJumping = true;

    if (player.anims.currentAnim?.key !== "jump") {
      player.anims.play("jump", true);
    }
    player.flipX = effectiveSteps < 0;

    // Tween the player to the destination x with a parabolic y arc.
    this.tweens.add({
      targets: player,
      x: destPlatform.x,
      ease: "Quad.easeOut",
      duration: 500,
      onUpdate: function (tween, target) {
        let progress = tween.progress;
        let jumpPeak = 50 * Math.abs(effectiveSteps); // Use effective steps for peak height.
        target.y = baseY - jumpPeak * Math.sin(Math.PI * progress);
      },
      onComplete: () => {
        player.isJumping = false;
        player.setTexture("player_idle");
        player.anims.play("idle", true);
      },
    });
  };

  // On pointerdown, record starting position.
  this.input.on(
    "pointerdown",
    function (pointer) {
      this.swipeStart = { x: pointer.x, y: pointer.y };
    },
    this
  );

  // On pointermove, calculate swipe delta and draw trajectory.
  this.input.on(
    "pointermove",
    function (pointer) {
      if (!this.swipeStart) return;

      let deltaX = pointer.x - this.swipeStart.x;
      let swipeDirection = deltaX >= 0 ? 1 : -1;
      let absDistance = Math.abs(deltaX);
      // Convert swipe distance to steps (50 pixels per step).
      let predictedSteps = Math.round(absDistance / 50);
      let currentIndex = player.currentPlatformIndex;

      if (currentIndex === undefined) return;

      let allowedSteps = platformObjects[currentIndex].jumpSteps;
      predictedSteps = Phaser.Math.Clamp(predictedSteps, 0, allowedSteps);

      // Compute desired destination index.
      let desiredDestIndex = currentIndex + swipeDirection * predictedSteps;
      desiredDestIndex = Phaser.Math.Clamp(
        desiredDestIndex,
        0,
        platformObjects.length - 1
      );
      let effectiveSteps = desiredDestIndex - currentIndex;

      // If no effective change (e.g. at boundaries), clear preview.
      if (effectiveSteps === 0) {
        this.trajectoryGraphics.clear();
        this.predictedStepsSigned = 0;
        return;
      }

      let destPlatform = platformObjects[desiredDestIndex];
      let startX = player.x;
      let startY = player.y;
      let destX = destPlatform.x;
      // Use effective steps for jump peak.
      let jumpPeak = 50 * Math.abs(effectiveSteps);

      // Draw the trajectory curve.
      this.trajectoryGraphics.clear();
      this.trajectoryGraphics.lineStyle(3.5, 0x000000, 1);
      this.trajectoryGraphics.beginPath();
      this.trajectoryGraphics.moveTo(startX, startY);

      const stepsCount = 20;

      for (let i = 1; i <= stepsCount; i++) {
        let t = i / stepsCount;
        let x = Phaser.Math.Interpolation.Linear([startX, destX], t);
        let y = startY - jumpPeak * Math.sin(Math.PI * t);
        this.trajectoryGraphics.lineTo(x, y);
      }
      this.trajectoryGraphics.strokePath();
      this.trajectoryGraphics.fillStyle(0x000000, 1);
      this.trajectoryGraphics.fillCircle(destX, startY, 10);

      // Store the computed effective steps (signed) and direction.
      this.predictedStepsSigned = effectiveSteps;
    },
    this
  );

  // On pointerup, clear preview and trigger the jump using the computed endpoint.
  this.input.on(
    "pointerup",
    function (pointer) {
      this.trajectoryGraphics.clear();
      if (!this.swipeStart) return;

      if (this.predictedStepsSigned && this.predictedStepsSigned !== 0) {
        this.handleJump(
          Math.abs(this.predictedStepsSigned),
          this.predictedStepsSigned > 0 ? 1 : -1
        );
      }

      this.swipeStart = null;
    },
    this
  );
}

function update() {
  // When on the ground, reset horizontal velocity.
  if (player.body.touching.down) {
    player.setVelocityX(0);
  }

  // Ensure idle animation plays when not jumping.
  if (player.body.touching.down && !player.isJumping) {
    if (player.texture.key !== "player_idle") {
      player.setTexture("player_idle");
      player.anims.play("idle", true);
    } else {
      player.anims.play("idle", true);
    }
  }
}
