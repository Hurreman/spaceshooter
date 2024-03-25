/**
 * My _very_ basic space arcade game created for fun and portfolio purposes.
 * Probably full of bugs and edge cases, but was created just a few evenings - so take that into consideration :D
 * 
 * @todo Pause screen when de-focused
 */
class SpaceGame {
    constructor( element ) {
        
        // Setup
        this.gameElement = element;

        this.hpTextElem = this.gameElement.querySelector( '.hp .num' );
        this.gameOverScreen = this.gameElement.querySelector( '.gameOver' );
        this.loadingScreen = this.gameElement.querySelector( '.loadingScreen' );
        this.startGameButton = this.gameElement.querySelector( '.startGameButton' );

        /** Mobile specific for touch controls */
        this.isMobile = false;
        this.mobileTouchStartX = 0;
        this.mobileTouchStartY = 0;
        this.mobileLastMoveX = 0;
        this.mobileLastMoveY = 0;
        this.mobileMoveX = 0;
        this.mobileMoveY = 0;
        this.touching = false;
        this.throttleTimer = false;

        this.gameRunning = false;
        this.enemies = [];
        this.lasers = [];
        
        this.numColumns = 12;
        this.numRows = 8;

        this.highscores = [];
        this.score = 0;

        this.tickMilliseconds = 2000;

        this.hp = 5;

        this.entitySize = 0;

        this.calculateSizes();

        // Create enemy
        this.player = new Player( this, {x: 5, y: this.numRows });

        this.fetchHighScores();

        this.bindEvents();
    }

    /**
     * Add a laser to the lasers array
     */
    addLaser( laser ) {
        this.lasers.push( laser );
    }

    /**
     * Basically the game loop. Uses requestAnimationFrame for performance purposes instead of something like setInterval
     */
    update(timestamp) {
        const deltaTime = timestamp - this.lastTimestamp;
        this.lastTimestamp = timestamp;
        this.accumulatedTime += deltaTime;
        this.accumulatedTimeSinceSpeedIncrease += deltaTime;
    
        const speed = 1;
        this.moveEntities( speed );
    
        // Add a new enemy every "tickMilliseconds" milliseconds
        if (this.accumulatedTime >= this.tickMilliseconds) {
            this.addEnemy({
                x: Math.floor(Math.random() * this.numColumns),
                y: 0
            });
            this.accumulatedTime -= this.tickMilliseconds;
        }

        // Increase speed every 10 seconds
        if (this.accumulatedTimeSinceSpeedIncrease >= 10000 && this.tickMilliseconds > 250 ) {
            // remove 250 ms if not already at max speed
            this.tickMilliseconds -= 250;
            this.accumulatedTimeSinceSpeedIncrease -= 10000;
        }

        this.enemies = this.enemies.filter(enemy => enemy.location.y <= this.gameHeight);
        this.lasers = this.lasers.filter(laser => laser.done === false );

        this.calculateCollisions();

        if (this.gameRunning) {
            requestAnimationFrame(this.update.bind(this));
        }
    }

    /**
     * Update the HP text in the UI with the current HP
     */
    updateHpText() {
        this.hpTextElem.innerText = this.hp;
    }

    /**
     * Take damage from an enemy, either from collision with the player or from an enemy crossing the game boundry
     */
    takeDamage() {
        this.hp -= 1;

        this.updateHpText();

        if( this.hp === 0 ) {
            this.status = 'gameover';
            this.gameRunning = false;
            this.gameElement.classList.remove('running');
            this.gameOverScreen.classList.add('visible');

            // New high score?
            if( this.highscores.length === 0 || this.score > this.highscores[0].score ) {
                console.log( 'new high score!' );
                // Show high score input
                const highscoreForm = this.gameElement.querySelector( '.newHighscore' );
                highscoreForm.classList.add( 'visible' );
                const highscoreFormScore = highscoreForm.querySelector( '.score' );
                highscoreFormScore.innerText = this.score;
            }
        }
        else {
            this.gameElement.classList.add( 'damage' );
            setTimeout( () => {
                this.gameElement.classList.remove( 'damage' );
            }, 1500);
        }
    }

    /**
     * Fetch all enemies
     * @returns 
     */
    getEnemies() {
        return this.enemies;
    }

