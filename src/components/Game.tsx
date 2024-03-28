import { FormEvent, useEffect, useRef, useState } from 'react';

// PixiJs
import { Application, Assets, Sprite, AnimatedSprite, Texture, Container } from 'pixi.js';
import { AdjustmentFilter, CRTFilter, GlitchFilter } from 'pixi-filters';

import { generateStars, generateStar } from '../generateStars.ts';
import { fetchHighScores, postHighScore, Score } from '../highscores.ts';



interface Bullet extends Sprite {
    speed: number;
    damage: number;
}

interface Enemy extends Sprite {
    type: string;
    hp: number;
    speed: number;
    points: number;
}

interface DeltaTime {
    lastTime: number;
}

interface EnemyType {
    type: string;
    hp: number;
    maxSpeed: number;
    points: number;
}

const enemyTypes: EnemyType[] = [
    {
        type: 'standard',
        hp: 1,
        maxSpeed: 3,
        points: 1,
    },
    {
        type: 'large',
        hp: 4,
        maxSpeed: 1,
        points: 5,
    },
]

export default function Game() {

    // Test For Hit
    // A basic AABB check between two different squares
    function testForAABB(object1: any, object2: any) {
        try {
            const bounds1 = object1.getBounds();
            const bounds2 = object2.getBounds();

            return (
                bounds1.x < bounds2.x + bounds2.width
                && bounds1.x + bounds1.width > bounds2.x
                && bounds1.y < bounds2.y + bounds2.height
                && bounds1.y + bounds1.height > bounds2.y
            );
        }
        catch (error) {
            return false;
        }
    }

    try {

        const [shieldActive, setShieldActive] = useState<boolean>(true);
        const [scoreState, setScoreState] = useState<number>(0);
        const [playerHpState, setPlayerHpState] = useState<number>(3);
        const [gameRunningState, setGameRunningState] = useState<boolean>(false);
        const [gameOverState, setGameOverState] = useState<boolean>(false);
        const [highscores, setHighscores] = useState<Score[]>([]);
        const [newHighscoreName, setNewHighscoreName] = useState<string>('');
        const [isNewHighscoreState, setIsNewHighscoreState] = useState<boolean>(false);
        const [highscoreSubmitted, setHighscoreSubmitted] = useState<boolean>(false);
        const [showLoadScreen, setShowLoadScreen ] = useState<boolean>(true);

        /**
         * State used for UI elements outside the game. The same is reflected in variables below,
         * as I'm having issues with pixijs being able to read the current state within the game loop.
         * */
        let enemies: any[] = [];
        let player: any = {};
        let bullets: any[] = [];
        let stars: any[] = [];
        let shield: any = {};
        let playerHp = 3;
        let powerups: any[] = [];
        let planets: any[] = [];
        let score = 0;

        let fireRate = 250;

        let lastEnemySpawn = 0;
        let lastStarSpawn = 0;
        let lastBulletFire = 0;

        let gameRunning = false;
        let gameOver = false;        

        let crtFilter: CRTFilter;


        const explosionTextures: any[] = [];

        const gameCanvas = useRef<HTMLDivElement>(null);

        const fireBullet = (app: Application) => {
            const bullet = createBullet();
            app.stage.addChild(bullet);
            bullets.push(bullet);
        }

        const getRandomSpawnXPosition = (app: Application, attempts: number = 10): number => {
            const enemiesNearSpawn = enemies.filter(e => {
                if (e.destroyed) {
                    return false;
                }
                return (e.y <= e.height * 2);
            });
            const enemyXPositions = enemiesNearSpawn.map(e => Math.floor(e.x));

            const randX = Math.floor(Math.random() * app.screen.width);
            if (!enemyXPositions.includes(randX)) {
                return randX;
            }

            if (attempts <= 0) {
                return 0;
            }

            return getRandomSpawnXPosition(app, attempts - 1);
        }

        const spawnEnemy = (app: Application) => {
            let type = 'standard';

            if (Math.random() * 10 >= 8) {
                type = 'large';
            }

            const enemy = createEnemy(getRandomSpawnXPosition(app), 0, type);

            app.stage.addChild(enemy);
            enemies.push(enemy);
        }

        /**
         * Create Enemy 
         * @param x
         * @param y
         * @param type 
         * @returns Enemy
         */
        const createEnemy = (x: number, y: number, type: string) => {

            const enemyTypeSettings = enemyTypes.find(e => e.type === type) || { type: 'standard', hp: 1, maxSpeed: 3, points: 1 };
            const enemy = Sprite.from('/enemy.jpg') as Enemy;
            enemy.type = enemyTypeSettings.type;
            enemy.x = x;
            enemy.y = y - (enemy.height);
            enemy.hp = enemyTypeSettings.hp;
            enemy.points = enemyTypeSettings.points;
            enemy.speed = Math.ceil(Math.random() * enemyTypeSettings.maxSpeed);
            enemy.anchor.set(0.5);

            if (enemyTypeSettings.type === 'large') {
                enemy.scale.set(3);
            }

            return enemy;
        }

        /**
         * Create Bullet
         * @returns void
         */
        const createBullet = () => {
            const bullet = Sprite.from('/bullet.png') as Bullet;
            bullet.x = player.x;
            bullet.y = player.y;
            bullet.anchor.set(0.5);
            bullet.speed = 5;

            return bullet;
        }


        /**
         * Move enemies
         */
        const moveEnemies = (app: Application) => {

            enemies.forEach(enemy => {

                if (!enemy.destroyed) {
                    enemy.y += enemy.speed;

                    if ((enemy.y - enemy.height) > app.screen.height) {
                        enemy.destroy();
                    }
                }
            });
        }

        const movePowerups = (app: Application) => {
            powerups.forEach(powerup => {
                if (!powerup.destroyed) {
                    powerup.y += 1;

                    if ((powerup.y - powerup.height) > app.screen.height) {
                        powerup.destroy();
                    }
                }
            });
        }


        const moveBullets = (app: Application) => {
            bullets.forEach(bullet => {


                if (!bullet.destroyed) {

                    bullet.y -= bullet.speed;

                    if ((bullet.y + bullet.height) <= 0) {
                        bullet.destroy();
                    }
                    else {
                        enemies.forEach(enemy => {
                            if (!enemy.destroyed) {

                                const hit = testForAABB(bullet, enemy);

                                if (hit) {
                                    bullet.destroy();
                                    enemy.hp -= 1;

                                    const damageFilter = new AdjustmentFilter({
                                        red: 5
                                    });

                                    if (enemy.hp === 0) {
                                        // Create an explosion AnimatedSprite
                                        explode(app, enemy.x, enemy.y);
                                        maybeSpawnPowerup(app, enemy.x, enemy.y);
                                        enemy.destroy();
                                        setScoreState(prev => prev + enemy.points);
                                        score += enemy.points;

                                    }
                                    else {
                                        enemy.filters = [damageFilter];
                                        setTimeout(() => {
                                            enemy.filters = [];
                                        }, 150);
                                    }
                                }
                            }
                        });
                    }

                }

            });
        }

        const maybeSpawnPowerup = (app: Application, x: number, y: number) => {
            if (Math.random() * 100 > 95) {
                const powerup = Sprite.from('/shieldPowerup.png');
                powerup.x = x;
                powerup.y = y;
                app.stage.addChild(powerup);
                powerups.push(powerup);
            }
        }

        /**
         * Move stars
         * @param app 
         */
        const moveStars = (app: Application) => {
            stars.forEach(star => {
                if (!star.destroyed) {
                    star.y += star.speed;

                    if ((star.y - star.height) > app.screen.height) {
                        star.destroy();
                    }

                }
            });
        }

        /**
         * Move planets
         * @param app 
         */
        const movePlanets = (app: Application) => {
            planets.forEach(planet => {
                if (!planet.destroyed) {
                    planet.y += 1;

                    if ((planet.y - planet.height) > app.screen.height) {
                        planet.destroy();
                    }

                }
            });
        }

        /**
         * Take player damage
         * @param damage 
         */
        const takeDamage = (damage: number) => {
            console.log('Take ' + damage + ' damage');
            setPlayerHpState(prev => {
                return prev - damage
            });
            playerHp -= damage;

            if (playerHp <= 0) {
                gameRunning = false;
                gameOver = true;
                setGameOverState(true);
                setGameRunningState(false);
            }
        }

        /**
         * Move the playeer
         * @param app 
         * @param e 
         */
        const movePlayer = (app: Application, e: any) => {
            if (gameRunning) {
                let pos = e.data.global;
                player.x = pos.x;

                // Position the player above / in front the cursor (otherwise it's obscured by your finger on mobile )
                player.y = pos.y - player.height;

                powerups.forEach(powerup => {
                    try {
                        const hit = testForAABB(player, powerup);
                        if (hit) {
                            powerup.destroy();
                            shield.alpha = 1;
                            setShieldActive(true);
                        }
                    }
                    catch (error) {

                    }
                });

                // Collisio Detection
                enemies.forEach(enemy => {
                    try {
                        const hit = testForAABB(player, enemy);
                        if (hit) {
                            explode(app, player.x, player.y);
                            enemy.destroy();

                            if (shield.alpha === 1) {
                                setShieldActive(false);
                                shield.alpha = 0;
                                /*setTimeout(() => {
                                    shield.alpha = 1;
                                    setShieldActive(true);
                                }, 2000);*/
                            }
                            else {
                                takeDamage(1);
                            }
                        }
                    }
                    catch (error) {
                        return;
                    }
                });
            }
        }

        const explode = (app: Application, x: number, y: number) => {
            const explosion = new AnimatedSprite(explosionTextures);
            explosion.x = x;
            explosion.y = y;
            explosion.anchor.set(0.5);
            explosion.loop = false;
            explosion.scale.set(1);
            explosion.gotoAndPlay(0);
            explosion.on('complete', (explosion) => {
                explosion.destroy();
            });
            app.stage.addChild(explosion);
        }

        const restart = () => {

            setPlayerHpState(10);
            playerHp = 10;

            setGameOverState(false);
            gameOver = false;

            setScoreState(0);
            score = 0;

            setNewHighscoreName('');
            setIsNewHighscoreState(false);

            enemies.forEach((enemy) => {
                enemy.destroy();
            })
            enemies = [];
            bullets.forEach((bullet) => {
                bullet.destroy();
            });
            bullets = [];
        }

        useEffect(() => {
            console.log('Set game running state', gameRunningState);
        }, [gameRunningState]);


        /**
         * On first load
         */
        useEffect(() => {

            const app = new Application();

            document.addEventListener("visibilitychange", () => {
                if (document.hidden) {
                    gameRunning = false;
                    setGameRunningState(false);
                } else {
                }
            });

            /**
             * Game Loop! Where most magic happens
             * @param delta 
             */
            const gameLoop = (delta: DeltaTime) => {

                if (gameRunning) {

                    // Clean up destroyed enemies and bullets
                    enemies = enemies.filter(enemy => !enemy.destroyed);
                    bullets = bullets.filter(bullet => !bullet.destroyed);
                    powerups = powerups.filter(powerup => !powerup.destroyed);
                    planets = planets.filter(planet => !planet.destroyed);

                    moveEnemies(app);
                    moveBullets(app);
                    movePowerups(app);
                    movePlanets(app);

                    crtFilter.seed = Math.random();
                    crtFilter.time += 0.5;

                    // Fire a bullet every x ms
                    if (delta.lastTime - lastBulletFire > fireRate) {
                        fireBullet(app);
                        lastBulletFire = delta.lastTime;
                    }


                    // Spawn Enemies every 2 s
                    if (delta.lastTime - lastEnemySpawn >= 500) {
                        spawnEnemy(app);
                        lastEnemySpawn = delta.lastTime;
                    }

                    /*
                    if( planets.length === 0 ) {
                        const planet = Sprite.from('/earth_256.png') as Enemy;
                        planet.x = Math.random() * app.screen.width;
                        planet.y = -(planet.height);
                        planet.anchor.set(0.5);
                        planet.scale.set(2);
    
                        planets.push(planet);
                        app.stage.addChild(planet);
                    }*/

                }

                moveStars(app);

                // Stars Spawning
                if (delta.lastTime - lastStarSpawn >= 250) {
                    const star = generateStar(app, undefined);
                    app.stage.addChild(star);
                    stars.push(star);
                    lastStarSpawn = delta.lastTime;
                }

            }


            // Wrapped in (async() => ) in order to use await and aviod promise callback hell :D
            (async () => {

                await app.init({
                    width: window.innerWidth,
                    height: window.innerHeight,
                    backgroundColor: 0x001010,
                });

                if (gameCanvas && gameCanvas.current) {
                    gameCanvas.current.appendChild(app.canvas);
                }

                // Load current highscores
                const highScoreResult = await fetchHighScores();
                if (highScoreResult) {
                    const currentHighScores = await highScoreResult.json();
                    if (!currentHighScores.err) {
                        console.log('Current highscores', currentHighScores);
                        setHighscores(currentHighScores);
                    }
                    else {
                        console.log('No highscores or server error');
                    }
                }

                // Load Sprites
                await Assets.load('/player.jpg');
                await Assets.load('/shield.png');
                await Assets.load('/enemy.jpg');
                await Assets.load('/bullet.png');
                await Assets.load('/shieldPowerup.png');
                await Assets.load('/earth_256.png');

                // Load the animation sprite sheet
                await Assets.load('/pixelexplosion.json');
                let i;

                for (i = 1; i < 60; i++) {
                    let num = '000' + i;
                    if (i > 9 && i < 100) {
                        num = '00' + i;
                    }
                    const texture = Texture.from(num + '.png');

                    explosionTextures.push(texture);
                }

                /**
                 * Setup the player Graphics, consistin of the player ship and shield
                 */
                player = new Container();

                app.stage.addChild(player);

                const playerSprite = Sprite.from('/player.jpg');

                player.x = app.screen.width / 2;
                player.y = app.screen.height / 2;

                playerSprite.anchor.set(0.5);

                player.addChild(playerSprite);

                shield = Sprite.from('/shield.png');
                shield.x = 0;
                shield.y = 0;

                shield.anchor.set(0.5);

                shield.scale.set(1.5);

                player.addChild(shield);

                // Keystrokes
                document.addEventListener('keydown', (e) => {
                    if (e.key === ' ') {
                        
                        if( !gameRunning ) {
                            if (gameOver) {
                                restart();    
                            }
                            setGameRunningState(true);
                            setShowLoadScreen( false );
                            gameRunning = true;
                        }
                        else {
                            setGameRunningState(false);
                            setShowLoadScreen( false );
                            gameRunning = false;
                        }
                    }
                });

                // Enable interactivity
                app.stage.eventMode = 'static';
                app.stage.hitArea = app.screen;

                app.stage.on("pointermove", (e) => {
                    movePlayer(app, e);
                });

                window.addEventListener('resize', (e) => {
                    console.log( 'resize!', e );
                    app.resize();
                });

                window.addEventListener('touchend', () => {
                    if (!gameRunning) {

                        if (gameOver) {
                            restart();
                        }
                        setShowLoadScreen( false );
                        setGameRunningState(true);
                        gameRunning = true;
                    
                    }
                });

                /*app.stage.on('touchend', () => {
                    if (!gameRunning) {

                        if (gameOver) {
                            restart();
                        }
                        
                        setGameRunningState(true);
                        gameRunning = true;
                    
                    }
                });*/

                // Generate initial stars
                stars = generateStars(app);

                // Game loop
                app.ticker.add(gameLoop);

                // Filter!?
                crtFilter = new CRTFilter({
                    curvature: 10,
                    lineWidth: 0.2,
                    lineContrast: 0.6,
                    noise: 0.4,
                    noiseSize: 1,
                    vignetting: 0.5,
                    vignettingAlpha: 0.7,
                    time: 0.5,
                    seed: 1
                });

                const glitchFilter = new GlitchFilter({
                    slices: 9,
                    offset: 5,
                    red: { x: 1, y: 0 },
                    blue: { x: 1, y: -1 },
                    green: { x: -1, y: 0 }
                });

                app.stage.filters = [crtFilter, glitchFilter];
            })();

            return () => {
                try {
                    app.destroy();
                }
                catch( error ) {
                    console.error( error );
                }
            };
        }, []);

        const handleSubmitHighscore = async (e: FormEvent) => {
            e.preventDefault();
            console.log('Handle Me!');
            if (newHighscoreName.length >= 3) {
                const postResult = await postHighScore({ score: scoreState, name: newHighscoreName });
                if (postResult) {
                    const result = await postResult.json();
                    if (result.success) {
                        console.log('New highscore set!');
                        setHighscores(prev => {
                            const newHighscores = JSON.parse(JSON.stringify(prev));
                            newHighscores.push({ score: scoreState, name: newHighscoreName, scoreDate: new Date().toLocaleDateString });
                            return newHighscores;
                        });
                        setHighscoreSubmitted(true);
                        return true;
                    }
                }
            }
        }

        useEffect(() => {
            if (gameOverState) {
                const isNewHighscore = highscores.length !== 0 && highscores[0].score < scoreState;
                setIsNewHighscoreState(isNewHighscore);
                setHighscoreSubmitted(false);
            }
        }, [gameOverState]);

        const sortedHighscores = highscores.sort(( a, b ) => {
            if( a.score > b.score ) {
                return -1;
            }
            else if( a.score < b.score ) {
                return 1;
            }
            else {
                return 0;
            }
        });


        return (
            <div className={"wrapper" + (gameRunningState ? ' running' : ' paused') + (isNewHighscoreState ? ' newHighscore' : '')}>
                
                <div className="gameArea" ref={gameCanvas} />
                
                {showLoadScreen ? (
                    <div className="loadScreen">
                        <div className="content">
                            <h1>Retro Space Shooter</h1>
                            <p>
                                Feeling nostalgic? Welcome to a simple game that takes inspiration from the old classics, but adds its own little touch! Enjoy, and feel free to fork on Github.
                            </p>
                            <p>Click anywhere to begin</p>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="ui">
                            <strong>HP: {playerHpState}</strong>
                            <div className={"shield" + (shieldActive ? ' active' : ' recharging')}>
                                <strong>Shield: {shieldActive ? 'Active' : 'Depleted'}</strong>
                            </div>
                            <strong>Score: {scoreState}</strong>
                        </div>
                        <div className={"pauseScreen" + (!gameRunningState && !gameOverState ? ' visible' : '')}>
                            <div>
                                <strong>Game is paused</strong>
                                <div className="currentHighscores">
                                    <h4>Current highscores</h4>
                                    {sortedHighscores.slice(0,5).map( highscore => (
                                        <div key={highscore.score} className="highscore">
                                            <span>{highscore.name}</span>
                                            <span>{highscore.score}</span>
                                        </div>
                                    ))}
                                </div>
                                <p>Press <span>Space</span> (or touch on mobile) to continue.</p>
                            </div>
                        </div>
                        <div className={"gameOverScreen" + (gameOverState ? ' visible' : '')}>
                            <div className="content">
                                <h2>Game over</h2>
                                {isNewHighscoreState ? (
                                    <>
                                        {!highscoreSubmitted ? (
                                            <div className="newHighscore">
                                                <h3>New high Score: <span>{scoreState}</span></h3>
                                                <form id="highscore" onSubmit={handleSubmitHighscore}>
                                                    <label>Your Name:</label>
                                                    <input maxLength={16} type="text" value={newHighscoreName} onChange={(e) => setNewHighscoreName(e.target.value)} />
                                                    <button onClick={handleSubmitHighscore} disabled={newHighscoreName.length < 3}>Submit highscore</button>
                                                </form>
                                            </div>
                                        ) : (
                                            <>
                                                <h3>Thank you for playing!</h3>
                                            </>
                                        )}
                                    </>
                                ) : ''}
                                <button onClick={() => {
                                    restart();
                                }}>Play again!</button>
                            </div>
                        </div>
                    </>
                )}

            </div>
        )
    }
    catch (error) {
        console.error(error);
    }

}