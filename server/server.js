'use strict';

require('dotenv').config();

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');

const http = require('http');

const httpPort = process.env.HTTP_PORT || 80;

const compression = require('compression');

const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const sanitizeHtml = require('sanitize-html');

const cors = require('cors');

const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

const DB_FILE = 'highscores.db';

class SpaceShooterServer {

    db = false;
    app = false;
    httpServer = false;
    
    constructor() {
        this.setupServer();
        this.setupHighscoresDb();
        this.setupRoutes();
        this.startServer();
    }
    
    setupServer() {
        this.app = express();

        this.app.use(logger('dev'));
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: false }));
        this.app.use(cookieParser());
        this.app.use(bodyParser.json());
        this.app.use(express.static(path.join(__dirname, '../dist')));
        this.app.use(compression());

        this.app.use(cors());
    }

    startServer() {
        // Start HTTP Server
        this.httpServer = http.createServer(this.app);

        this.httpServer.listen(httpPort, () => {
            console.log('HTTP Server running on port ' + httpPort);
        });
    }
    
    setupRoutes() {

        this.app.use('/highscores/', apiLimiter);

        this.app.get('/highscores', (req, res) => {
            this.db.all('SELECT * FROM highscores ORDER BY score DESC', (err, rows) => {
                if (err) {
                    return res.status(500).json({ error: 'Internal Server Error' });
                }
                res.json(rows);
            });
        });
        
        this.app.post('/highscores', (req, res) => {
            let { name, score } = req.body;
        
            // Input validation
            if (!name || !score || typeof name !== 'string' || typeof score !== 'number') {
                console.log( name, score );
                return res.status(400).json({ error: 'Invalid input' });
            }
        
            name = sanitizeHtml(name);
            score = sanitizeHtml(score);
        
            // Use parameterized query to prevent SQL injection
            const stmt = this.db.prepare('INSERT INTO highscores (name, score) VALUES (?, ?)');
            stmt.run(name, score);
            stmt.finalize();
        
            res.json({ success: true });
        });

        // 404
        this.app.get('*', function (req, res) {
            res.json( {err: '404'} );
        });
    }

    setupHighscoresDb() {
        // Check if the database file exists, if not, create it and the table
        if (!fs.existsSync(DB_FILE)) {
            const db = new sqlite3.Database(DB_FILE);
            db.serialize(() => {
                db.run('CREATE TABLE highscores (name TEXT, score INTEGER)');
            });
            db.close();
        }

        this.db = new sqlite3.Database(DB_FILE);

        // db.all('DELETE FROM highscores' );
    }
}

const SpaceShooterServerSe = new SpaceShooterServer();