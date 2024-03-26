import { useEffect, useRef, useState } from 'react';
import { Application, Assets, Sprite, AnimatedSprite, Texture, Container } from 'pixi.js';
import { generateStars, generateStar } from '../generateStars.ts';
import { CRTFilter, GlitchFilter } from 'pixi-filters';

interface Bullet extends Sprite {
    speed: number;
    damage: number;
}

interface Player extends Sprite {
    speed: number;
}

interface Enemy extends Sprite {
    hp: number;
    speed: number;
}

interface DeltaTime {
    lastTime: number;
}

export default function Game() {

    try {
        //const maxEnergy = 5;

        /**
         * State used for UI elements outside the game. The same is reflected in variables below,
         * as I'm having issues with pixijs being able to read the current state within the game loop.
         * */
        const [shieldActive, setShieldActive] = useState<boolean>(true);
        const [score, setScore] = useState<number>(0);
        const [playerHpState, setPlayerHpState] = useState<number>(10);
        //const [energyState, setEnergyState] = useState<number>(maxEnergy);
        const [gameRunningState, setGameRunningState] = useState<boolean>(false);
        const [gameOverState,setGameOverState] = useState<boolean>(false);

        let enemies: any[] = [];
        let player: any = {};
        let bullets: any[] = [];
        let stars: any[] = [];
        let shield: any = {};
        let playerHp = 10;

        let lastEnemySpawn = 0;
        let lastStarSpawn = 0;
        //let lastEnergyUpdate = 0;
        let lastBulletFire = 0;

        let crtFilter : CRTFilter;

        //let energy = maxEnergy;

        let gameRunning = false;
        let gameOver = false;

        const explosionTextures : any[] = [];

        const gameCanvas = useRef<HTMLDivElement>(null);

        /* Not used atms
        const energyBar = useRef<HTMLDivElement>(null);
        const energyBarFill = useRef<HTMLDivElement>(null);
        */

        const fireBullet = (app : Application) => {
            //if (energy >= 1) {
                const bullet = createBullet();
                app.stage.addChild(bullet);
                bullets.push(bullet);
                
                /*energy -= 1;

                setEnergyState(() => {
                    return energy;
                });*/
            //}
        }

        const createEnemy = (x: number, y: number) => {

            const enemy = Sprite.from('/enemy.jpg') as Enemy;
            enemy.x = x;
            enemy.y = y;
            enemy.hp = 2;
            enemy.speed = Math.ceil(Math.random() * 3);
            enemy.anchor.set(0.5);

            return enemy;
        }

        const createBullet = () => {
            const bullet = Sprite.from('/bullet.png') as Bullet;
            bullet.x = player.x;
            bullet.y = player.y;
            bullet.anchor.set(0.5);
            bullet.speed = 5;

            return bullet;
        }

        useEffect(() => {
            const app = new Application();

            const moveEnemies = () => {

                enemies.forEach(enemy => {

                    if (!enemy.destroyed) {
                        enemy.y += enemy.speed;

                        if( enemy.y > app.screen.height ) {
                            enemy.destroy();
                        }
                    }
                });
            }

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

            const moveBullets = () => {
                bullets.forEach(bullet => {
                    

                    if (!bullet.destroyed) {

                        bullet.y -= bullet.speed;

                        if( bullet.y <= 0 ) {
                            bullet.destroy();
                        }
                        else {
                            enemies.forEach(enemy => {
                                if (!enemy.destroyed) {
    
                                    const hit = testForAABB(bullet, enemy);
    
                                    if (hit) {
                                        // Create an explosion AnimatedSprite
                                        explode(enemy.x, enemy.y);
                                        enemy.hp = 0;
                                        bullet.destroy();
                                        enemy.destroy();
                                        setScore(prev => prev + 1);
                                    }
                                }
                            });
                        }

                    }

                });
            }

            const explode = (x: number, y: number) => {
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

            const movePlayer = (e: any) => {
                if (gameRunning) {
                    let pos = e.data.global;
                    player.x = pos.x;
                    player.y = pos.y;

                    /*if( energyBar.current ) {
                        energyBar.current.style.transform = 'translateX(' + (pos.x + (player.width / 2)) + 'px) translateY(' + (pos.y - 15) + 'px)';
                    }*/

                    // Collisio Detection
                    enemies.forEach(enemy => {
                        try {
                            const hit = testForAABB(player, enemy);
                            if (hit) {
                                explode(player.x, player.y);
                                enemy.destroy();

                                if (shield.alpha === 1) {
                                    setShieldActive(false);
                                    shield.alpha = 0;
                                    setTimeout(() => {
                                        shield.alpha = 1;
                                        setShieldActive(true);
                                    }, 2000);
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

            const moveStars = () => {
                stars.forEach(star => {
                    if( !star.destroyed ) {
                        star.y += star.speed;

                        if( star.y > app.screen.height ) {
                            star.destroy();
                        }

                    }
                });
            }

            const takeDamage = ( damage: number ) => {
                console.log( 'Take ' + damage + ' damage');
                setPlayerHpState( prev => {
                    return prev - damage
                } );
                playerHp -= damage;

                if( playerHp <= 0 ) {
                    gameRunning = false;
                    gameOver = true;
                    setGameOverState( true );
                }
            }

            /**
             * Game Loop! Where most magic happens
             * @param delta 
             */
            const gameLoop = (delta: DeltaTime) => {

                // Clean up destroyed enemies and bullets
                enemies = enemies.filter( enemy => !enemy.destroyed );
                bullets = bullets.filter( bullet => !bullet.destroyed );

                if (gameRunning) {
                    
                    moveEnemies();
                    moveBullets();

                    crtFilter.seed = Math.random();
                    crtFilter.time += 0.5;

                    // Fire a bullet every x ms
                    if( delta.lastTime - lastBulletFire > 250 ) {
                        fireBullet(app);
                        lastBulletFire = delta.lastTime;
                    }
                    
                    
                    /*if( energyBarFill && energyBarFill.current ){
                        energyBarFill.current.style.transform = 'translateY(' + ((maxEnergy - energy) * 20) + '%)';    
                    }*/
                    
                    // Enemies every 2 s
                    if (delta.lastTime - lastEnemySpawn >= 500) {
                        const enemy = createEnemy(Math.random() * app.screen.width, 0);
                        app.stage.addChild(enemy);
                        enemies.push(enemy);
                        lastEnemySpawn = delta.lastTime;
                    }

                    /*if( delta.lastTime - lastEnergyUpdate >= 250 ) {
                        if (energy + 1 >= maxEnergy) {
                            energy = maxEnergy;
                        }
                        else {
                            energy += 1;
                        }
    
                        setEnergyState(() => {
                            return energy;
                        });

                        lastEnergyUpdate = delta.lastTime;
                    }*/

                }

                moveStars();

                // Stars Spawning
                if (delta.lastTime - lastStarSpawn >= 250) {
                    const star = generateStar(app, undefined);
                    app.stage.addChild(star);
                    stars.push(star);
                    lastStarSpawn = delta.lastTime;
                }

            }

            const restart = () => {
                setGameRunningState( true );
                gameRunning = true;
                setPlayerHpState( 10 );
                playerHp = 10;
                setGameOverState( false );
                gameOver = false;
                setScore( 0 );
                enemies.forEach( (enemy) => {
                    enemy.destroy();
                })
                enemies = [];
                bullets.forEach( (bullet) => {
                    bullet.destroy();
                });
                bullets = [];
            }

            
            // Wrapped in (async() => ) in order to use await and aviod promise callback hell :D
            (async () => {
                
                await app.init({
                    width: window.innerWidth,
                    height: window.innerHeight,
                    backgroundColor: 0x001010,
                });

                if( gameCanvas && gameCanvas.current ) {
                    gameCanvas.current.appendChild(app.canvas);
                }

                await Assets.load('/player.jpg');
                await Assets.load('/shield.png');
                await Assets.load('/enemy.jpg');
                await Assets.load('/bullet.png');

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

                const playerSprite = Sprite.from('/player.jpg') as Player;

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

                // Player movement
                document.addEventListener('keydown', (e) => {
                    if (e.key === ' ') {
                        if( gameOver ) {
                            restart();
                        }
                        else {
                            setGameRunningState(prev => !prev);
                            gameRunning = !gameRunning;
                        }
                    }
                });

                document.addEventListener('keyup', () => {
                    //e.key;
                });

                // Enable interactivity
                app.stage.eventMode = 'static';
                app.stage.hitArea = app.screen;

                app.stage.on("pointermove", movePlayer);

                app.stage.on("pointerdown", () => {
                    //fireBullet(app);
                })

                app.stage.on('touchend', () => {
                    if( !gameRunning ) {
                        
                        if( gameOver ) {
                            restart();
                        }
                        else {
                            setGameRunningState( true );
                            gameRunning = true;
                        }
                        
                    }
                });

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
                    red: {x: 1, y: 0},
                    blue: {x: 1, y: -1},
                    green: {x:-1, y: 0}
                });

                app.stage.filters = [crtFilter, glitchFilter];

                document.addEventListener("visibilitychange", () => {
                    if (document.hidden) {
                        gameRunning = false;
                        setGameRunningState(false);
                    } else {
                    }
                });
            })();

            return () => {
                app.destroy();
            };
        }, []);

        return (
            <div className={"wrapper" + (gameRunningState ? ' running' : ' paused')}>
                <div ref={gameCanvas} />
                <div className="ui">
                    <strong>HP: {playerHpState}</strong>
                    <div className={"shield" + (shieldActive ? ' active' : ' recharging')}>
                        <strong>Shield: {shieldActive ? 'Active' : 'Recharging'}</strong>
                    </div>
                    <strong>Score: {score}</strong>
                </div>
                <div className={"pauseScreen" + (!gameRunningState && !gameOverState ? ' visible' : '')}>
                    <div>
                        <strong>Game is paused</strong>
                        <p>Press <span>Space</span> to continue.</p>
                    </div>
                </div>
                <div className={"gameOverScreen" + (gameOverState ? ' visible' : '')}>
                    <h2>Game over!</h2>
                </div>
            </div>
        )
    }
    catch (error) {
        console.error(error);
    }

}