    /**
     * Simple throttle method for inputs
     */
    throttle( callback, time ) {
        if (this.throttleTimer) {
            return;
        }
            
        this.throttleTimer = true;
        setTimeout(() => {
            callback();
            this.throttleTimer = false;
        }, time);
    }

    /**
     * Bind key events
     */
    bindEvents() {

        const moveSlider = document.querySelector( '.moveSlider' );
        const fireButton = document.querySelector( '.fire' );
        const restartButton = document.querySelectorAll( '.restartGameButton' );
        const submitHighscore = document.querySelector( '.newHighscore .highscoreSubmit' );

        submitHighscore.addEventListener( 'click', ( event ) => {
            const name = document.querySelector( '.newHighscore .playerName' ).value;
            if( typeof name !== 'undefined' && typeof name === 'string' && name !== '' ) {
                this.postHighScore({name: name, score: this.score });
            }
            else {
                console.log( 'Invalid name', name );
            }
        });

        fireButton.addEventListener( 'touchstart', ( event ) => {
            console.log( 'PEW PEW Mobile' );
            this.player.fireLaser();
            event.preventDefault();
        });

        moveSlider.addEventListener( 'touchstart', ( event ) => {
            this.touching = true;
            this.mobileTouchStartX = event.touches[0].clientX;
            this.mobileTouchStartY = event.touches[0].clientY;
        });

        moveSlider.addEventListener( 'touchend', () => {
            this.touching = false;
        });

        moveSlider.addEventListener( 'touchmove', ( event ) => {
            this.throttle( () => {
                this.mobileMoveX = event.touches[0].clientX;
                this.mobileMoveY = event.touches[0].clientY;
                
                if( (this.mobileMoveX ) > (this.mobileLastMoveX + 5 ) ) {
                    this.player.move( 'right' );
                }
                else if( ( this.mobileMoveX ) < (this.mobileLastMoveX - 5 ) ) {
                    this.player.move( 'left' );
                }

                this.mobileLastMoveX = this.mobileMoveX;
            }, 50 );
        });

        restartButton.forEach( (button) => {
            button.addEventListener( 'click', () => {
                this.gameOverScreen.classList.remove( 'visible' );
                this.gameElement.classList.add('running');
                document.querySelector('.highscoreSubmitted').classList.remove('visible');
                this.restartGame();
            });
        });

        this.startGameButton.addEventListener( 'click', () => {
            this.loadingScreen.classList.remove('visible');
            this.gameRunning = true;
            this.gameElement.classList.add('running');
            this.startGame();
        });

        document.addEventListener( 'keyup', ( event ) => {
            switch( event.key ) {
                case 'ArrowLeft':
                    this.player.move( 'left' );
                    break;
                case 'ArrowRight':
                    this.player.move( 'right' );
                    break;
                case 'x':
                    this.player.fireLaser();
                    event.preventDefault();
                    break;
            }
        });
    }

    /**
     * Add a new enemy
     * @param {*} location 
     */
    addEnemy(location) {
        const enemy = new Enemy( this, location );
        enemy.setIndex( this.enemies.length );
        this.enemies.push( enemy );
    }

    /**
     * Move all enemies and lasers
     */
    moveEntities() {
        this.enemies.forEach( (enemy) => {
            if( enemy.destroyed === false ) {
                enemy.move( 'down' );
            }
        });

        this.lasers.forEach( (laser) => {
            laser.move();
        });
    }

    /**
     * Return the game DOM element
     */
    getElement() {
        return this.gameElement;
    }

    /**
     * Return the entity size, calculated from the number of wanted columns and the size of the parent DOM element
     */
    getEntitySize() {
        return this.entitySize;
    }

