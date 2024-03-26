# Space Shooter Game

I create a simple DOM-based space-shooter game for my portfolio on https://fredrikgraas.se. And when I stumbled across PixieJs, I knew I had to rewrite my game for WebGL/Canvas instead. So - here it is. The ship is controlled by the mouse cursor (or touch input on mobile). 

No level system, powerups as of yet, but they're on my To-Do!

A playable demo (hopefully) up at https://spaceshooter.ddns.net/ :)

![Screenshot of the Space Shooter game.](/screenshots/screenshot.jpg)

# Development (Vite)

```
npm install
npm run dev
```

# Prod / Build

For a production build/hosting, I've prepared a Dockerfile & Compose-file.
It uses multistage and first creates a separate build-image that runs the Vite Build, and then copies the generated dist folder into the server image which serves the React dist files through Express, an also acts as a REST-api for highscores.

Create an '.env' file in the server directory, containing a HTTP_PORT=<your_port_of_choice> entry, and then:

```
docker compose up -d
``` 