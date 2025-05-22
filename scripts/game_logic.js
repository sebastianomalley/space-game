// game_logic.js
import { fetchNasaKey } from '../../nasa_apod/scripts/api.js';
// Protective onload.
window.addEventListener('load', function() {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    // Ensure the font is loaded
    document.fonts.load('10pt "Nasalization"');

    // ===========================
    // Game Constants and Initial States
    // ===========================
    const targetRadius = 20;
    const moveStep = 3; // Movement speed of rocket.  Lower is slower.
    const laserSpeed = 5;

    const levels = [
      { 
        asteroidsToDestroy: 3, 
        backgroundAPI: { date: '2024-11-21' }, // NASA API image for this date.  Default.
        music: new Audio('assets/sound_fx/level1_music.mp3') 
      },
      { 
        asteroidsToDestroy: 5, 
        backgroundAPI: { date: '2024-12-09' }, // NASA API image for this date.  Default.
        music: new Audio('assets/sound_fx/level2_music.mp3') 
      },
      {
        asteroidsToDestroy: 1, // Represents the boss.
        backgroundAPI: { date: '2024-11-28' },  // NASA API image for this date.  Default.
        music: new Audio('assets/sound_fx/level3_music.mp3'),
      }   
    ];

    let targetX = canvas.width / 2; 
    let targetY = canvas.height / 2;

    let keys = {}; 
    let laserPositions = [];
    let asteroids = [];

      // ===========================
      // Image Loading
      // ===========================
    const targetImage = new Image();
    const titleBackgroundImage = new Image();
    const backgroundImage = new Image();
    const satelliteImage = new Image();
    satelliteImage.src = "assets/images/satellite.png";

    let imagesLoaded = {
      background: false,
      target: false,
      asteroid1: false,
      asteroid2: false,
      asteroid3: false,
      asteroid4: false,
      satellite: false
    };
  
    // ===========================
    // Sound Effects Initialization
    // ===========================
    const laserSound = new Audio('assets/sound_fx/laser3.wav'); // Path to sound file.
    const hitSound = new Audio('assets/sound_fx/hit_sound.wav'); // Path to sound file.
    hitSound.volume = 1.0;
    const destroySound = new Audio('assets/sound_fx/explosion3.wav');  // Path to sound file.
    destroySound.volume = 1.0;
    const bossHitSound = new Audio('assets/sound_fx/explosion3.wav'); // Path to sound file.
    bossHitSound.volume = 0.6; // Adjust volume if needed.
    let bossHitCooldown = 0; // Time remaining for cooldown in seconds.
    const BOSS_HIT_COOLDOWN_DURATION = 0.5; // 0.5 seconds cooldown.
    const bossExplosionSound = new Audio('assets/sound_fx/huge_explosion.wav'); // Path to sound file.
    bossExplosionSound.volume = 0.6; // Set the volume level.
    const rocketHitSound = new Audio('assets/sound_fx/rocket_hit.mp3'); // Path to your sound file.
    rocketHitSound.volume = 1.0; // Adjust the volume as needed.
    const freezeSound = new Audio('assets/sound_fx/rocket_buzz.mp3');
    freezeSound.volume = 1.0; // Adjust the volume as needed.

    let bossLightningDelay = 5000; // 5 seconds delay before firing starts.
    let bossLightningReady = false; // Indicates if the boss is ready to fire.
    
    let rocketFrozen = false; // Indicates if the rocket is currently frozen.
    let rocketFreezeTimer = 0; // Timer to track freeze duration.
    const freezeDuration = 1.0; // Duration of the freeze in seconds.

    let starsAnimationFrameId = null; // Global variable to store the animation frame ID for stars.
    let bossProjectiles = [];

    let rocketHealth = 100; // Starting health.
    const maxRocketHealth = 100; // Maximum health.

    let laserAngle = 0; // Initial angle (0 is upward).
    let lasersOnVictoryScreen = []; // Array to track fired lasers.

      // ===========================
      // Asteroid Images Loading
      // ===========================
    const asteroidImages = [];

    // Load all asteroid images.
    for (let i = 1; i <= 4; i++) {
      const img = new Image();
      img.src = `assets/images/asteroid_${String(i).padStart(3, '0')}.png`; // asteroid_001.png, etc.
      img.onload = () => {
        imagesLoaded[`asteroid${i}`] = true;
        checkAllImagesLoaded();
      };
      img.onerror = () => {
        console.error(`Failed to load asteroid_${String(i).padStart(3, '0')}.png`);
      };
      asteroidImages.push(img);
    }

    // Load satellite image.
    satelliteImage.onload = () => {
      imagesLoaded.satellite = true;
      checkAllImagesLoaded();
    };
    satelliteImage.onerror = () => {
      console.error("Failed to load satellite.png");
    };

    const flashSound = new Audio('assets/sound_fx/one_up.wav');
    flashSound.volume = 1.0; // Set to max volume.

    const titleMusic = new Audio('assets/sound_fx/MEGA.mp3'); // Path to sound file.
    titleMusic.loop = true; // Make it loop during the title screen.
    titleMusic.volume = 0.4; // Set the volume level.

    let gameMusic = null; // Dynamically assigned in loadLevel.

    const gameOverSound = new Audio('assets/sound_fx/theme3.wav'); // Path to sound file.
    gameOverSound.volume = 0.4; // Set the volume level.

    const victoryMusic = new Audio('assets/sound_fx/oneLast.mp3'); // Path to sound file.
    victoryMusic.volume = 0.5;  // Set the volume level.
    let targetVisible = true; // Track if target is visible.
    let asteroidsDestroyed = 0; // Counter for destroyed asteroids.
    let bossAsteroid = null; // Define boss asteroid.

    let currentLevel = 1; // Start game with level 1.
    let targetAsteroids = levels[0].asteroidsToDestroy; // Get asteroid count for level 1.
    
    let gameStarted = false; // New state to track if game has started.
    let gameOverFlag = false; // A flag to control game over state.

    // ===========================
    // Life Management
    // ===========================
    let lives = 3; // Player starts with 3 lives.
    let lifeImages = []; // Array to track extra lives icons.

    let victoryScreenActive = false; // Track if the victory screen is active.

    let gameAnimationFrameId = null; // Store game loop frame ID globally.

    // ===========================
    // Image Fetching from NASA APOD API
    // ===========================

    // Fetch image from NASA's APOD API for a specific date.
    async function fetchImage(dateInput, imgElement, imgKey) {
      // 1) Make sure we have a real Date object
      const dateObj = dateInput instanceof Date
        ? dateInput
        : new Date(dateInput);

      // 2) Turn it into YYYY-MM-DD
      const dateParam = dateObj.toISOString().split('T')[0];

      // 3) Grab your secret key at runtime
      const key = await fetchNasaKey();

      // 4) Now build the URL with dateParam defined
      const APOD_URL = `https://api.nasa.gov/planetary/apod?api_key=${key}&date=${dateParam}`;

      try {
        const response = await fetch(APOD_URL);
        if (!response.ok) throw new Error("Failed to fetch image");

        const data = await response.json();
        if (!data.url) throw new Error("Image URL not found in response");

        imgElement.src = data.url;

        // 5) Mark this specific image as loaded
        imgElement.onload = () => {
          imagesLoaded[imgKey] = true;
          checkAllImagesLoaded();
        };
        if (imgElement.complete) {
          imagesLoaded[imgKey] = true;
          checkAllImagesLoaded();
        }
      } catch (error) {
        console.error(`Error fetching image for ${dateParam}:`, error);
        imagesLoaded[imgKey] = true;
        checkAllImagesLoaded();
      }
    }


    // ===========================
    // Canvas Resizing
    // ===========================

    // Resize canvas and re-center target.
    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      targetX = canvas.width / 2;
      targetY = canvas.height * 0.55;
    }
    resizeCanvas();

    // Add a resize event listener to handle window size changes.
    window.addEventListener('resize', () => {
        resizeCanvas();
    });
  
    // ===========================
    // Image Loading Utility
    // ===========================
    // Load images.
    function loadImage(img, src, key) {
      img.src = src;
      img.onload = () => {
        imagesLoaded[key] = true;
        checkAllImagesLoaded();
      };
      img.onerror = () => {
        console.error(`Failed to load ${key} image.`);
      };
    }

    // Load the target image using loadImage.
    loadImage(targetImage, 'assets/images/rocket.png', 'target');

    // Load the title background image using fetchImage.
    fetchImage('2024-11-02', titleBackgroundImage, 'titleBackground');

    // ===========================
    // Music Control Functions
    // ===========================
    // Stop the game music.
    function stopGameMusic() {
      gameMusic.pause();
      gameMusic.currentTime = 0; // Reset to the beginning.
    }
  
    // ===========================
    // Level Loading Function
    // ===========================
    async function loadLevel(level) {
      currentLevel = level;
      targetAsteroids = levels[level - 1].asteroidsToDestroy; // Set target number of asteroids.
      asteroidsDestroyed = 0; // Reset asteroid destruction count.
      asteroids = []; // Clear existing asteroids.

      // Set the background for the level.
      const levelSettings = levels[level - 1];
      if (levelSettings.backgroundAPI) {
        // Ensure the latest background is applied.
        const savedBackgrounds = JSON.parse(localStorage.getItem('backgrounds')) || {};
        const levelKey = `level${level}`;
        if (savedBackgrounds[levelKey]) {
          levelSettings.backgroundAPI.date = savedBackgrounds[levelKey];
        }
        await fetchImage(levelSettings.backgroundAPI.date, backgroundImage, 'background');
      }

      // Boss level logic.
      if (level === levels.length) {
        spawnBossAsteroid();
      
        // Ensure bossLightningReady is false, initially.
        bossLightningReady = false;
      
        // Introduce a delay before allowing the boss to fire.
        setTimeout(() => {
          bossLightningReady = true; // Boss can fire after the delay.
          console.log("Boss is ready to fire lightning!");
        }, bossLightningDelay); // 5 seconds delay.
      } else {
        bossAsteroid = null;
      }
    
      // Change music for new level.
      if (gameMusic) {
        stopGameMusic();
      }

      // Debugging: Log level data.
      console.log("Loading level:", level);
      console.log("Level Data:", levels[level - 1]);

      // Safely assign new music for the current level.
      if (levels[level - 1] && levels[level - 1].music) {
        gameMusic = levels[level - 1].music;

        console.log("Game music initialized:", gameMusic);

        // Adjust playback settings for levels 2 and 3.
        if (level === 2) {
          gameMusic.currentTime = 5; // Start at 5 seconds in.
        }
        if (level === 3) {
          rocketHealth = maxRocketHealth;
          gameMusic.currentTime = 1; // Start at 1 second in.
        }

        gameMusic.loop = true;

        // Attempt to play music with error handling.
        gameMusic.play().then(() => {
          console.log("Game music is playing.");
        }).catch((err) => {
          console.error("Error playing game music:", err);
        });
      } else {
        console.warn(`Music for level ${level} is missing or undefined.`);
      }
      // ** Show Level Text. **
      showLevelText(`Level ${level}`);
    }

    // ===========================
    // Boss Health Bar Rendering
    // ===========================
    function drawBossHealthBar() {
      if (!bossAsteroid) return; // Add this check to prevent errors if bossAsteroid is null.

      const maxBarWidth = canvas.width * 0.5; // 50% of canvas width.
      const barHeight = 30; // Height of the health bar.
      const extraLivesHeight = 70; // Adjust this to match the height of extra lives display.
      const margin = 20; // Space between extra lives and the health bar.
      const labelMargin = 25; // Space between the label and the health bar.

      // Calculate position for the health bar.
      const x = (canvas.width - maxBarWidth) / 2; // Center the bar horizontally.
      const y = extraLivesHeight + margin; // Place it below the extra lives with extra spacing.

      const healthRatio = bossAsteroid.currentHits / bossAsteroid.hitsRequired;

      // Interpolate colors based on healthRatio (green → yellow → red).
      const r = Math.min(255, Math.max(0, Math.floor(510 * healthRatio))); // Red increases with healthRatio.
      const g = Math.min(255, Math.max(0, Math.floor(510 * (1 - healthRatio)))); // Green decreases with healthRatio.
      const barColor = `rgb(${r}, ${g}, 0)`; // Smooth gradient from green to yellow to red.

      // Create gradient for the label.
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
      gradient.addColorStop(0, "orange");
      gradient.addColorStop(0.5, "gold");
      gradient.addColorStop(1, "red");

      // Draw label above the health bar.
      ctx.font = '60px "Nasalization", sans-serif'; // Label font.
      ctx.fillStyle = gradient; // Gradient color for the text.
      ctx.textAlign = 'center';
      ctx.fillText("Boss", canvas.width / 2, y - labelMargin);

      // Draw background (gray bar).
      ctx.fillStyle = 'gray';
      ctx.fillRect(x, y, maxBarWidth, barHeight);

      // Draw foreground (dynamic color bar based on remaining health).
      ctx.fillStyle = barColor;
      ctx.fillRect(x, y, maxBarWidth * (1 - healthRatio), barHeight);

      // Add a border for better visibility.
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, maxBarWidth, barHeight);
    }

    // ===========================
    // Life Images Initialization
    // ===========================
    // Initialize lifeImages array with images on game start.
    function initLifeImages() {
      lifeImages = new Array(lives).fill(targetImage); // Fill array with extra lives icons.
    }

    // ===========================
    // Image Load Completion Check
    // ===========================
    // Function to check if all images are loaded.
    function checkAllImagesLoaded() {
      const allAsteroidsLoaded = asteroidImages.every((img, index) => imagesLoaded[`asteroid${index + 1}`]);
      const allImagesLoaded = allAsteroidsLoaded && imagesLoaded.background && imagesLoaded.target && imagesLoaded.satellite;

      if (allImagesLoaded) {
        initLifeImages(); // Initialize game state including lives.
        requestAnimationFrame(gameLoop);
      }
    }

    // ===========================
    // Title Screen Animation
    // ===========================
    let blink = true; // Toggles visibility of the "Press Space" text.
    // Toggle blink every 500ms.
    setInterval(() => {
      blink = !blink;
    }, 700); // Toggle every 700ms.

    // Function to start the title screen music.
    let isTitleMusicPlaying = false;

    function playTitleMusic() {
      titleMusic.volume = 0.4; // Reset volume to normal level.
      titleMusic.play().catch((err) => console.error('Error playing title music:', err));
    }

    // Stop the title screen music.
    function stopTitleMusic() {
      titleMusic.pause();
      titleMusic.currentTime = 0; // Reset to the beginning.
    }

    // ===========================
    // Starfield Animation
    // ===========================
    const numStars = 100;
    const stars = [];
    let frameCount = 0; 

    // Initialize all stars on-screen.
    for (let i = 0; i < numStars; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 1.5,
        vx: (Math.random() - 0.5) * 0.5, // Gentle horizontal drift.
        vy: (Math.random() - 0.5) * 0.5, // Gentle vertical drift.
        baseAlpha: Math.random() * 0.5 + 0.5 // Base brightness.
      });
    }

    // Draw and update stars.
    function drawAndUpdateStars() {
      for (let star of stars) {
        // Twinkle effect.
        const twinkle = Math.sin(frameCount / 20 + star.x + star.y) * 0.3;
        const alpha = Math.min(1, Math.max(0, star.baseAlpha + twinkle));

        // Update position.
        star.x += star.vx;
        star.y += star.vy;

        // Wrap around edges.
        if (star.x < 0) star.x = canvas.width;
        if (star.x > canvas.width) star.x = 0;
        if (star.y < 0) star.y = canvas.height;
        if (star.y > canvas.height) star.y = 0;

        // Draw the star.
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Example animation loop.
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Background image - draw it first.
        if (imagesLoaded.titleBackground) {
          ctx.drawImage(titleBackgroundImage, 0, 0, canvas.width, canvas.height);
        }
        drawAndUpdateStars();
        frameCount++;
        requestAnimationFrame(animate);
    }
    // Start the animation.
    animate();

    // Integrate this into the drawTitleScreen function.
    function drawTitleScreen() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw background image if loaded.
      if (imagesLoaded.titleBackground) {
        ctx.drawImage(titleBackgroundImage, 0, 0, canvas.width, canvas.height);
      }

      // Draw the stars first.
      drawAndUpdateStars();

      // Return to the original hue cycling logic for the gradient.
      const speedFactor = 1; // Controls how fast hues cycle.
      const baseHue = (frameCount * speedFactor) % 360;

      // Create the HSL-based gradient for a pinwheel rainbow effect.
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
      gradient.addColorStop(0, `hsl(${baseHue}, 100%, 50%)`);
      gradient.addColorStop(0.5, `hsl(${(baseHue + 120) % 360}, 100%, 50%)`);
      gradient.addColorStop(1, `hsl(${(baseHue + 240) % 360}, 100%, 50%)`);

      ctx.font = '170px "Nasalization", sans-serif';
      ctx.textAlign = 'center';

      // Set a stable glow, no pulsing.
      ctx.shadowColor = `hsl(${(baseHue + 60) % 360}, 100%, 50%)`; 
      ctx.shadowBlur = 20; // Fixed blur, no changing over time.

      // Draw text at center without scaling.
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2 - 100);

      ctx.fillStyle = gradient;
      ctx.fillText("DEFENDER", 0, 0);

      // Outline the text for better readability.
      ctx.strokeStyle = "black";
      ctx.lineWidth = 6;
      ctx.strokeText("DEFENDER", 0, 0);

      ctx.restore();

      // Blinking prompt text (unchanged).
      if (blink) {
      ctx.font = '30px "Nasalization", sans-serif';
      ctx.fillStyle = "white";
      ctx.shadowColor = "black";
      ctx.shadowBlur = 5;
      ctx.fillText("PRESS SPACE TO DEFEND", canvas.width / 2, canvas.height / 2 - 40);
    }

      // Draw the black line at the bottom last to cover artist info.  Clean look. 
      ctx.globalCompositeOperation = 'source-over';
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
      const barHeight = 100;
      ctx.fillStyle = 'black';
      ctx.fillRect(0, canvas.height - barHeight, canvas.width, barHeight);
    }

    // once the user presses any key or clicks, we can play titleMusic
    function unlockTitleMusic() {
      if (!isTitleMusicPlaying) {
        titleMusic.play().catch(() => {});  // now allowed, since it’s user-initiated
        isTitleMusicPlaying = true;
      }
      // remove listeners so we only do this once
      document.removeEventListener('keydown', unlockTitleMusic);
      document.removeEventListener('click',   unlockTitleMusic);
    }

    // listen for the very first user gesture
    document.addEventListener('keydown', unlockTitleMusic);
    document.addEventListener('click',   unlockTitleMusic);


    frameCount = 0;

    function animate() {
      if (!gameStarted) {
        drawTitleScreen();
        frameCount++;
        requestAnimationFrame(animate);
      }
    }
    animate();

    // ===========================
    // Asteroid Spawning and Updating
    // ===========================  
    let maxAsteroidsOnScreen = 50; // Increase the maximum number of asteroids.

    function spawnAsteroid(count = 1) {
      for (let i = 0; i < count; i++) {
        if (asteroids.length < maxAsteroidsOnScreen) {
          const x = Math.random() * canvas.width; // Random horizontal spawn position.
          let radius = Math.random() * 20 + 15; // Sizes between 15px and 35px.
          let speed = Math.random() * 2 + 1; // Base speeds.
          
          if (currentLevel === 2) {
            maxAsteroidsOnScreen = 100;
          }

          if (currentLevel === 3) {
            maxAsteroidsOnScreen = 30;
          }
          // Adjust speed and size for satellites.
          let isSatellite = false;
          if (currentLevel === 2 || currentLevel === 3) {
            isSatellite = Math.random() < 0.25; // 25% chance for satellites on levels 2 and 3.
            if (isSatellite) {
              speed = Math.random() * 1.5 + 1; // Satellites fall slower.
              radius *= 2.0; // Satellites are larger.
            }
          }
    
          // Select image based on type.
          const image = isSatellite
            ? satelliteImage
            : asteroidImages[Math.floor(Math.random() * asteroidImages.length)];
    
          // Assign a small random rotation for satellites.
          const initialRotation = Math.random() * Math.PI * 2;
          const rotationSpeed = isSatellite
            ? (Math.random() * 0.004) - 0.003 // Slow rotation for satellites.
            : (Math.random() * 0.005) - 0.002; // Faster rotation for asteroids.
    
          // Add the object to the list.
          asteroids.push({
            x,
            y: -radius, // Start slightly above the screen.
            radius,
            width: radius * 2,
            height: radius * 2,
            speed, // Individual speed.
            hits: 0,
            isDestroyed: false,
            hitFlashTime: 0,
            image, // Assigned image.
            rotation: initialRotation, // Current rotation angle.
            rotationSpeed // Rotation speed.
          });
        }
      }
    }

    // Update function to use asteroid-specific speed.
    function updateAsteroids(deltaTime) {
      asteroids = asteroids.filter((asteroid) => {
        if (asteroid.isDestroyed || asteroid.y > canvas.height) {
          return false; // Remove destroyed or out-of-bounds asteroids.
        }
    
        asteroid.y += asteroid.speed * deltaTime; // Move the asteroid downwards.
    
        // Update rotation.
        asteroid.rotation += asteroid.rotationSpeed * deltaTime;
    
        // Keep rotation within 0 to 2π radians.
        if (asteroid.rotation > Math.PI * 2) {
          asteroid.rotation -= Math.PI * 2;
        } else if (asteroid.rotation < 0) {
          asteroid.rotation += Math.PI * 2;
        }
    
        drawAsteroid(asteroid); // Draw the asteroid with updated rotation.
        return true;
      });
    }
  
    // Draw an asteroid.
    function drawAsteroid(asteroid) {
      if (asteroid.image && !asteroid.isDestroyed) {
        ctx.save(); // Save the current canvas state.
    
        // Translate to the asteroid's center.
        ctx.translate(asteroid.x, asteroid.y);
    
        // Rotate the canvas by the asteroid's current rotation angle.
        ctx.rotate(asteroid.rotation);
    
        // Draw the asteroid image centered at (0, 0) after rotation.
        ctx.drawImage(
          asteroid.image,
          -asteroid.radius, // Offset to center the image.
          -asteroid.radius,
          asteroid.width,
          asteroid.height
        );
    
        ctx.restore(); // Restore the canvas to its original state.
      }
    
      // Apply a red glow effect if hit.
      if (asteroid.hitFlashTime > 0) {
        ctx.beginPath();
        ctx.arc(asteroid.x, asteroid.y, asteroid.radius, 0, Math.PI * 2);
        const glowIntensity = Math.min(255, 200 + asteroid.hitFlashTime * 5);
        ctx.fillStyle = `rgba(${glowIntensity}, 0, 0, 0.4)`; // Semi-transparent red glow.
        ctx.fill();
        ctx.closePath();
        asteroid.hitFlashTime = Math.max(0, asteroid.hitFlashTime - 1); // Decrement safely.
      }
    }
  
    // ===========================
    // Boss Asteroid Management
    // ===========================
    /**
     * Spawn the boss asteroid with initial properties.
     */
    function spawnBossAsteroid() {
      bossAsteroid = {
        x: canvas.width / 2,
        y: 100, // Start near the top.
        radius: 100, // Large size.
        hitsRequired: 50, // Number of hits to destroy.
        currentHits: 0,
        isDestroyed: false,
        color: 'red', // Initial color.
        bossHitFlashTime: 0, // Tracks the duration of the flash effect.
      };
    }

    /**
     * Draw the boss asteroid with glow and lightning effects.
     */
    function drawBossAsteroid() {
      if (bossAsteroid && !bossAsteroid.isDestroyed) {
        const pulseRadius = bossAsteroid.radius + Math.sin(Date.now() / 200) * 10;

          // Flashing blue glow around the boss.
        const glowColor = Math.random() > 0.5 ? 'rgba(0, 0, 255, 0.3)' : 'rgba(173, 216, 230, 0.3)';
        ctx.beginPath();
        ctx.arc(bossAsteroid.x, bossAsteroid.y, pulseRadius, 0, Math.PI * 2);
        ctx.fillStyle = glowColor;
        ctx.fill();
        ctx.closePath();

        // Draw boss body with a radial gradient (adds texture).
        const bodyGradient = ctx.createRadialGradient(
          bossAsteroid.x,
          bossAsteroid.y,
          bossAsteroid.radius * 0.1,
          bossAsteroid.x,
          bossAsteroid.y,
          bossAsteroid.radius
        );
        bodyGradient.addColorStop(0, 'blue');
        bodyGradient.addColorStop(0.5, 'darkblue');
        bodyGradient.addColorStop(1, 'black');
        ctx.fillStyle = bodyGradient;
        ctx.beginPath();
        ctx.arc(bossAsteroid.x, bossAsteroid.y, bossAsteroid.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.closePath();

        // Lightning pulses around the boss.
        for (let i = 0; i < 6; i++) { // Adjust number of pulses.
          const angle = (Math.PI * 2 * i) / 6 + Math.random() * 0.5; // Randomize angles slightly.
          const endX = bossAsteroid.x + Math.cos(angle) * (bossAsteroid.radius + 30);
          const endY = bossAsteroid.y + Math.sin(angle) * (bossAsteroid.radius + 30);

          ctx.beginPath();
          ctx.moveTo(bossAsteroid.x, bossAsteroid.y);
          ctx.lineTo(endX, endY);
          ctx.strokeStyle = `rgba(0, 191, 255, ${Math.random() * 0.5 + 0.5})`;
          ctx.lineWidth = Math.random() * 2 + 1;
          ctx.stroke();
          ctx.closePath();
        }
      }
    }
    // ===========================
    // Boss Projectiles Management
    // ===========================
    function createLightningPath(startX, startY, endX, endY) {
      const segments = 8; // Number of segments in the lightning bolt.
      const path = [];
      const dx = (endX - startX) / segments;
      const dy = (endY - startY) / segments;

      let currentX = startX;
      let currentY = startY;

      for (let i = 0; i <= segments; i++) {
        const offsetX = Math.random() * 20 - 10; // Random horizontal offset.
        const offsetY = Math.random() * 20 - 10; // Random vertical offset.
        path.push({ x: currentX + offsetX, y: currentY + offsetY });
        currentX += dx;
        currentY += dy;
      }
      return path;
    }


    function updateBossProjectiles(deltaTime) {
      bossProjectiles = bossProjectiles.filter((projectile, index) => {
        console.log(`Projectile ${index} before update: x=${projectile.x}, y=${projectile.y}, life=${projectile.life}`);
    
        // Reduce lifespan.
        projectile.life -= deltaTime;
        if (projectile.life <= 0) {
            console.log(`Projectile ${index} expired and removed`);
            return false;
        }
    
        // Check collision with the rocket.
        const hit = projectile.path.some((point) => {
            const distance = Math.hypot(point.x - targetX, point.y - targetY);
            return distance < targetRadius;
        });
    
          if (hit && !projectile.hitRocket) { // Avoid multiple hits.
            console.log(`Projectile ${index} hit the rocket!`);
            freezeRocket(freezeDuration); // Freeze the rocket.
            projectile.hitRocket = true; // Mark projectile as having hit.
        }
    
        // Draw the lightning.
        drawBossLightning(projectile);
        console.log(`Projectile ${index} lightning drawn successfully`);
    
          return true; // Keep the projectile active until its life expires.
      });
      console.log(`Remaining boss projectiles: ${bossProjectiles.length}`);
    }

    let rocketHitFlashTime = 0; // Tracks the remaining time for the rocket's glow effect.

    function freezeRocket(duration = 1) {
      if (rocketFrozen) {
        console.log("Rocket is already frozen. Skipping additional freeze.");
        return;
      }

      rocketFrozen = true; // Freeze the rocket.
      rocketFreezeTimer = duration; // Set the freeze duration.

      // Play the freeze sound.
      freezeSound.currentTime = 0; // Reset the sound to the beginning.
      freezeSound.play().catch((err) => console.error('Error playing freeze sound:', err));

      // Trim the sound after 1 second.
      setTimeout(() => {
        freezeSound.pause();
        freezeSound.currentTime = 0; // Reset for future playback.
        console.log("Freeze sound stopped early.");
      }, 1000); // 1000 ms = 1 second.

      // Start the rocket glow effect.
      rocketHitFlashTime = 60; // 60 frames of glow, approximately 1 second at 60 FPS.

      // Reduce rocket health by 5%.
      const healthLoss = maxRocketHealth * 0.05; // 5% of max health.
      rocketHealth = Math.max(0, rocketHealth - healthLoss); // Ensure health doesn't go below 0.

      console.log(`Rocket frozen for ${duration} seconds. Health reduced by 5%. Current health: ${rocketHealth}`);

      // Check for game over.
      if (rocketHealth <= 0) {
        console.log("NASA health reached 0. Game Over triggered by lightning.");
        gameOver(); // Trigger game over if health is depleted.
      }

      // Add intense blue glow effect to the rocket.
      let flashTimer = duration * 60; // Convert duration to frames (assuming 60fps).
      // Inside freezeRocket(), after you back up originalDrawTarget…
      let originalDrawTarget = drawTarget;

      // Override drawTarget to add the blue-glow effect:
      drawTarget = function () {
        // 1) Recompute the rocket’s drawn size
        const scaledWidth  = targetRadius * 4 * rocketScaleX;
        const scaledHeight = targetRadius * 4 * rocketScaleY;

        ctx.save();

        // 2) Your existing glow circle logic
        if (rocketHitFlashTime > 0) {
          const glowIntensity = Math.min(255, 100 + rocketHitFlashTime * 5);
          const gradient = ctx.createRadialGradient(
            targetX, targetY, targetRadius,
            targetX, targetY, targetRadius * 2
          );
          gradient.addColorStop(0, `rgba(0, ${glowIntensity}, 255, 0.6)`);
          gradient.addColorStop(1, `rgba(0, ${glowIntensity}, 255, 0)`);
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(targetX, targetY, targetRadius * 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.closePath();

          rocketHitFlashTime = Math.max(0, rocketHitFlashTime - 1);
        }

        // 3) Shadow glow for the rocket
        ctx.shadowBlur = 40;
        ctx.shadowColor = 'rgb(0, 110, 255)';

        // 4) Draw the rocket itself using our locally scoped dimensions
        ctx.drawImage(
          targetImage,
          targetX - scaledWidth  / 2,
          targetY - scaledHeight / 2,
          scaledWidth,
          scaledHeight
        );

        ctx.restore();
      };

      // Restore the original drawTarget after the freeze duration
      setTimeout(() => {
        drawTarget = originalDrawTarget;
        console.log("Rocket glow effect removed.");
      }, duration * 1000);

    }

    // ===========================
    // Lightning Mechanics
    // ===========================
    /**
     * Fire a single lightning bolt from the boss to the player.
     */
    function fireSingleLightning() {
      const angleToPlayer = Math.atan2(targetY - bossAsteroid.y, targetX - bossAsteroid.x);

      bossProjectiles.push({
        x: bossAsteroid.x,
        y: bossAsteroid.y,
        angle: angleToPlayer,
        speed: 0, // Lightning is static, no movement.
        path: createLightningPath(bossAsteroid.x, bossAsteroid.y, targetX, targetY),
        life: 50 // Set a lifespan for the lightning bolt.
      });
      console.log("Fired lightning:", bossProjectiles[bossProjectiles.length - 1]);
    }

    function drawBossLightning(projectile) {
      if (!projectile.path || projectile.path.length === 0) {
        console.warn("Lightning path is empty; skipping draw.");
        return;
      }

      console.log(`Drawing lightning from (${projectile.path[0].x}, ${projectile.path[0].y}) to (${projectile.path[projectile.path.length - 1].x}, ${projectile.path[projectile.path.length - 1].y})`);

      ctx.save();
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(173, 216, 230, 0.8)'; // Lightning color.
      ctx.shadowBlur = 15;
      ctx.shadowColor = 'blue';

      ctx.beginPath();
      projectile.path.forEach((point, index) => {
          if (index === 0) {
            ctx.moveTo(point.x, point.y);
          } else {
            ctx.lineTo(point.x, point.y);
          }
      });

      ctx.stroke();
      ctx.restore();
      console.log("Lightning drawn successfully.");
    }
  
    // ===========================
    // Boss Asteroid Update Function
    // ===========================
    let bossFireCooldown = 0;     // Cooldown timer for firing lightning.

    let bossSpeedX = Math.random() * 6 + 0.5; // Randomized initial speed for X-axis.
    let bossSpeedY = Math.random() * 1 + 0.5; // Randomized initial speed for Y-axis.

    let bossCollisionCooldown = 0; // Cooldown timer for boss collisions.

    function updateBossAsteroid(deltaTime) {
      if (bossAsteroid && !bossAsteroid.isDestroyed) {
        const progressBarY = 140; // Y-coordinate of the health bar + extra margin.
        const verticalLimit = canvas.height * 0.5; // Limit vertical movement to 50% of the screen.

        // Ensure minimum and maximum speed thresholds for movement.
        const minSpeed = 4;
        const maxSpeed = 5;

        bossSpeedX = Math.sign(bossSpeedX || 1) * Math.max(minSpeed, Math.min(maxSpeed, Math.abs(bossSpeedX)));
        bossSpeedY = Math.sign(bossSpeedY || 1) * Math.max(minSpeed, Math.min(maxSpeed, Math.abs(bossSpeedY)));

        // Update boss position with speed.
        bossAsteroid.x += bossSpeedX * deltaTime;
        bossAsteroid.y += bossSpeedY * deltaTime;

        // Reverse horizontal direction when hitting the canvas edges.
        if (bossAsteroid.x < bossAsteroid.radius) {
          bossAsteroid.x = bossAsteroid.radius;
          bossSpeedX = Math.abs(bossSpeedX); // Move right.
        } else if (bossAsteroid.x > canvas.width - bossAsteroid.radius) {
          bossAsteroid.x = canvas.width - bossAsteroid.radius;
          bossSpeedX = -Math.abs(bossSpeedX); // Move left.
        }

        // Reverse vertical direction when hitting the defined vertical range.
        if (bossAsteroid.y < progressBarY + bossAsteroid.radius + 20) {
          bossAsteroid.y = progressBarY + bossAsteroid.radius + 20;
          bossSpeedY = Math.abs(bossSpeedY); // Move down.
        } else if (bossAsteroid.y > verticalLimit) {
          bossAsteroid.y = verticalLimit;
          bossSpeedY = -Math.abs(bossSpeedY); // Move up.
        }

        // Fire a single lightning bolt at regular intervals.
        if (bossFireCooldown <= 0 && bossLightningReady) {
          fireSingleLightning();
          bossFireCooldown = Math.random() * 4 + 1; // Cooldown (1-5 seconds).
        } else {
          bossFireCooldown -= deltaTime / 60; // Reduce cooldown over time.
        }

        // Reduce collision cooldown timer.
        if (bossCollisionCooldown > 0) {
          bossCollisionCooldown -= deltaTime / 60;
        }

        // Check for collision with the player.
        const distanceToPlayer = Math.hypot(targetX - bossAsteroid.x, targetY - bossAsteroid.y);
        if (distanceToPlayer < bossAsteroid.radius + targetRadius && bossCollisionCooldown <= 0) {
          if (rocketHealth > 0) {
            // Decrease health and ensure it's not below zero.
            rocketHealth -= 30; // Adjust damage as needed.
            rocketHealth = Math.max(rocketHealth, 0); // Prevent health from going negative.

            // Play rocket hit sound.
            console.log("Playing rocketHitSound...");
            rocketHitSound.currentTime = 0; // Reset to start.
            rocketHitSound.play().catch((err) => console.error("Error playing rocketHitSound:", err));

            // Trigger flashing effect.
            flashTarget();

            console.log(`Rocket Health after boss hit: ${rocketHealth}`);

            // Set collision cooldown.
            bossCollisionCooldown = 0.5; // Half-second cooldown to prevent rapid health loss.
          }

          // Only trigger game over if health is completely depleted.
          if (rocketHealth <= 0) {
              console.log("Game Over triggered by boss collision!");
              gameOver(); // Trigger game over if health is depleted.
              return; // Stop further execution to avoid multiple triggers.
          }
        }

        // Handle collision with lasers.
        laserPositions = laserPositions.filter((laser) => {
          const distance = Math.hypot(bossAsteroid.x - laser.x, bossAsteroid.y - laser.y);
          if (distance < bossAsteroid.radius) {
            bossAsteroid.currentHits++;
            createExplosion(bossAsteroid.x, bossAsteroid.y, bossAsteroid.radius / 2, 10);

            // Check if the boss is defeated.
            if (bossAsteroid.currentHits >= bossAsteroid.hitsRequired) {
              bossAsteroid.isDestroyed = true;

              // Play the explosion sound effect and fade it out.
              bossExplosionSound.currentTime = 0;
              bossExplosionSound.play().catch((err) => console.error('Error playing boss explosion sound:', err));

              // Start fade-out after playing.
              const fadeDuration = 3000; // Fade out over 3 seconds.
              const fadeInterval = 100;  // Volume adjustment interval in ms.
              const fadeStep = bossExplosionSound.volume / (fadeDuration / fadeInterval); // Calculate step size.

              const fadeOutInterval = setInterval(() => {
                  if (bossExplosionSound.volume > 0) {
                    bossExplosionSound.volume = Math.max(0, bossExplosionSound.volume - fadeStep);
                  } else {
                    clearInterval(fadeOutInterval); // Stop fading once volume reaches 0.
                    bossExplosionSound.pause();
                    bossExplosionSound.currentTime = 0; // Reset to the beginning.
                  }
              }, fadeInterval);

              // Stop the level music.
              if (gameMusic) {
                stopGameMusic();
              }

              // Trigger the explosion effect.
              createExplosion(bossAsteroid.x, bossAsteroid.y, bossAsteroid.radius, 50);
              console.log("Boss destroyed! Transitioning to victory screen...");
              // Show the victory screen after a delay.
              setTimeout(() => displayVictoryScreen(), 7000);
            }
            return false; // Remove the laser.
          }
          return true; // Keep the laser.
        });
      }
    }

    // ===========================
    // Collision Detection
    // ===========================
    /**
     * Check if the target collides with any asteroids.
     */
    function checkTargetCollision() {
      asteroids.forEach((asteroid) => {
        if (Math.hypot(asteroid.x - targetX, asteroid.y - targetY) < asteroid.radius + targetRadius) {
          if (currentLevel === 3) {
            // Decrease health and ensure it doesn't go negative.
            rocketHealth -= 15; // Adjust damage as needed for asteroid collision.
            rocketHealth = Math.max(rocketHealth, 0); // Prevent health from going negative.

            // Play the rocket hit sound.
            console.log("Playing rocketHitSound for asteroid hit...");
            rocketHitSound.currentTime = 0; // Reset to start.
            rocketHitSound.play().catch((err) => console.error("Error playing rocketHitSound:", err));

            // Trigger flashing effect.
            flashTarget();

            console.log(`Rocket Health after asteroid hit: ${rocketHealth}`);

            // Check for game over.
            if (rocketHealth <= 0) {
              console.log("Game Over triggered by asteroid collision!");
              gameOver();
            }
          } else {
            loseLife(); // For levels 1 and 2, just lose a life.
          }

          asteroid.isDestroyed = true; // Destroy the asteroid after collision.
        }
      });
    }

    // ===========================
    // Life Management Functions
    // ===========================
    function loseLife(damage = 20) {
      if (currentLevel < levels.length) {
        // Levels 1 and 2: Life-based system.
        lives--; // Decrease lives.
        lifeImages.pop(); // Remove one life icon from the top.
    
        // Reset rocket position after losing a life.
        targetX = canvas.width / 2;
        targetY = canvas.height / 2;
    
        if (lives < 0) {
          gameOver(); // End the game if no lives left.
        } else {
          console.log("Playing rocketHitSound...");
          flashSound.currentTime = 0; // Reset sound to the beginning.
          flashSound.play().catch((err) => console.error("Error playing flashSound:", err)); // Play the sound explicitly.
    
          // Flash animation after a brief delay.
          setTimeout(() => {
            flashTarget(); // Call the flashing animation.
          }, 500); // 500ms delay before flashing.
        }
      } else {
        // Level 3: Health-based system.
        rocketHealth -= damage; // Reduce health by the damage amount.
        if (rocketHealth < 0) rocketHealth = 0; // Ensure health does not drop below zero.
    
        console.log(`Rocket Health after damage: ${rocketHealth}`);
    
        if (rocketHealth <= 0) {
          gameOver(); // End the game if health reaches zero.
        } else {
          console.log("Playing damage sound...");
          flashSound.currentTime = 0; // Reset sound to the beginning.
          flashSound.play().catch((err) => console.error("Error playing flashSound:", err)); // Play the sound explicitly.
    
          // Flash animation after a brief delay.
          setTimeout(() => {
            flashTarget(); // Call the flashing animation.
          }, 500); // 500ms delay before flashing.
        }
      }
    }
  
    // ===========================
    // Flashing Effect
    // ===========================
    let flashCount = 0; // Counter for how many times to flash.
    const flashDuration = 300; // Duration of each flash in ms.
    let isFlashing = false; // Flag to indicate if flashing is in progress.

    function flashTarget(isNewLife = false) {
      if (flashCount < 3) { // Flash 3 times.
        isFlashing = true;
        flashCount++;

        if (isNewLife) {
          console.log("Playing flash sound for a new life...");
          flashSound.currentTime = 0; // Reset the time to ensure it plays from the start.
          flashSound.play().catch((err) => console.error('Error playing flash sound:', err));
          flashSound.volume = 0.4; 
        }

        // Flash target by toggling visibility.
        let flashInterval = setInterval(() => {
          targetVisible = !targetVisible;
        }, flashDuration);

        // After the flashes are complete, reset everything.
        setTimeout(() => {
          clearInterval(flashInterval);
          isFlashing = false;
          targetVisible = true; // Reset visibility to true after flashing.

          // Reset flashCount if isNewLife is true, as this signifies the beginning of a new life.
          if (isNewLife) {
            flashCount = 0;
          }
        }, flashDuration * 6); // 6 intervals (3 flashes).
      }
    }

    // ===========================
    // Rocket Health Bar Rendering
    // ===========================
    /**
     * Draw the rocket's health bar on the canvas.
     */
    function drawRocketHealthBar() {
      const barWidth = canvas.width * 0.5; // 50% of canvas width.
      const barHeight = 30; // Height of the health bar.
      const barY = canvas.height - barHeight - 100; // Move the bar up by increasing the offset.
      const textY = canvas.height - 40; // Keep the text near the bottom.

      // Calculate health percentage.
      const healthRatio = rocketHealth / maxRocketHealth;

      // Interpolate colors (green → yellow → red) based on health.
      const r = Math.min(255, Math.max(0, Math.floor(510 * (1 - healthRatio))));
      const g = Math.min(255, Math.max(0, Math.floor(510 * healthRatio)));
      const barColor = `rgb(${r}, ${g}, 0)`;

      // Draw the background (gray bar).
      ctx.fillStyle = 'gray';
      ctx.fillRect((canvas.width - barWidth) / 2, barY, barWidth, barHeight);

      // Draw the foreground (dynamic color bar based on health).
      ctx.fillStyle = barColor;
      ctx.fillRect((canvas.width - barWidth) / 2, barY, barWidth * healthRatio, barHeight);

      // Add a border for visibility.
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.strokeRect((canvas.width - barWidth) / 2, barY, barWidth, barHeight);

      // Create gradient for the label.
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
      gradient.addColorStop(0, "#001f3f"); // Deep Space Blue.
      gradient.addColorStop(0.5, "#00aced"); // Light Astral Blue.
      gradient.addColorStop(1, "#FF4136"); // Mars Red.

      // Add a "NASA" label below the bar.
      ctx.font = '60px "Nasalization", sans-serif';
      ctx.fillStyle = gradient;
      ctx.textAlign = 'center';
      ctx.fillText('NASA', canvas.width / 2, textY); // Keep the text in its original position.
    }

    /**
     * Play the rocket hit sound effect.
     */
    function playRocketHitSound() {
      rocketHitSound.currentTime = 0; // Reset sound to the beginning.
      rocketHitSound.play().catch((err) => console.error('Error playing rocket hit sound:', err));
    }
    // ===========================
    // Explosion Effects
    // ===========================
    function createExplosion(x, y, radius, duration) {
      const particles = [];
      const particleCount = 50; // Number of particles in the explosion.
      const particleLifetime = duration * 2; // Adjust this multiplier to increase how long particles stay on screen.

      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: x,
          y: y,
          angle: Math.random() * 2 * Math.PI,
          speed: Math.random() * 3 + 2, // Random speed.
          radius: Math.random() * radius * 0.1, // Random particle size.
          life: particleLifetime, // Increased lifespan for particles.
        });
      }
      
      /**
       * Draw and update explosion particles.
       */
      function drawParticles() {
        // Clear only the affected areas for better performance.
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawBackground(); // Redraw background.
        drawTarget(); // Redraw player rocket.

        particles.forEach((particle, index) => {
          if (particle.life > 0) {
            const vx = Math.cos(particle.angle) * particle.speed;
            const vy = Math.sin(particle.angle) * particle.speed;
            particle.x += vx;
            particle.y += vy;
            particle.life--;

            // Draw particle.
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, ${Math.random() * 255}, 0, ${particle.life / particleLifetime})`; // Fade out gradually.
            ctx.fill();
            ctx.closePath();
          } else {
            particles.splice(index, 1); // Remove expired particles.
          }
        });

        if (particles.length > 0) {
          requestAnimationFrame(drawParticles);
        }
      }

      drawParticles();
    }

    // ===========================
    // Game Over Handling
    // ===========================
    let isGameOver = false; // New global variable to track game over state.

    /**
     * Trigger the game over sequence.
     */
    function gameOver() {
      console.log("Game Over!");

      // Set the game over flag to true.
      isGameOver = true;
      gameOverFlag = true; // Ensure this is set.
    
      // Stop the game music and other sounds.
      gameMusic.pause();
      gameMusic.currentTime = 0;
      rocketHitSound.pause();
      rocketHitSound.currentTime = 0;

      // Stop the game loop.
      if (gameAnimationFrameId !== null) {
        cancelAnimationFrame(gameAnimationFrameId);
        gameAnimationFrameId = null;
      }

      // Clear all game objects.
      asteroids = [];
      laserPositions = [];
      bossAsteroid = null;
      bossProjectiles = [];

      // Clear the canvas.
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw "Game Over" text.
      ctx.font = '140px "Nasalization", sans-serif';
      ctx.fillStyle = 'red';
      ctx.textAlign = 'center';
      ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2);

      // Play game over sound.
      gameOverSound.play().catch((err) => console.error('Error playing game over sound:', err));

      // Reload the game after a delay.
      setTimeout(() => {
        location.reload();
      }, 10000); // Adjust delay to match the game over sound duration.
    }

    /**
     * Check if the game is over based on lives.
     */
    function checkGameOver() {
      if (lives <= 0) { // If no more lives left...
        gameOver(); // Call game over function.
      }
    }

    // ===========================
    // Victory Screen Display
    // ===========================
    /**
     * Display the victory screen with animations and sounds.
     */
    async function displayVictoryScreen() {
      if (victoryScreenActive) {
        console.log("Victory screen already active. Skipping duplicate call.");
        return;
      }
      console.log("Displaying victory screen...");
      victoryScreenActive = true;

      // Stop the game music.
      gameMusic.pause();
      gameMusic.currentTime = 0;

      // Play victory music.
      victoryMusic.play();

      // Cancel the game loop.
      if (gameAnimationFrameId !== null) {
        cancelAnimationFrame(gameAnimationFrameId);
        console.log("Game loop paused.");
      }

      // Create a video element.
      const videoElement = document.createElement("video");
      videoElement.style.display = "none"; // Hide the video element; it will be drawn to the canvas.
      videoElement.src = "assets/video/video.mp4"; // Replace with video source.
      videoElement.loop = true;
      videoElement.muted = true;

      // Wait for the video to load metadata.
      videoElement.addEventListener("loadedmetadata", () => {
        if (videoElement.duration > 45) {
          videoElement.currentTime = 45; // Start at 45 seconds.
        }
        videoElement.play();
      });

      videoElement.addEventListener("error", () => {
        console.error("Failed to load the video.");
      });

      // Append the video to the document.
      document.body.appendChild(videoElement);

      // Animate the video and text.
      let frameCount = 0;

      /**
       * Draw the victory screen with video background and animated text.
       */
      function drawVictoryScreen() {
        // Clear the canvas and draw the background video.
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    
        // Handle continuous input for laser angle and firing.
        if (keys[37]) { // Left arrow key.
          laserAngle -= Math.PI / 180; // Rotate lasers left by 1 degree per frame.
        }
        if (keys[39]) { // Right arrow key.
          laserAngle += Math.PI / 180; // Rotate lasers right by 1 degree per frame.
        }
        if (keys[32]) { // Spacebar key.
          fireVictoryLaser(); // Fire lasers while spacebar is held down.
        }
  
        // Define maximum fade distance for lasers.
        const maxFadeDistance = Math.sqrt(canvas.width ** 2 + canvas.height ** 2);

        // Draw lasers fired during the victory screen.
        lasersOnVictoryScreen = lasersOnVictoryScreen.filter((laser) => {
          // Update laser position based on its angle.
          // Moves the laser in its designated direction by its speed.
          laser.x += Math.cos(laser.angle) * laser.speed;
          laser.y += Math.sin(laser.angle) * laser.speed;

          const vanishingPoint = { x: canvas.width / 2, y: canvas.height / 1.5 }; // Vanishing point.
          const distance = Math.hypot(laser.x - vanishingPoint.x, laser.y - vanishingPoint.y); // Modify the distance calculation to make lasers converge towards a specific vanishing point.

          // Calculate the fading factor based on distance.
          // Taper factor decreases linearly as the laser gets farther from the center.
          const taperFactor = Math.max(0, 1 - distance / (maxFadeDistance * 0.35)); // Reduce maxFadeDistance multiplier to fade sooner.  1 means fully visible, 0 means fully faded.

          // Remove lasers that are off-screen or fully faded.
          if (taperFactor <= 0) {
            return false; // Laser is too far or fully faded, so remove it.
          }

          // Laser width based on fading transparency.
          // StartWidth controls the initial thickness of the laser, which decreases with distance.
          const startWidth = 6 * taperFactor; // Laser width decreases as it travels farther.
          const endWidth = 0.5 * taperFactor; // End width ensures the laser is thinner near its end.

          // Alpha transparency (opacity) of the laser.
          // Ensures the laser fades gradually as it travels outward.
          const alpha = Math.max(0.1, taperFactor); // Minimum opacity of 0.1 to ensure it doesn't disappear too quickly.

          // Draw the laser with fading effect.
          ctx.strokeStyle = `rgba(50, 255, 50, ${alpha})`; // Bright green laser with transparency.
          ctx.lineWidth = startWidth * taperFactor + (1 - taperFactor) * endWidth; // Interpolates between startWidth and endWidth.
          ctx.beginPath();
          ctx.moveTo(laser.x, laser.y); // Start of the laser.
          ctx.lineTo(
            laser.x - Math.cos(laser.angle) * 20, // Calculate the end point of the laser (20px from its current position).
            laser.y - Math.sin(laser.angle) * 20
          );
          ctx.stroke();
          ctx.closePath();

          return true; // Keep the laser in the array (still visible or within the fading range).
        });

        // Draw the victory message.
        const baseHue = (frameCount * 2) % 360; // Animate the gradient hue.
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
        gradient.addColorStop(0, `hsl(${baseHue}, 100%, 50%)`);
        gradient.addColorStop(0.5, `hsl(${(baseHue + 120) % 360}, 100%, 50%)`);
        gradient.addColorStop(1, `hsl(${(baseHue + 240) % 360}, 100%, 50%)`);
    
        ctx.font = '150px "Nasalization", sans-serif';
        ctx.fillStyle = gradient;
        ctx.textAlign = "center";
        ctx.fillText("CONGRATULATIONS!!", canvas.width / 2, canvas.height / 2 - 60);
    
        // Blinking text below the victory message.
        if (frameCount % 60 < 30) {
          ctx.font = '35px "Nasalization", sans-serif';
          ctx.fillStyle = "white";
          ctx.fillText("CELEBRATE WITH YOUR LASERS!", canvas.width / 2, canvas.height / 2 + 40);
        }
        // Request the next animation frame.
        frameCount++;
        requestAnimationFrame(drawVictoryScreen);
      }
  
      // Start drawing the victory screen.
      drawVictoryScreen();
      // Fade out music before resetting.
      // ===========================
      // Music Fade Out Function
      // ===========================
      let fadeInterval = null; // Store fade-out interval globally to manage overlapping.

      function fadeOutMusic(audio, duration, callback) {
        if (fadeInterval) clearInterval(fadeInterval); // Stop any ongoing fade-out.

        const step = 0.04; // Step size for volume reduction.
        const interval = duration / (audio.volume / step); // Time between steps.

        fadeInterval = setInterval(() => {
          if (audio.volume > 0) {
            audio.volume = Math.max(0, audio.volume - step); // Reduce volume.
          } else {
            clearInterval(fadeInterval); // Stop fade-out.
            fadeInterval = null; // Reset interval.
            if (callback) callback(); // Call optional callback.
          }
        }, interval);
      }
  
      // Schedule music fade out and cleanup.
      setTimeout(() => {
        fadeOutMusic(victoryMusic, 12000, () => {
          console.log("Music faded out.");
        });
        }, 55000); // Start fade out 55 seconds after victory screen starts.

      // Stop and reset the flash sound.
      flashSound.pause(); 
      flashSound.currentTime = 0;
    
      // Reset scene after victory screen.
      setTimeout(() => {
        console.log("Resetting scene...");
        victoryScreenActive = false; // Allow re-triggering if necessary.
      playTitleMusic(); // Start title music for the next screen.
        location.reload(); // Reload the game.
      }, 65000); // Reset after 65 seconds.
    }

    // ===========================
    // Drawing Extra Lives
    // ===========================
    /**
     * Draw extra lives icons at the top of the screen.
     */
    function drawLives() {
      if (currentLevel === levels.length) {
        // Do not draw extra lives for Level 3 (boss level).
        return;
      }

      const iconWidth = 50; // Size of the extra lives icons.
      const iconHeight = 90; 
      const margin = 10; // Space between extra lives icons.
      
      // Calculate the total width of all extra lives icons and spaces between them.
      const totalWidth = lives * iconWidth + (lives - 1) * margin;
      
      // Calculate the starting X position to center the extra lives.
      let startX = (canvas.width - totalWidth) / 2; 
      //console.log(`Drawing ${lifeImages.length} lives starting at X: ${startX}, Y: 20`);

      // Draw each extra life icon.
      lifeImages.forEach((_, index) => {
        ctx.drawImage(targetImage, startX + (iconWidth + margin) * index, 20, iconWidth, iconHeight);
      });
    }

    // ===========================
    // Weapon Firing Mechanism
    // ===========================
    /**
     * Fire the player's weapon (laser).
     */
    function fireWeapon() {
      // Prevent firing if the game is over, the victory screen is active, or the title screen is being displayed.
      if (gameOverFlag || !gameStarted || isGameOver) {
        return;
      }

      // Play the laser firing sound.
      laserSound.currentTime = 0; // Reset to the start (allow rapid-fire sounds).
      laserSound.play().catch((err) => console.error('Error playing laser sound:', err));
      laserSound.volume = 0.5; // Set volume between 0.0 (mute) and 1.0 (max).

      // Recompute the rocket's drawn size to match drawTarget():
      const scaledWidth  = targetRadius * 4 * rocketScaleX;
      const scaledHeight = targetRadius * 4 * rocketScaleY;

      // Calculate laser's starting position at the top center of the rocket.
      const laserX = targetX;  
      const laserY = targetY - (scaledHeight / 2) + 10; // 10px offset above the top.

      laserPositions.push({
        x: laserX,
        y: laserY,
      });
    }


    // ===========================
    // Laser Update and Drawing
    // ===========================
    // Update the positions and states of all lasers.
    function updateLasers(deltaTime) {
      laserPositions = laserPositions.filter((laser) => {
        laser.y -= laserSpeed * deltaTime;
        let hit = false;

        asteroids.forEach((asteroid) => {
          if (!asteroid.isDestroyed && checkLaserHit(laser, asteroid)) {
            hit = true;
          }
        });

        if (hit || laser.y <= 0) return false; // Remove laser if off-screen or hit.
        drawLaser(laser);
        return true;
      });
    }

    // Draw an individual laser on the canvas.
    function drawLaser(laser) {
      let laserColor = 'lime'; // Default color.

      ctx.beginPath();
      ctx.moveTo(laser.x, laser.y);
      ctx.lineTo(laser.x, laser.y - 15);
      ctx.strokeStyle = laserColor;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.closePath();
    }

    // Check laser hit (collision with asteroid).
    function checkLaserHit(laser, asteroid) {
      const hit = Math.hypot(asteroid.x - laser.x, asteroid.y - laser.y) < asteroid.radius;

      if (hit) {
        // Check if the hit asteroid is the boss.
        if (bossAsteroid && !bossAsteroid.isDestroyed && asteroid === bossAsteroid) {
          if (bossHitCooldown <= 0) { // Check if cooldown has expired.
            bossHitCooldown = BOSS_HIT_COOLDOWN_DURATION; // Reset cooldown.
            // Handle boss asteroid hit.
            bossAsteroid.hitsRequired--;
            bossAsteroid.bossHitFlashTime = 10; // Flash for 10 frames.
                
            // Trigger hit feedback.
            createExplosion(bossAsteroid.x, bossAsteroid.y, bossAsteroid.radius, 10); // Smaller explosion on hit.
            bossAsteroid.radius *= 0.98; // Slight shrink on hit.

            // Play hit sound.
            hitSound.currentTime = 0;
            hitSound.play().catch((err) => console.error("Error playing hit sound:", err));

            // Check if the boss is defeated.
            if (bossAsteroid.hitsRequired <= 0) {
              bossAsteroid.isDestroyed = true;

              // Trigger a large explosion for the boss.
              createExplosion(bossAsteroid.x, bossAsteroid.y, bossAsteroid.radius, 50);
              bossExplosionSound.currentTime = 0;
              bossExplosionSound.play().catch((err) => console.error("Error playing destroy sound:", err));

              // Trigger scattered explosions across the screen.
              for (let i = 0; i < 30; i++) {
                const randomX = Math.random() * canvas.width;
                const randomY = Math.random() * canvas.height;
                createExplosion(randomX, randomY, Math.random() * 20 + 10, Math.random() * 15 + 10);
              }

              // Stop the level music.
              if (gameMusic) {
                stopGameMusic();
              }

              // Wait before transitioning to the victory screen.
              setTimeout(() => {
                displayVictoryScreen();
              }, 3000); // Adjust the delay as needed to see the explosion.
            }
          }
        } else {
          // Handle regular asteroid or satellite hit.
          asteroid.hits++;
          asteroid.hitFlashTime = 10; // Flash effect on hit.
        
          if (asteroid.hits >= 5) {
            asteroid.isDestroyed = true;
            asteroidsDestroyed++; // Increment destroyed count.
            
            // On level 3, reduce boss health by 1% if an asteroid or satellite is destroyed.
            if (currentLevel === 3 && bossAsteroid && !bossAsteroid.isDestroyed) {
              const bossHealthReduction = bossAsteroid.hitsRequired * 0.01; // 1% of total health.
              bossAsteroid.currentHits = Math.min(
                bossAsteroid.currentHits + bossHealthReduction,
                bossAsteroid.hitsRequired
              );
              console.log(
                `Boss health reduced by 1% due to asteroid/satellite destruction. Current health: ${bossAsteroid.hitsRequired - bossAsteroid.currentHits}`
              );
              // Immediately check if the boss is defeated.
              if (bossAsteroid.currentHits >= bossAsteroid.hitsRequired) {
                bossAsteroid.currentHits = bossAsteroid.hitsRequired; // Ensure health doesn't go over the max.
                bossAsteroid.isDestroyed = true;

                console.log("Boss defeated by asteroid hit!");

                // Trigger boss explosion and scattered explosions.
                createExplosion(bossAsteroid.x, bossAsteroid.y, bossAsteroid.radius, 50);
                bossExplosionSound.currentTime = 0;
                bossExplosionSound.play().catch((err) => console.error("Error playing destroy sound:", err));
                // Stop the level music.
                if (gameMusic) {
                  stopGameMusic();
                }
                setTimeout(() => {
                    displayVictoryScreen();
                }, 3000); // Delay before displaying the victory screen.
              }
            }

            // Trigger a smaller explosion for asteroids/satellites.
            createExplosion(asteroid.x, asteroid.y, asteroid.radius, 15);

            // Play destroy sound.
            destroySound.currentTime = 0;
            destroySound.play().catch((err) => console.error("Error playing destroy sound:", err));
          }

          // Play hit sound for regular asteroid/satellite hits.
          hitSound.currentTime = 0;
          hitSound.play().catch((err) => console.error("Error playing hit sound:", err));
        }
      }  

      return hit;
    }

    // ===========================
    // Counters and Labels Rendering
    // ===========================
    /**
     * Draw counters for "Destroyed" and "Remaining" on the canvas.
     */
    function drawCounters() {
      const marginPercentage = 5;  // Use 5% of the canvas width as margin.
      const marginLeft = canvas.width * (marginPercentage / 100);
      const marginRight = canvas.width - marginLeft;

      // Use a neon glow effect.
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
      gradient.addColorStop(0, 'cyan');
      gradient.addColorStop(0.5, 'magenta');
      gradient.addColorStop(1, 'yellow');
      ctx.font = '60px "Nasalization", sans-serif';
      ctx.fillStyle = gradient;

      if (currentLevel === levels.length) {
        // Boss level logic, centered text...
      } else {
        // Regular level logic with adaptive positions.
        const remainingAsteroids = targetAsteroids - asteroidsDestroyed;

        // For responsiveness, base positions on canvas width and height.
        const centerX = canvas.width / 2;
        const topSection = canvas.height * 0.07; // 7% from the top, adjust as needed.

        ctx.font = '80px "Nasalization", sans-serif'; // Ensure the font is loaded and consistent.  Double check on other systems for Nasalization.
        ctx.textAlign = 'center';

        // --- Destroyed Counter ---
        // "Destroyed: [number]" a bit left of center.
        const destroyedLabel = "Destroyed: ";
        const destroyedX = centerX - (canvas.width * 0.25); // Anchor position for the label.

        // Measure the label width.
        const labelMetrics = ctx.measureText(destroyedLabel);
        const labelWidth = labelMetrics.width;

        // Draw the label centered around destroyedX.
        ctx.fillText(destroyedLabel, destroyedX, topSection);

        // Place the number immediately after the label with spacing.
        const spacing = 30; // A small gap between label and number.
        const numberX = destroyedX + (labelWidth / 2) + spacing;
        ctx.fillText(asteroidsDestroyed.toString(), numberX, topSection);

        // --- Remaining Counter ---
        // Same for "Remaining:" on the right side.
        const remainingLabel = "Remaining: ";
        const remainingX = centerX + (canvas.width * 0.25);

        const remainingMetrics = ctx.measureText(remainingLabel);
        const remainingLabelWidth = remainingMetrics.width;

        ctx.fillText(remainingLabel, remainingX, topSection);

        // Place the remaining number after the remaining label.
        const remainingNumberX = remainingX + (remainingLabelWidth / 2) + spacing;
        ctx.fillText(remainingAsteroids.toString(), remainingNumberX, topSection);
      } 
    }
    // ===========================
    // Event Handlers
    // ===========================
    function handleKeyDown(e) {
      keys[e.keyCode] = true; // Track key state.

      console.log(`Key pressed: ${e.keyCode}`);

      if (victoryScreenActive) {
        console.log("Victory screen key handling triggered.");

        if (e.keyCode === 37) { // Left arrow key to adjust laser angle.
          laserAngle -= Math.PI / 18; // Decrease angle (10 degrees).
          console.log(`Laser angle adjusted left to ${laserAngle}`);
        } else if (e.keyCode === 39) { // Right arrow key to adjust laser angle.
          laserAngle += Math.PI / 18; // Increase angle (10 degrees).
          console.log(`Laser angle adjusted right to ${laserAngle}`);
        } else if (e.keyCode === 32) { // Spacebar to fire lasers on victory screen.
          e.preventDefault();
          console.log("Spacebar pressed to fire laser.");
          fireVictoryLaser();
        }
        return; // Do not process further if on the victory screen.
      }

      if (!gameStarted) {
        console.log("Not in game, handling title screen input.");
        if (e.keyCode === 32) { // Spacebar to start the game.
          e.preventDefault();
          stopTitleMusic();
          loadLevel(1);
          console.log("Starting Level 1...");
          gameStarted = true;
        
          
          if (starsAnimationFrameId !== null) {
            cancelAnimationFrame(starsAnimationFrameId);
            starsAnimationFrameId = null;
          }
          
          requestAnimationFrame(gameLoop);
        }
        return;
      }

      if (gameOverFlag) {
        console.log("Game over, no input allowed.");
        return;
      }

      if (e.keyCode === 32) { // Spacebar to fire in-game weapon.
        fireWeapon();
      }
    }

      let lastFireTime = 0; // Timestamp of the last laser fired.
      const fireCooldown = 200; // Minimum time between lasers in milliseconds.

    function fireVictoryLaser() {
      if (!victoryScreenActive) {
        console.warn("Victory screen not active, cannot fire laser.");
        return; 
      }
      const now = Date.now(); // Current time in milliseconds.
      if (now - lastFireTime < fireCooldown) {
        return; // Too soon to fire another laser.
      }
      lastFireTime = now; // Update the last fire time.
      console.log("Victory laser fired!");

      laserSound.currentTime = 0;
      laserSound.play().catch((err) => console.error("Error playing laser sound:", err));

      lasersOnVictoryScreen.push({
        x: canvas.width / 2, // Starting at center of screen.
        y: canvas.height / 2,
        angle: laserAngle || 0, // Direction based on user input.
        speed: 10, // Base speed.
        scale: 1 // Initial scale for the laser (1 = full size).
      });
      console.log("Lasers array updated:", lasersOnVictoryScreen);
    }

    // Handle key up events (stop movement).
    function handleKeyUp(e) {
      keys[e.keyCode] = false;
    }

    function updatePosition(deltaTime) {
      if (rocketFrozen) return;

      const uiBoundaryHeight = 150; // Height of the top UI elements (counters, extra lives, etc.).
      const nasaHealthBarHeight = 150; // Height of the NASA health bar at the bottom.

      if (victoryScreenActive) {
        // Adjust laser angle during the victory screen.
        if (keys[37] || keys[74]) { // Left Arrow or 'J'
          laserAngle -= Math.PI / 180; // Rotate lasers left.
        }
        if (keys[39] || keys[76]) { // Right Arrow or 'L'
          laserAngle += Math.PI / 180; // Rotate lasers right.
        }
        if (keys[32]) { // Spacebar for firing lasers.
          fireVictoryLaser();
        }
      } else {
          // Regular game movement logic.
          if (keys[37] || keys[74]) { // Left Arrow or 'J'
            targetX = Math.max(0, targetX - moveStep * deltaTime);
          }
          if (keys[39] || keys[76]) { // Right Arrow or 'L'
            targetX = Math.min(canvas.width, targetX + moveStep * deltaTime);
          }
          if (keys[38] || keys[73]) { // Up Arrow or 'I'
            targetY = Math.max(uiBoundaryHeight + targetRadius, targetY - moveStep * deltaTime); // Prevent flying behind top UI.
          }
          if (keys[40] || keys[75]) { // Down Arrow or 'K'
            if (currentLevel === 3) {
              // Level 3: Prevent flying behind the NASA health bar.
              targetY = Math.min(canvas.height - nasaHealthBarHeight - targetRadius, targetY + moveStep * deltaTime);
            } else {
              // Levels 1 & 2: Allow full bottom movement.
              targetY = Math.min(canvas.height - targetRadius, targetY + moveStep * deltaTime);
            }
          }
        }
    }

    // Draw background.
    function drawBackground() {
      if (imagesLoaded.background) {
        ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
      }
    } 

      // Define scaling factors.
      const rocketScaleX = 0.8; // Adjust as needed (e.g., 0.6 for skinnier width).
      const rocketScaleY = 1.5; // Adjust as needed (e.g., 1.5 for longer height).

    // Draw target (rocket) with separate width and height scaling.
    function drawTarget() {
      // Bail out if game over or rocket hidden
      if (gameOverFlag || !targetVisible) {
        return;
      }

      // Compute these here so they're always in scope
      const scaledWidth  = targetRadius * 4 * rocketScaleX;
      const scaledHeight = targetRadius * 4 * rocketScaleY;

      // Draw the rocket centered on (targetX, targetY)
      ctx.drawImage(
        targetImage,
        targetX - scaledWidth  / 2,
        targetY - scaledHeight / 2,
        scaledWidth,
        scaledHeight
      );
    }


      let lastTime = 0;

      // Variable to track if the level text should be displayed and for how long.
      let levelText = '';
      let levelTextDisplayTime = 0; // Time remaining to display the level text (in frames).

    // Function to trigger the display of level text.
    function showLevelText(text) {
      levelText = text;
      levelTextDisplayTime = 240; // Display for 3 seconds (assuming 60fps).
    }

    // Function to draw the level transition text (called within the game loop).
    function drawLevelOverlayText() {
      if (levelTextDisplayTime > 0) {
        // Save the current context state.
        ctx.save();

        // Create a gradient for the text.
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
        gradient.addColorStop(0, "orange");
        gradient.addColorStop(1, "yellow");
        gradient.addColorStop(.5, "red");


        // Text styles.
        ctx.font = '120px "Nasalization", sans-serif'; // Retro font with larger size.
        ctx.fillStyle = gradient;
        ctx.textAlign = 'center';
        ctx.shadowColor = "black";
        ctx.shadowBlur = 10; // Subtle glow effect.

        // Animate the text with a slight pulsing effect.
        const scale = 1 + Math.sin((180 - levelTextDisplayTime) / 10) * 0.05; // Pulsing animation.
        ctx.translate(canvas.width / 2, canvas.height / 2 - 40); // Move to canvas center.
        ctx.scale(scale, scale); // Apply scaling effect.
        ctx.fillStyle = gradient; // Reapply gradient after box.
        ctx.fillText(levelText, 0, 0); // Draw centered text .
        ctx.strokeStyle = "black";
        ctx.lineWidth = 3;
        ctx.strokeText(levelText, 0, 0); // Add an outline for visibility.

        // Restore the context state.
        ctx.restore();

        // Reduce the display time.
        levelTextDisplayTime--;
      }
    }


    // Modify the game loop to include the level text overlay.
    function gameLoop(timestamp) {
      if (isGameOver) {
        // Clear the canvas and display the Game Over screen.
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw the "Game Over" text.
        ctx.font = '140px "Nasalization", sans-serif';
        ctx.fillStyle = 'red';
        ctx.textAlign = 'center';
        ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2);

        return; // Exit the loop and prevent further updates.
      }

      if (!lastTime) {
        lastTime = timestamp;
      }

      let deltaTime = (timestamp - lastTime) / 16.67; // Convert to approximate frames at 60fps.
      lastTime = timestamp;

      // Limit deltaTime to prevent large jumps.
      const maxTimeStep = 2.5;
      deltaTime = Math.min(deltaTime, maxTimeStep);

      // Handle rocket freeze logic.
      if (rocketFrozen) {
        rocketFreezeTimer -= deltaTime / 60; // Decrease the freeze timer.
        if (rocketFreezeTimer <= 0) {
          rocketFrozen = false; // Unfreeze the rocket when the timer expires.
        }
      }

      if (!gameStarted) {
        drawTitleScreen();
        updateStars(); // Update star positions or states.
        drawStars(); // Render stars.
        return; // Exit the loop after rendering the title screen.
      }

      // Clear the canvas at the start of each frame.
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw the background.
      drawBackground();

      // Update the rocket's position if the game is not frozen and not over.
      if (!rocketFrozen && !isGameOver) {
        updatePosition(deltaTime); // Allow movement only when the rocket isn't frozen.
      }

      // Update and render game elements for the boss level.
      if (currentLevel === levels.length) {
        if (bossAsteroid && !bossAsteroid.isDestroyed) {
          drawBossAsteroid();
          updateBossAsteroid(deltaTime);
          updateBossProjectiles(deltaTime);
          updateAsteroids(deltaTime);
          updateLasers(deltaTime);

          drawLives();
          drawBossHealthBar();
          drawRocketHealthBar();
        } else if (bossAsteroid && bossAsteroid.isDestroyed) {
          setTimeout(() => displayVictoryScreen(), 3000);
          return;
        }
      } else {
        // Regular levels.
        if (asteroidsDestroyed >= targetAsteroids && currentLevel < levels.length) {
          currentLevel++;
          loadLevel(currentLevel);
          showLevelText(`Level ${currentLevel}`);
        }

        updateLasers(deltaTime);
        updateAsteroids(deltaTime);
      }

      // Draw the rocket only if the game is not over.
      if (!isGameOver) {
        drawTarget();
      }

      // Check collisions and draw lives only if the game is not over.
      if (!gameOverFlag) {
        checkTargetCollision();
        drawLives();
      }

      // Spawn asteroids randomly.
      if (Math.random() < 0.02) {
        spawnAsteroid();
      }

      // Draw counters and level overlay text.
      drawCounters();
      drawLevelOverlayText();

      gameAnimationFrameId = requestAnimationFrame(gameLoop);
    }

      // Event listeners.
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('keyup', handleKeyUp);
      
      console.log("Page loaded!");
});