    /**
     * Calculate collisions between lasers, enemies and the player
     */
    calculateCollisions() {

        this.enemies.forEach( ( enemy ) => {
            
            let destroyedByLaser = false;
            let collidedWithPlayer = false;

            const enemyElement = enemy.getElement();
            const enemyBounds = enemyElement.getBoundingClientRect();

            for( let la = 0; la < this.lasers.length; la++ ) {
                const laser = this.lasers[la];
                const laserBounds = laser.laserElem.getBoundingClientRect();
                if (
                    laserBounds.right > enemyBounds.left && laserBounds.left < enemyBounds.right &&
                    laserBounds.bottom > enemyBounds.top && laserBounds.top < enemyBounds.bottom
                ) {
                    // Collision with a laser detected
                    laser.remove(); // Destroy the laser
                    
                    destroyedByLaser = true;
                }

                if( destroyedByLaser ) {
                    this.score++;
                    this.updateScore();

                    this.createExplosion( enemy.location );
                    enemy.remove(); // Destroy the enemy ship
                    break;
                }

                if( collidedWithPlayer ) {
                    enemy.remove(); // Destroy the enemy ship
                    this.takeDamage();
                    break;
                }

            }
        });
    }

    createExplosion( location ) {
        const explosion = new Explosion( this, location );
        
        setTimeout( () => {
            explosion.remove();
        }, 1000 );
    }

    updateScore() {
        const scoreElement = document.querySelector( '.score .num' );
        scoreElement.innerText = this.score;
    }

    postHighScore( scoreData ) {
        fetch( '/highscores', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(scoreData)
        })
        .then( response => response.json() )
        .then( data => {
            const highscoreForm = this.gameElement.querySelector( '.newHighscore' );
            highscoreForm.classList.remove( 'visible' );
            this.gameOverScreen.classList.remove('visible');
            const highScoreSubmitted = document.querySelector( '.highscoreSubmitted' );
            highScoreSubmitted.classList.add( 'visible' );
        })
        .catch( error => {
            console.error( 'Error posting high score:', error );
        });
    }

    fetchHighScores() {
        fetch( '/highscores' )
        .then( response => response.json() )
        .then( data => {
            this.highscores = data;
            const highScoreScoreElem = document.querySelector('.currentHighscore .score' );
            highScoreScoreElem.innerText = this.highscores[0].score;
            const highScoreScoreName = document.querySelector('.currentHighscore .name' );
            highScoreScoreName.innerText = this.highscores[0].name;
        })
        .catch( error => {
            console.error( 'Error fetching high scores:', error );
        });
    }
    
    calculateSizes() {
        const elementWidth = this.gameElement.offsetWidth;

        // What's the rounded down size for each column (in pixels)?
        const colWidth = Math.floor( elementWidth / this.numColumns );

        this.gameHeight = this.gameElement.offsetHeight;
        
        this.entitySize = colWidth;
    }

    restartGame() {
        this.hp = 10;
        this.score = 0;
        this.gameRunning = true;
        this.tickMilliseconds = 2000;

        this.updateScore();
        this.updateHpText();
        this.enemies = [];
        
        // Remove existing enemy, player and laser elements
        const enemyElements = document.querySelectorAll('.enemy');
        const laserElements = document.querySelectorAll('.laser');
        const playerElement = document.querySelector('.player');
        enemyElements.forEach(enemyElem => enemyElem.remove());
        laserElements.forEach(laserElem => laserElem.remove());
        playerElement.remove();

        // Create new player
        this.player = new Player(this, { x: 5, y: this.numRows });

        this.startGame();
    }

    /**
     * Start the game!
     */
    startGame() {
        // Move entities and add one new enemy every "tickMilliseconds" milliseconds
        this.lastTimestamp = performance.now();
        this.accumulatedTime = 0;
        this.accumulatedTimeSinceSpeedIncrease = 0;
        this.update( this.lastTimestamp );
    }
};

/**
 * BASE ENTITY
 */
class Entity {
    constructor( game, type, location ) {
        this.game = game;
        this.location = location;
        
        const gameElement = this.game.getElement();

        // Create Entity DOM element
        this.entityElem = document.createElement('div');
        this.entityElem.classList.add(type);
        
        // add to game
        gameElement.appendChild( this.entityElem );
        
        // Set size and position
        const size = this.game.getEntitySize();
        this.entityElem.style.width = size + 'px';
        this.entityElem.style.height = size + 'px';

        this.setPosition();
    }

    getElement() {
        return this.entityElem;
    }

