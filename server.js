const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- MEMORY DATABASE (Resets on restart, use MongoDB for permanent) ---
let globalState = {
    dispenseCommand: false, // ESP checks this. If true, it dispenses.
    schedule: { h: 14, m: 30 } // Default 2:30 PM
};

// --- 1. THE WEBSITE (UI) ---
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body { font-family: sans-serif; text-align: center; padding: 20px; background: #f4f4f4; }
            .card { background: white; padding: 20px; margin: 20px auto; max-width: 400px; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
            .btn { background: #3498db; color: white; padding: 10px 20px; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; }
            .btn-red { background: #e74c3c; }
            input { padding: 8px; width: 50px; text-align: center; }
        </style>
    </head>
    <body>
        <h1>Health Guardian Cloud</h1>
        
        <div class="card">
            <h2>Remote Dispense</h2>
            <p>Click to trigger ESP immediately.</p>
            <form action="/trigger-dispense" method="POST">
                <button class="btn btn-red">DISPENSE NOW</button>
            </form>
        </div>

        <div class="card">
            <h2>Weekly Schedule</h2>
            <p>Current: <strong>${globalState.schedule.h}:${globalState.schedule.m < 10 ? '0'+globalState.schedule.m : globalState.schedule.m}</strong></p>
            <form action="/set-schedule" method="POST">
                <input type="number" name="h" placeholder="HH" min="0" max="23" required> : 
                <input type="number" name="m" placeholder="MM" min="0" max="59" required>
                <br><br>
                <button class="btn">Update Schedule</button>
            </form>
        </div>
    </body>
    </html>
    `);
});

// --- 2. API ENDPOINTS (For Website Forms) ---
app.post('/trigger-dispense', (req, res) => {
    globalState.dispenseCommand = true; // Set flag
    res.redirect('/');
});

app.post('/set-schedule', (req, res) => {
    globalState.schedule.h = parseInt(req.body.h);
    globalState.schedule.m = parseInt(req.body.m);
    res.redirect('/');
});

// --- 3. API FOR ESP (The Device Talks to This) ---
app.get('/api/status', (req, res) => {
    res.json({
        dispense: globalState.dispenseCommand, // ESP reads this
        schedule: globalState.schedule         // ESP reads this
    });

    // Reset the dispense command after ESP reads it
    // (So it doesn't dispense forever)
    if(globalState.dispenseCommand) {
        console.log("Command sent to ESP!");
        globalState.dispenseCommand = false; 
    }
});

app.listen(port, () => console.log(`Server running on port ${port}`));