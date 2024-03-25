import React, { useEffect, useRef, useState } from 'react';
import { Application, Assets, Sprite, AnimatedSprite, Texture, Container } from 'pixi.js';
import { generateStars, generateStar } from '../generateStars.ts';
import { Graphics } from 'pixi.js';

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

export default function Game() {

    const maxEnergy = 5;

    const [shieldActive, setShieldActive ] = useState<boolean>(true);
    const [score, setScore ] = useState<number>(0);
    const [playerHp, setPlayerHp ] = useState<number>(10);
    const [energyState,setEnergyState] = useState<number>(maxEnergy);
    const [energyRechargeRate,setEnergyRechargeRate] = useState<number>(0.5);


    let enemies: any[] = [];
    let player: any = {};
    let energyGfx: any = {};
    let bullets: any[] = [];
    let stars: any[] = [];
    let shield: any = {};

    let lastEnemySpawn = 0;
    let lastStarSpawn = 0;
    
    let energy = maxEnergy;

    let energyTimer;

    const explosionTextures = [];

    const gameCanvas = useRef(null);

    const energyBar = useRef(null);
    const energyBarFill = useRef(null);

    const fireBullet = (app) => {
        if( energy >= 1 ) {
            const bullet = createBullet();
            app.stage.addChild(bullet);
            bullets.push(bullet);
            energy -= 1;

            setEnergyState( () => {
                return energy;
            });
        }
    }

    useEffect(() => {
        
    }, [energyState]);

    const createEnemy = (x: number, y: number) => {

        const enemy = Sprite.from('/public/enemy.jpg') as Enemy;
        enemy.x = x;
        enemy.y = y;
        enemy.hp = 2;
        enemy.speed = Math.ceil(Math.random() * 3);
        enemy.anchor.set(0.5);

        return enemy;
    }

    const createBullet = () => {
        const bullet = Sprite.from('/public/bullet.png') as Bullet;
        bullet.x = player.x;
        bullet.y = player.y;
        bullet.anchor.set(0.5);
        bullet.speed = 5;

        return bullet;
    }

    useEffect(() => {
        const app = new Application();
    
        const moveEnemies = (delta) => {
    
            enemies.forEach(enemy => {
                if( !enemy.destroyed ) {
                    enemy.y += enemy.speed;
                }
            });
        }
    
        // Test For Hit
        // A basic AABB check between two different squares
        function testForAABB(object1, object2) {
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
            catch( error ) {
                return false;
            }
        }
    
        const moveBullets = (delta) => {
            bullets.forEach(bullet => {
                if( !bullet.destroyed ) {
                    
                    bullet.y -= bullet.speed;
                
                    enemies.forEach(enemy => {
                        if( !enemy.destroyed ) {
                            
                            const hit = testForAABB(bullet, enemy);
                            
                            if (hit) {
                                // Create an explosion AnimatedSprite
                                explode( enemy.x, enemy.y );
                                enemy.hp = 0;
                                bullet.destroy();
                                enemy.destroy();
                                setScore( prev => prev + 1 );
                            }
                        }
                    });
                }

            });
        }

        const explode = (x: number, y: number ) => {
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

        console.log( energyBar );
    
        const movePlayer = (e) => {
            let pos = e.data.global;
            player.x = pos.x;
            player.y = pos.y;

            energyBar.current.style.transform = 'translateX(' + (pos.x + (player.width/2)) + 'px) translateY(' + (pos.y - 15 ) + 'px)';

            // Collisio Detection
            enemies.forEach( enemy => {
                try {
                    const hit = testForAABB( player, enemy );
                    if( hit ) {
                        explode( player.x, player.y );
                        enemy.destroy();
                        
                        if( shield.alpha === 1 ) {
                            setShieldActive(false);
                            shield.alpha = 0;
                            setTimeout(() => {
                                shield.alpha = 1;
                                setShieldActive(true);
                            }, 2000 );
                        }
                        else {
                            setPlayerHp( prev => prev - 1 );
                        }
                    }
                }
                catch( error ) {
                    return;
                }
            });
        }

        const moveStars = (delta) => {
            stars.forEach( star => {
                star.y += star.speed;
            });
        }
    
        const gameLoop = (delta) => {
            moveEnemies(delta);
            moveBullets(delta);
            moveStars(delta);

            energyBarFill.current.style.transform = 'translateY(' +((maxEnergy - energy) * 20)+ '%)';

            // Stars Spawning
            if( delta.lastTime - lastStarSpawn >= 250 ) {
                const star = generateStar(app, undefined);
                app.stage.addChild(star);
                stars.push( star );
                lastStarSpawn = delta.lastTime;
            }

            // Enemies every 2 s
            if( delta.lastTime - lastEnemySpawn >= 2000 ) {
                const enemy = createEnemy(Math.random() * app.screen.width, 0);
                app.stage.addChild(enemy);
                enemies.push(enemy);
                lastEnemySpawn = delta.lastTime;
            }

        }

        (async () => {
            await app.init({
                width: 800,
                height: 600,
                backgroundColor: 0x000000,
            });

            gameCanvas.current.appendChild(app.canvas);

            await Assets.load('/public/player.jpg');
            await Assets.load('/public/shield.png');
            await Assets.load('/public/enemy.jpg');
            await Assets.load('/public/bullet.png');

            // Load the animation sprite sheet
            await Assets.load('/public/pixelexplosion.json');
            let i;

            for (i = 1; i < 60; i++) {
                let num = '000' + i;
                if( i > 9 && i < 100 ) {
                    num = '00' + i;
                }
                const texture = Texture.from(num + '.png');

                explosionTextures.push(texture);
            }

            /**
             * Setup the player Graphics
             */
            player = new Container();

            app.stage.addChild( player );

            const playerSprite = Sprite.from('/public/player.jpg') as Player;

            player.x = app.screen.width / 2;
            player.y = app.screen.height / 2;

            playerSprite.anchor.set(0.5);

            player.addChild(playerSprite);

            shield = Sprite.from('/public/shield.png');
            shield.x = 0;
            shield.y = 0;

            shield.anchor.set(0.5);

            shield.scale.set(1.5);

            player.addChild(shield);

            // Player movement
            document.addEventListener('keydown', (e) => {
                //e.key;
            });

            document.addEventListener('keyup', (e) => {
                //e.key;
            });

            //fireBullet(app);

            energyTimer = setInterval( () => {
                if( energy + 1 >= maxEnergy ) {
                    energy = maxEnergy;
                }
                else {
                    energy += 1;
                }

                setEnergyState( () => {
                    return energy;
                });
            }, energyRechargeRate * 1000 );

            // Enable interactivity!
            app.stage.eventMode = 'dynamic';

            // Make sure the whole canvas area is interactive, not just the circle.
            app.stage.hitArea = app.screen;

            app.stage.on("pointermove", movePlayer);

            app.stage.on("pointerdown", () => {
                fireBullet(app);
            })

            stars = generateStars(app);

            // Game loop
            app.ticker.add(gameLoop);

            document.addEventListener("visibilitychange", () => {
                if (document.hidden) {
                    console.log( 'pause');
                  app.ticker.stop();
                } else {
                    console.log( 'resume');
                    app.ticker.start();
                }
              });
        })();

        return () => {
            app.destroy();
        };
    }, []);

    return (
        <div className="wrapper">
            <div ref={gameCanvas} />
            <div className="energyBar" ref={energyBar}>
                <div className="inner" ref={energyBarFill}></div>
            </div>
            <div className="ui">
                <strong>HP: {playerHp}</strong>
                <strong>Shield: {shieldActive ? 'Active' : 'Recharging'}</strong>
                <strong>Score: {score}</strong>
                <strong>Energy: {energyState}</strong>
            </div>
        </div>
    )
}