    setPosition() {
        const size = this.game.getEntitySize();
        let transforms = '';

        if( typeof this.location === 'undefined' || typeof this.location.x === 'undefined' || typeof this.location.y === 'undefined' ) {
            return false;
        }

        if( this.location.x > 0 ) {
            transforms = 'translateX(' + (this.location.x * size) + 'px) ';
        }
        else {
            transforms = 'translateX(0px) ';
        }

        if( this.location.y > 0 ) {
            transforms += 'translateY(' + (this.location.y * size) + 'px) ';
        }
        else {
            transforms += 'translateY(0px) ';
        }

        this.entityElem.style.transform = transforms;
    }

    move( direction ) {
        switch( direction ) {
            case 'down':
                this.location.y += 1;
                break;
            case 'left':
                if( this.location.x > 0 ) {
                    this.location.x -= 1;
                }
                break;
            case 'right':
                if( this.location.x < (this.game.numColumns - 1) ) {
                    this.location.x += 1;
                }
                else {
                    
                }
                break;
            default:
                break;
        }

        this.setPosition();

    }
}

class Explosion extends Entity {
    constructor(game, location ) {
        super(game, 'explosion', location );
    }

    remove() {
        this.entityElem.remove();
    }
    
    setPosition() {
        const size = this.game.getEntitySize();
        let transforms = '';

        if( typeof this.location === 'undefined' || typeof this.location.x === 'undefined' || typeof this.location.y === 'undefined' ) {
            return false;
        }

        if( this.location.x > 0 ) {
            transforms = 'translateX(' + (this.location.x * size) + 'px) ';
        }
        else {
            transforms = 'translateX(0px) ';
        }

        if( this.location.y > 0 ) {
            transforms += 'translateY(' + (this.location.y) + 'px) ';
        }
        else {
            transforms += 'translateY(0px) ';
        }

        this.entityElem.style.transform = transforms;
    }
}

/**
 * LASER
 */
class Laser {

    constructor(game,location) {

        this.start = undefined;
        this.previousTimestamp = undefined;
        this.done = false;

        this.game = game;
        this.location = location;
        
        this.laserElem = document.createElement('div');
        this.laserElem.classList.add('laser');
        
        const size = this.game.getEntitySize();
        this.laserElem.style.width = size + 'px';
        this.laserElem.style.height = size + 'px';
        this.laserElem.innerText = '|';
        
        this.laserElem.style.left = (this.location.x * size) + 'px';
        this.laserElem.style.top = (this.location.y * size) + 'px';
        
        this.game.gameElement.appendChild( this.laserElem );

        this.yPos = 0;

        this.game.addLaser( this );
    }

    remove() {
        this.laserElem.remove();
    }

    move() {
        this.yPos += 2;
        const translate = `translateY(-${this.yPos}px)`;
        this.laserElem.style.transform = translate;

        if( this.yPos >= this.game.gameHeight ) {
            this.remove();
            this.done = true;
        }
    }
}

/** PLAYER */
class Player extends Entity{
    
    laser;

    constructor(game, location ) {
        super(game, 'player', location );
    }

    fireLaser() {
        this.laser = new Laser(this.game, this.location);
    }
};

/** ENEMY */
class Enemy extends Entity {

    constructor(game, location) {
        super(game, 'enemy', location);
        
        this.destroyed = false;
    }

    setIndex( index ) {
        this.index = index;
    }

    remove() {
        this.destroyed = true;
        this.entityElem.remove();
    }

    move( direction ) {

        switch( direction ) {
            case 'down':
                if( this.location.y + 1 > this.game.gameHeight ) {
                    this.remove();
                    this.game.takeDamage();
                }
                else {
                    this.location.y += 1;
                }
                break;
            case 'left':
                break;
            case 'right':
                break;
            default:
                break;
        }

        this.setPosition();
    }

    setPosition() {
        const size = this.game.getEntitySize();
        let transforms = '';

        if( typeof this.location === 'undefined' || typeof this.location.x === 'undefined' || typeof this.location.y === 'undefined' ) {
            return false;
        }

        if( this.location.x > 0 ) {
            transforms = 'translateX(' + (this.location.x * size) + 'px) ';
        }
        else {
            transforms = 'translateX(0px) ';
        }

        if( this.location.y > 0 ) {
            transforms += 'translateY(' + (this.location.y) + 'px) ';
        }
        else {
            transforms += 'translateY(0px) ';
        }

        this.entityElem.style.transform = transforms;
    }
}