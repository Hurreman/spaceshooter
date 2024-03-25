module.exports = {
    apps: [{
        name: "nutrientcalc_server",
        script: "./server.js",
        watch: true,
        watch_delay: 1000,
        ignore_watch: [
            "[\/\\]\./",
            "node_modules",
            "prisma/db.db"
        ]
    }]
}
