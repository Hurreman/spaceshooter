import { Application, Graphics } from "pixi.js";

interface Star extends Graphics {
    speed: number;
}

export function generateStars(app: Application) {
    const starCount = 20;

    const stars = [];

    for (let index = 0; index < starCount; index++)
    {
        const star = generateStar( app, index );

        app.stage.addChild(star);

        stars.push( star );
    }

    return stars;

}

export function generateStar(app: Application, seed: number|undefined ){

    const graphics = new Graphics() as Star;
    let y = -5;
    let x = Math.floor( Math.random() * app.screen.width );
    
    if( seed ) {
        y = (seed * 0.9382 * app.screen.height) % app.screen.height;
    }
    
    const radius = 2 + Math.random() * 3;
    const rotation = Math.random() * Math.PI * 2;

    graphics.speed = Math.ceil( Math.random() * 3 );

    graphics.star(x, y, 5, radius, 0, rotation).fill({ color: 0xffffff, alpha: radius / 5 });

    return graphics;
}